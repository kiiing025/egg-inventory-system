# Customer Book Search Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Customer Book name search responsive by caching expensive customer summaries and rebuilding them only after business data changes.

**Architecture:** Split the existing summary calculation into an uncached builder and a revision-backed accessor. Add a second lightweight cache for the filtered/selected Customer Book view, invalidate both caches through the existing persistence and state-replacement paths, and keep all cache state runtime-only.

**Tech Stack:** Vanilla JavaScript, Alpine.js, Node.js built-in test runner, service worker cache

---

## File map

- Modify `index.html`: add runtime cache state, summary/view cache methods, invalidation hooks, and cached Customer Book template bindings.
- Modify `tests/manual-adjustments.test.js`: add deterministic builder-call, invalidation, selection, template, and cache-version regression coverage.
- Modify `service-worker.js`: bump the app-shell cache so installed copies receive the fix.

### Task 1: Add failing Customer Book cache regression tests

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Test: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Write the failing cache and search test**

Add this test near the existing customer summary tests:

```js
test('customer book reuses prepared summaries while search text changes', () => {
    const app = loadEggApp();
    app.sales = [
        { id: 1, customer: 'Alice', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-01' },
        { id: 2, customer: 'Bob', quantity: 2, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-02' }
    ];

    const originalBuilder = app.buildCustomerSummaries.bind(app);
    let buildCount = 0;
    app.buildCustomerSummaries = function countedCustomerSummaryBuild() {
        buildCount += 1;
        return originalBuilder();
    };

    assert.equal(app.getCustomerBookView().filtered.length, 2);
    assert.equal(app.getCustomerBookView().filtered.length, 2);

    app.customerSearch = 'ali';
    assert.deepEqual(
        Array.from(app.getCustomerBookView().filtered, customer => customer.name),
        ['Alice']
    );
    assert.equal(app.getFilteredCustomerSummaries()[0].name, 'Alice');
    assert.equal(app.getSelectedCustomerSummary().name, 'Alice');
    assert.equal(buildCount, 1);
});
```

- [ ] **Step 2: Write failing invalidation tests**

Add these tests immediately after the cache test:

```js
test('customer book cache invalidates after persisted business changes', () => {
    const app = loadEggApp();
    app.sales = [
        { id: 1, customer: 'Alice', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-01' }
    ];

    const originalBuilder = app.buildCustomerSummaries.bind(app);
    let buildCount = 0;
    app.buildCustomerSummaries = function countedCustomerSummaryBuild() {
        buildCount += 1;
        return originalBuilder();
    };

    assert.deepEqual(Array.from(app.getCustomerSummaries(), customer => customer.name), ['Alice']);
    app.sales.push({ id: 2, customer: 'Bob', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-02' });
    assert.equal(app.persistState({ sync: false }), true);

    assert.deepEqual(
        Array.from(app.getCustomerSummaries(), customer => customer.name),
        ['Alice', 'Bob']
    );
    assert.equal(buildCount, 2);
});

test('customer book cache invalidates when persisted state is replaced', () => {
    const app = loadEggApp();
    app.sales = [
        { id: 1, customer: 'Alice', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-01' }
    ];

    assert.equal(app.getCustomerSummaries()[0].name, 'Alice');
    assert.equal(app.applyPersistedState({
        inventory: 100,
        sales: [
            { id: 2, customer: 'Bob', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-02' }
        ],
        expenses: [],
        config: { regularPrice: 250, loanPrice: 270 }
    }), true);

    assert.deepEqual(Array.from(app.getCustomerSummaries(), customer => customer.name), ['Bob']);
});

test('customer book keeps an explicit selection while filtering the list', () => {
    const app = loadEggApp();
    app.sales = [
        { id: 1, customer: 'Alice', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-01' },
        { id: 2, customer: 'Bob', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-02' }
    ];
    app.selectedCustomerKey = app.getCustomerKey('Alice');
    app.customerSearch = 'bob';

    const view = app.getCustomerBookView();
    assert.deepEqual(Array.from(view.filtered, customer => customer.name), ['Bob']);
    assert.equal(view.selected.name, 'Alice');
    assert.equal(view.isEmpty, false);
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="customer book (reuses|cache invalidates|keeps)" tests\manual-adjustments.test.js
```

Expected: FAIL because `buildCustomerSummaries()` and `getCustomerBookView()` do not exist yet.

### Task 2: Implement revision-backed summary and view caches

**Files:**
- Modify: `index.html:2299-2302`
- Modify: `index.html:2509-2525`
- Modify: `index.html:3069-3083`
- Modify: `index.html:4675-4750`
- Modify: `index.html:5239-5248`
- Test: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Add runtime-only cache state**

