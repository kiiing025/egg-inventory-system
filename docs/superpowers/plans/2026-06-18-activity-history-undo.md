# Activity History and Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight, synced Activity History with safe Undo and reversal support for YOLK's important business mutations.

**Architecture:** Keep the existing Alpine single-file app and add a bounded `activityLog` to its persisted state. A shared action recorder captures compact record-level diffs and derived financial effects; a generic reversal engine applies the saved before-state only when the affected records still match the saved after-state, preventing older actions from overwriting newer work.

**Tech Stack:** Alpine.js, Tailwind CSS, localStorage, Supabase JSON sync, Node.js built-in test runner and VM harness.

---

### Task 1: Persisted Activity Model and Diff Helpers

**Files:**
- Modify: `index.html:2140-2400`
- Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Write failing persistence and diff tests**

Add tests that expect a new app to expose an empty `activityLog`, persist it in `egg_app_data`, restore it through `applyPersistedState()`, cap it at 1,000 entries, and produce record-level changes from before/after collection snapshots.

```js
test('activity history persists and trims to the newest 1000 records', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.activityLog = Array.from({ length: 1002 }, (_, index) => ({ id: `a-${index}` }));

    app.trimActivityLog();
    app.persistState();

    assert.equal(app.activityLog.length, 1000);
    assert.equal(JSON.parse(storage.getItem('egg_app_data')).activityLog.length, 1000);
});

test('activity snapshots store only changed collection records', () => {
    const app = loadEggApp();
    app.sales = [{ id: 1, customer: 'A' }];
    const before = app.captureActivityContext(['sales']);
    app.sales[0].customer = 'B';
    const changes = app.diffActivityContexts(before, app.captureActivityContext(['sales']));

    assert.equal(changes.length, 1);
    assert.equal(changes[0].before.customer, 'A');
    assert.equal(changes[0].after.customer, 'B');
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because `trimActivityLog`, `captureActivityContext`, and `diffActivityContexts` do not exist and `activityLog` is not persisted.

- [ ] **Step 3: Add activity state, persistence, and compact diff helpers**

Add state for `activityLog`, filters, pagination, and the Undo toast. Extend `getPersistableState()`, `applyPersistedState()`, backup normalization, and backup validation with `activityLog`.

Implement these public helpers:

```js
cloneActivityValue(value) {
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
},

captureActivityContext(collectionNames = []) {
    return {
        collections: Object.fromEntries(collectionNames.map(name => [name, this.cloneActivityValue(this[name] || [])])),
        metrics: this.getActivityMetrics()
    };
},

diffActivityContexts(before, after) {
    // Compare records by String(record.id) and return only changed records,
    // including beforeIndex and afterIndex for stable restoration.
},