Add these fields beside `salesLedgerCache`:

```js
customerBookRevision: 0,
customerSummaryCache: null,
customerBookViewCache: null,
```

Do not add them to `getPersistableState()`.

- [ ] **Step 2: Add invalidation hooks**

Add this method before `persistState()`:

```js
invalidateCustomerBookCache() {
    this.customerBookRevision = Number(this.customerBookRevision || 0) + 1;
    this.customerSummaryCache = null;
    this.customerBookViewCache = null;
    return this.customerBookRevision;
},
```

Call `this.invalidateCustomerBookCache();` at the end of `applyPersistedState()` after `normalizeHistoricalAprilSales()`, before returning `true`.

Call `this.invalidateCustomerBookCache();` as the first statement in `persistState()` so in-memory mutations invalidate the cache even if `localStorage.setItem()` fails.

- [ ] **Step 3: Split and cache summary construction**

Replace the existing `getCustomerSummaries()` implementation with this builder and accessor:

```js
buildCustomerSummaries() {
    const groups = new Map();

    this.sales.forEach(sale => {
        const key = this.getCustomerKey(sale.customer);
        const name = this.getCustomerDisplayName(sale.customer);
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                name,
                orderCount: 0,
                totalQuantity: 0,
                totalValue: 0,
                unpaidAmount: 0,
                unpaidCount: 0,
                lastOrderTimestamp: 0,
                lastOrderDateDisplay: '',
                lastPaidTimestamp: 0,
                lastPaidDateDisplay: '',
                history: []
            });
        }

        const summary = groups.get(key);
        const quantity = Number(sale.quantity || 0);
        const unitPrice = Number(sale.unitPrice || 0);
        const total = quantity * unitPrice;
        const orderDateValue = sale.orderDate || sale.date;
        const paidDateValue = sale.paidDate || (sale.paid ? orderDateValue : '');
        const orderTimestamp = this.getDateTimestamp(orderDateValue);
        const paidTimestamp = this.getDateTimestamp(paidDateValue);

        summary.orderCount += 1;
        summary.totalQuantity += quantity;
        summary.totalValue += total;
        summary.history.push(sale);

        if (this.isFinancialSale(sale) && sale.type === 'Loaned' && this.getSaleBalance(sale) > 0) {
            summary.unpaidAmount += this.getSaleBalance(sale);
            summary.unpaidCount += 1;
        }

        if (orderTimestamp >= summary.lastOrderTimestamp) {
            summary.lastOrderTimestamp = orderTimestamp;
            summary.lastOrderDateDisplay = sale.orderDateDisplay || sale.dateDisplay || this.formatDisplayDate(orderDateValue);
        }

        if (sale.paid && paidTimestamp >= summary.lastPaidTimestamp) {
            summary.lastPaidTimestamp = paidTimestamp;
            summary.lastPaidDateDisplay = sale.paidDateDisplay || this.formatDisplayDate(paidDateValue);
        }
    });

    return Array.from(groups.values())
        .map(summary => ({
            ...summary,
            history: summary.history.sort((a, b) => {
                const dateDiff = this.getDateTimestamp(b.orderDate || b.date) - this.getDateTimestamp(a.orderDate || a.date);
                if (dateDiff !== 0) return dateDiff;
                return Number(b.id || 0) - Number(a.id || 0);
            })
        }))
        .sort((a, b) => {
            const nameDiff = a.name.localeCompare(b.name);
            if (nameDiff !== 0) return nameDiff;
            if (b.unpaidAmount !== a.unpaidAmount) return b.unpaidAmount - a.unpaidAmount;
            return b.lastOrderTimestamp - a.lastOrderTimestamp;
        });
},

getCustomerSummaries() {
    const revision = Number(this.customerBookRevision || 0);
    if (this.customerSummaryCache && this.customerSummaryCache.revision === revision) {
        return this.customerSummaryCache.summaries;
    }

    const summaries = this.buildCustomerSummaries();
    this.customerSummaryCache = { revision, summaries };
    this.customerBookViewCache = null;
    return summaries;
},
```

- [ ] **Step 4: Add the derived Customer Book view**

Replace `getFilteredCustomerSummaries()` with these methods:

```js
getCustomerBookView() {
    const revision = Number(this.customerBookRevision || 0);
    const query = String(this.customerSearch || '').trim().toLowerCase();
    const selectedKey = String(this.selectedCustomerKey || '');
    const cached = this.customerBookViewCache;

    if (
        cached &&
        cached.revision === revision &&
        cached.query === query &&
        cached.selectedKey === selectedKey
    ) {
        return cached.view;
    }

    const summaries = this.getCustomerSummaries();
    const filtered = query
        ? summaries.filter(customer => customer.name.toLowerCase().includes(query))
        : summaries;
    const selected = summaries.find(customer => customer.key === selectedKey) ||
        filtered[0] ||
        summaries[0] ||
        null;
    const view = {
        filtered,
        selected,
        isEmpty: filtered.length === 0
    };

    this.customerBookViewCache = {
        revision,
        query,
        selectedKey,
        view
    };
    return view;
},

getFilteredCustomerSummaries() {
    return this.getCustomerBookView().filtered;
},
```

Replace `getSelectedCustomerSummary()` with:

```js
getSelectedCustomerSummary() {
    return this.getCustomerBookView().selected;
},
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="customer book (reuses|cache invalidates|keeps)" tests\manual-adjustments.test.js
```

Expected: all focused tests PASS, with one summary build while only search state changes and a second build after business-data invalidation.

- [ ] **Step 6: Commit the cache implementation**

```powershell
git add -- index.html tests/manual-adjustments.test.js
git commit -m "Speed up Customer Book search"
```

### Task 3: Bind the template to the cached view and refresh installed copies

**Files:**
- Modify: `index.html:896-1031`
- Modify: `tests/manual-adjustments.test.js`
- Modify: `service-worker.js:1`

- [ ] **Step 1: Add failing template and cache-version tests**

Add:

```js
test('customer book template reads the cached customer view', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const customerSection = html.slice(
        html.indexOf('<section x-show="currentPage === \'customers\'"'),
        html.indexOf('<section x-show="currentPage === \'closing\'"')
    );

    assert.match(customerSection, /x-for="customer in getCustomerBookView\(\)\.filtered"/);
    assert.match(customerSection, /x-show="getCustomerBookView\(\)\.isEmpty"/);
    assert.match(customerSection, /x-if="getCustomerBookView\(\)\.selected"/);
});
```

Update the existing service-worker cache test to expect `egg-inventory-cache-v31` and rename it to `service worker cache version is bumped for Customer Book performance`.

- [ ] **Step 2: Run the two tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="customer book template|service worker cache version" tests\manual-adjustments.test.js
```

Expected: FAIL because the template still uses legacy accessors and the cache is still v30.

- [ ] **Step 3: Update the Customer Book template**

Within the Customer Book section only:

- Change `getFilteredCustomerSummaries()` list reads to `getCustomerBookView().filtered`.
- Change the empty-state condition to `getCustomerBookView().isEmpty`.
- Change `getSelectedCustomerSummary()` template reads to `getCustomerBookView().selected`.

Do not change action-method defaults elsewhere in the script.

- [ ] **Step 4: Bump the service-worker cache**

Change:

```js
const CACHE_NAME = 'egg-inventory-cache-v31';
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="customer book template|service worker cache version" tests\manual-adjustments.test.js
```

Expected: both tests PASS.

### Task 4: Audit, benchmark, verify, commit, and push

**Files:**
- Verify: `index.html`
- Verify: `tests/manual-adjustments.test.js`
- Verify: `service-worker.js`

- [ ] **Step 1: Run the complete automated suite**

```powershell
node --test tests\manual-adjustments.test.js
node --check service-worker.js
git diff --check
```

Expected: all tests pass, syntax check exits 0, and `git diff --check` prints nothing.

- [ ] **Step 2: Re-run the deterministic performance benchmark**

Use the existing diagnostic dataset shape—2,500 orders across 500 customers—and invoke the same Customer Book render access pattern. Confirm the prepared-summary builder runs once before the first query and zero additional times for later search queries while the revision remains unchanged.

- [ ] **Step 3: Verify the Customer Book in an isolated browser origin**

Serve the repository on `127.0.0.1`, open a fresh background tab, navigate to Customer Book, and type several search queries rapidly. Confirm:

- typed characters appear without visible delay;
- filtered names update correctly;
- the selected detail panel remains valid;
- no-match state appears correctly;
- browser console has no errors.

- [ ] **Step 4: Review the final diff for scope and data safety**

```powershell
git status --short --branch
git diff --stat
git diff -- index.html service-worker.js tests/manual-adjustments.test.js
```

Confirm no business data, credentials, sync configuration, or unrelated files are included.

- [ ] **Step 5: Commit the remaining verified changes**

```powershell
git add -- index.html service-worker.js tests/manual-adjustments.test.js
git commit -m "Refresh installed app for faster customer search"
```

- [ ] **Step 6: Push the completed work**

```powershell
git push origin main
```

Expected: GitHub `origin/main` advances to the final verified commit.