trimActivityLog() {
    this.activityLog = (Array.isArray(this.activityLog) ? this.activityLog : []).slice(0, 1000);
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/manual-adjustments.test.js`

Expected: all tests pass.

### Task 2: Shared Action Recorder and Generic Safe Reversal

**Files:**
- Modify: `index.html:3300-4100`
- Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Write failing action recorder tests**

Test that `recordActivityFromContext()` stores summary, changes, effects, and timestamp; that immediate Undo restores a created sale and its egg stock; and that a second Undo is rejected.

```js
test('undoing a recorded sale restores stock and marks the action reversed', () => {
    const app = loadEggApp();
    app.inventory = 20;
    app.ensureEggCatalog();
    app.saleForm.customer = 'Undo Customer';
    app.saleForm.quantity = 2;

    assert.equal(app.submitSale(), true);
    const activity = app.activityLog[0];
    assert.equal(app.getEggTypeStock('Large'), 18);

    assert.equal(app.undoActivity(activity.id), true);
    assert.equal(app.sales.some(sale => sale.customer === 'Undo Customer'), false);
    assert.equal(app.getEggTypeStock('Large'), 20);
    assert.ok(activity.reversedBy);
    assert.equal(app.undoActivity(activity.id), false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because action recording and reversal methods are missing.

- [ ] **Step 3: Implement the recorder and reversal engine**

Implement:

```js
recordActivityFromContext(meta, beforeContext, collectionNames) {
    const afterContext = this.captureActivityContext(collectionNames);
    const activity = {
        id: this.createActivityId(),
        actionType: meta.actionType,
        entityType: meta.entityType,
        entityId: meta.entityId ?? null,
        summary: meta.summary,
        occurredAt: new Date().toISOString(),
        changes: this.diffActivityContexts(beforeContext, afterContext),
        effects: this.diffActivityMetrics(beforeContext.metrics, afterContext.metrics),
        note: String(meta.note || '').trim(),
        reversalOf: meta.reversalOf || null,
        reversedBy: null
    };
    this.activityLog.unshift(activity);
    this.trimActivityLog();
    this.showUndoToast(activity);
    return activity;
},

canReverseActivity(activity) {
    // Require an unreversed action, unchanged affected records, and valid
    // resulting cash/stock balances.
},

undoActivity(activityId, requireConfirmation = false) {
    // Validate all changes first, apply every before-state atomically,
    // sync inventory, append a reversal activity, persist once, and return true.
}
```

The apply phase must not mutate any collection until every safety check passes.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/manual-adjustments.test.js`

Expected: all tests pass.

### Task 3: Track Sales, Payments, Expenses, Stock, Cash, and Wallets

**Files:**
- Modify: `index.html:3880-4760`
- Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Write failing business-action tests**

Add focused tests for sale create/delete/edit, past-order import, partial payment, loan collection, expense create/delete, restock, manual cash/stock adjustment, and wallet transfer. Each test must assert one activity type and exact reversal of the business totals it affects. The past-order test must confirm that reversal changes no cash, profit, receivable, or stock totals.

```js
test('wallet transfer reversal preserves profit while restoring both balances', () => {
    const app = loadEggApp();
    app.sales = [paidOnlineSale({ amount: 900, account: 'GCash' })];
    const profit = app.getNetProfit();
    app.walletTransferForm = { open: true, account: 'GCash', amount: 400, date: '2026-06-18', note: '' };

    assert.equal(app.saveWalletTransfer(), true);
    assert.equal(app.undoActivity(app.activityLog[0].id), true);
    assert.equal(app.getWalletBalance('GCash'), 900);
    assert.equal(app.getCashOnHand(), 0);
    assert.equal(app.getNetProfit(), profit);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because existing mutations do not create activity entries.

- [ ] **Step 3: Wrap each mutation with before/after capture**

For each mutation, capture only the collections it can change, perform existing validation and mutation logic, then record and persist:

```js
const watched = ['sales', 'eggTypes'];
const before = this.captureActivityContext(watched);
// Existing sale mutation.
this.recordActivityFromContext({
    actionType: 'sale_created',
    entityType: 'sale',
    entityId: sale.id,
    summary: `Sale recorded for ${sale.customer || 'Walk-in'}`
}, before, watched);
this.persistState();
```

Use stable action types: `sale_created`, `past_order_added`, `sale_edited`, `sale_deleted`, `payment_recorded`, `expense_created`, `expense_deleted`, `restock_recorded`, `cash_adjusted`, `stock_adjusted`, and `wallet_transferred`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/manual-adjustments.test.js`

Expected: all tests pass.

### Task 4: Track Customers and Product Catalog Changes

**Files:**
- Modify: `index.html:3340-4380`
- Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Write failing customer and product reversal tests**

Test product creation/edit reversal, customer rename/merge reversal across several orders, and customer removal reversal without changing unrelated stock.

```js
test('reversing a customer merge restores each original order name', () => {
    const app = loadEggApp();
    app.sales = [
        { id: 1, customer: 'Chandra', historyOnly: true, affectsCash: false },
        { id: 2, customer: 'Chanda', historyOnly: true, affectsCash: false }
    ];
    app.openCustomerEdit('chandra');
    app.customerEditForm.newName = 'Chanda';

    assert.equal(app.saveCustomerEdit(), true);
    assert.equal(app.undoActivity(app.activityLog[0].id), true);
    assert.deepEqual(app.sales.map(sale => sale.customer), ['Chandra', 'Chanda']);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because customer and catalog mutations are not tracked.

- [ ] **Step 3: Add customer and catalog tracking**

Wrap customer rename/merge/removal with `['sales']` snapshots and catalog save with `['eggTypes']`. Use `customer_renamed`, `customer_removed`, `product_created`, and `product_edited` action types. Preserve each affected sale record in the compact changes list so reversal restores mixed historical names exactly.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/manual-adjustments.test.js`

Expected: all tests pass.

### Task 5: Duplicate Sale Guardrail and Activity Query Helpers

**Files:**
- Modify: `index.html:3260-3340`
- Modify: `index.html:4580-4655`
- Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Write failing validation and query tests**

Test matching customer, order date, egg type, and quantity as a possible duplicate; allow the owner to confirm; block when confirmation is declined; reject blank or invalid expense values; preserve an in-memory activity when localStorage throws; and test Activity search, category filters, and 25-row pagination.

```js
test('possible duplicate sale requires confirmation before saving', () => {
    let confirmations = 0;
    const app = loadEggApp(createStorage(), { confirm: () => { confirmations += 1; return false; } });
    app.sales = [{ id: 1, customer: 'Joy', orderDate: '2026-06-18', eggType: 'Large', quantity: 1 }];
    app.saleForm = { ...app.saleForm, customer: 'Joy', orderDate: '2026-06-18', eggType: 'Large', quantity: 1 };

    assert.equal(app.submitSale(), false);
    assert.equal(confirmations, 1);
    assert.equal(app.sales.length, 1);
});
```

Update the test loader to accept optional `alert` and `confirm` functions without connecting to any browser or cloud service.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because duplicate detection and Activity query helpers are missing.

- [ ] **Step 3: Implement guardrail and query helpers**

Implement `findPossibleDuplicateSale()`, `getFilteredActivities()`, `getVisibleActivities()`, `showMoreActivities()`, `getActivityCategory()`, `getActivityEffectSummary()`, and `getActivityReversalStatus()`.

Update `persistState()` to catch localStorage failures, retain current in-memory data, set a reader-facing save error, avoid claiming the change is synced, and return `false`. Successful persistence returns `true` and follows the existing sync queue behavior.

Duplicate comparison must normalize customer names and egg type names. It warns but does not permanently block a confirmed sale.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/manual-adjustments.test.js`

Expected: all tests pass.

### Task 6: Calm Activity History and Undo UI

**Files:**
- Modify: `index.html:390-425`
- Modify: `index.html:1460-1630`
- Modify: `index.html:1630-1705`
- Modify: `index.html:3260-3310`
- Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Write failing markup tests**

Assert the desktop Activity navigation, mobile More menu entry, separate `currentPage === 'activity'` section, search and category controls, 25-row list, before/after details, Reverse button, empty state, and fixed Undo toast are present.

```js
test('activity history and temporary undo controls are rendered', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    assert.match(html, /currentPage === 'activity'/);
    assert.match(html, /x-model="activitySearch"/);
    assert.match(html, /getVisibleActivities\(\)/);
    assert.match(html, /undoActivity\(activityUndo\.activityId\)/);
    assert.match(html, />Activity History</);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because Activity UI markup is absent.

- [ ] **Step 3: Build the separate Activity page**

Follow the approved calm layout: unframed page header, compact search, pill filters, date-grouped rows, expandable details, and progressive loading. Add one fixed toast above the mobile navigation that contains only the saved-action message and Undo command. Add page title/eyebrow and More-page recognition for `activity`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/manual-adjustments.test.js`

Expected: all tests pass.

### Task 7: Service Worker, Full Regression, and Isolated Browser Check

**Files:**
- Modify: `service-worker.js:1`
- Test: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Bump the app shell cache version**

Change the cache key from `egg-inventory-cache-v28` to `egg-inventory-cache-v29` so installed iPhones receive the new HTML.

- [ ] **Step 2: Run complete automated verification**

Run:

```powershell
node --test tests/manual-adjustments.test.js
node --check service-worker.js
git diff --check
```

Expected: zero failing tests, JavaScript syntax exit code 0, and no whitespace errors.

- [ ] **Step 3: Verify in a cloud-isolated browser origin**

Serve the repository on a new localhost port that has no Supabase session or local business data. Confirm light and dark layouts, desktop and mobile navigation, Activity empty state, a locally created test sale, Undo, filters, and no console errors. Do not sign in, pull, or push cloud data.

- [ ] **Step 4: Review the final diff for source-of-truth safety**

Confirm that no real `egg_app_data`, credentials, Supabase payload, generated backup, or `.superpowers` companion files are staged. Confirm `activityLog` is additive and empty for existing saved/cloud data.
