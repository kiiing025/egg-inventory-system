# Mobile Ledger Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign YOLK into a polished, light, phone-first inventory app with a cleaner dashboard, mobile ledger cards, a better bottom tab bar, and a modern weekly report sheet.

**Architecture:** Keep the current single-file Alpine/Tailwind app. Add a small style foundation in the existing `<style>` block, refine existing HTML sections in `index.html`, add a tiny Alpine navigation state for the mobile More menu, and preserve all existing business methods and data totals.

**Tech Stack:** Vanilla HTML, Tailwind CDN utility classes, Alpine.js state/methods, Lucide icons, Node's built-in test runner.

---

## File Structure

- Modify `index.html`
  - Existing `<style>` block: add reusable visual foundation classes and motion/focus polish.
  - Existing top `<nav>`: replace with a cleaner page header using `getPageTitle()` and `getPageEyebrow()`.
  - Existing desktop `<aside>`: refine active navigation and quick-view stats.
  - Existing dashboard section: replace the metric grid and form area with the mobile-ledger dashboard layout.
  - Existing customers, sales, and expenses sections: add mobile card rows while keeping desktop tables.
  - Existing weekly report modal: polish the report sheet and keep current generation/export behavior.
  - Alpine state near `currentPage`: add `showMobileMoreMenu: false`.
  - Alpine helpers near `navButtonClass()`: add `setCurrentPage()`, `isMorePage()`, and More-menu helper behavior.
- Modify `tests/manual-adjustments.test.js`
  - Add rendering tests for the redesigned shell, More menu, dashboard, ledger cards, and report sheet.
  - Keep all existing business behavior tests unchanged.
- Modify `service-worker.js`
  - Bump the cache name after visual files change so iPhone installs receive the new shell.

## Task 1: Mobile More Navigation Contract

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing test**

Add this test after the existing `mobile navigation uses a fixed bottom tab bar with icons` test in `tests/manual-adjustments.test.js`:

```js
test('mobile ledger navigation uses primary tabs and a more menu', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = loadEggApp();

    assert.equal(app.showMobileMoreMenu, false);
    assert.equal(typeof app.setCurrentPage, 'function');
    assert.equal(typeof app.isMorePage, 'function');

    assert.match(html, /data-mobile-tab="dashboard"/);
    assert.match(html, /data-mobile-tab="customers"/);
    assert.match(html, /data-mobile-tab="closing"/);
    assert.match(html, /data-mobile-tab="sales"/);
    assert.match(html, /data-mobile-tab="more"/);

    assert.match(html, /data-mobile-more-menu/);
    assert.match(html, /@click="setCurrentPage\('expenses'\)"/);
    assert.match(html, /@click="setCurrentPage\('adjustments'\)"/);
    assert.match(html, /@click="setCurrentPage\('sync'\)"/);

    app.setCurrentPage('expenses');
    assert.equal(app.currentPage, 'expenses');
    assert.equal(app.showMobileMoreMenu, false);
    assert.equal(app.isMorePage(), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: FAIL in `mobile ledger navigation uses primary tabs and a more menu` because `showMobileMoreMenu`, `setCurrentPage`, `isMorePage`, and `data-mobile-tab="more"` do not exist yet.

- [ ] **Step 3: Add the mobile navigation state**

In `index.html`, inside the Alpine data object near:

```js
currentPage: 'dashboard',
currentTab: 'sales',
customerSearch: '',
```

change it to:

```js
currentPage: 'dashboard',
currentTab: 'sales',
showMobileMoreMenu: false,
customerSearch: '',
```

- [ ] **Step 4: Add navigation helper methods**

In `index.html`, immediately before `navButtonClass(page) {`, add:

```js
setCurrentPage(page) {
    this.currentPage = page;
    this.showMobileMoreMenu = false;
    this.renderIcons();
},

isMorePage() {
    return ['expenses', 'adjustments', 'sync'].includes(this.currentPage);
},
```

- [ ] **Step 5: Replace direct mobile bottom tab assignments**

Replace the mobile bottom navigation block around the existing `aria-label="Mobile bottom navigation"` with this structure:

```html
<nav aria-label="Mobile bottom navigation" class="lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none">
    <div class="pointer-events-auto mx-auto max-w-md rounded-[1.75rem] border border-white/15 bg-[#161817]/95 px-2 py-2 text-white shadow-2xl shadow-slate-950/25 backdrop-blur-xl grid grid-cols-5 gap-1">
        <button data-mobile-tab="dashboard" @click="setCurrentPage('dashboard')" :class="mobileBottomNavItemClass('dashboard')" class="min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 active:scale-95">
            <i data-lucide="layout-dashboard" :class="mobileBottomNavIconClass('dashboard')" class="h-5 w-5"></i>
            <span class="text-[10px] font-bold leading-none">Home</span>
        </button>
        <button data-mobile-tab="customers" @click="setCurrentPage('customers')" :class="mobileBottomNavItemClass('customers')" class="min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 active:scale-95">
            <i data-lucide="users" :class="mobileBottomNavIconClass('customers')" class="h-5 w-5"></i>
            <span class="text-[10px] font-bold leading-none">People</span>
        </button>
        <button data-mobile-tab="closing" @click="setCurrentPage('closing')" :class="mobileBottomNavItemClass('closing')" class="min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 active:scale-95">
            <i data-lucide="calendar-check" :class="mobileBottomNavIconClass('closing')" class="h-5 w-5"></i>
            <span class="text-[10px] font-bold leading-none">Close</span>
        </button>
        <button data-mobile-tab="sales" @click="setCurrentPage('sales')" :class="mobileBottomNavItemClass('sales')" class="min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 active:scale-95">
            <i data-lucide="shopping-bag" :class="mobileBottomNavIconClass('sales')" class="h-5 w-5"></i>
            <span class="text-[10px] font-bold leading-none">Sales</span>
        </button>
        <button data-mobile-tab="more" @click="showMobileMoreMenu = !showMobileMoreMenu; renderIcons()" :class="isMorePage() || showMobileMoreMenu ? 'bg-[#d34036] text-white -translate-y-3 shadow-lg shadow-[#d34036]/30' : 'text-slate-200 hover:bg-white/10 hover:text-white'" class="min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 active:scale-95">
            <i data-lucide="menu" class="h-5 w-5"></i>
            <span class="text-[10px] font-bold leading-none">More</span>
        </button>
    </div>
</nav>

<div x-show="showMobileMoreMenu" @click="showMobileMoreMenu = false" class="lg:hidden fixed inset-0 z-30 bg-slate-950/20" style="display: none;" x-transition.opacity.duration.150ms></div>
<div data-mobile-more-menu x-show="showMobileMoreMenu" class="lg:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.9rem)] z-50 mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" style="display: none;" x-transition>
    <button @click="setCurrentPage('expenses')" class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold transition-colors hover:bg-slate-100 dark:hover:bg-white/10">
        <i data-lucide="receipt-text" class="h-5 w-5 text-[#d34036]"></i>
        Expenses Ledger
    </button>
    <button @click="setCurrentPage('adjustments')" class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold transition-colors hover:bg-slate-100 dark:hover:bg-white/10">
        <i data-lucide="sliders-horizontal" class="h-5 w-5 text-[#d34036]"></i>
        Manual Adjustments
    </button>
    <button @click="setCurrentPage('sync')" class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold transition-colors hover:bg-slate-100 dark:hover:bg-white/10">
        <i data-lucide="cloud" class="h-5 w-5 text-[#d34036]"></i>
        Cloud Sync
    </button>
</div>
```

- [ ] **Step 6: Update nav active class helpers**

Replace `mobileBottomNavItemClass(page)` with:

```js
mobileBottomNavItemClass(page) {
    return this.currentPage === page ?
        'bg-[#d34036] text-white -translate-y-3 shadow-lg shadow-[#d34036]/30' :
        'text-slate-200 hover:bg-white/10 hover:text-white';
},
```

Leave `mobileBottomNavIconClass(page)` in place unless visual testing shows it needs stronger contrast.

- [ ] **Step 7: Run the test to verify it passes**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: PASS for the new navigation test and no regressions.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests\manual-adjustments.test.js
git commit -m "Add mobile More navigation"
```

## Task 2: Shared Visual Foundation and App Shell

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing test**

Add this test after `app shell defaults to light mode and keeps dark mode opt-in`:

```js
test('mobile ledger redesign shell includes shared visual foundation', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /data-yolk-shell/);
    assert.match(html, /\.yolk-surface/);
    assert.match(html, /\.yolk-metric/);
    assert.match(html, /\.yolk-action/);
    assert.match(html, /\.yolk-ledger-card/);
    assert.match(html, /font-variant-numeric:\s*tabular-nums/);
    assert.match(html, /getPageTitle\(\)/);
    assert.match(html, /getPageEyebrow\(\)/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: FAIL because `data-yolk-shell` and the reusable class names are not present yet.

- [ ] **Step 3: Add shared CSS classes**

Inside the existing `<style>` block in `index.html`, after the reduced-motion loading rule, add:

```css
:root {
    --yolk-red: #d34036;
    --yolk-red-dark: #b8322b;
    --yolk-ink: #1f2421;
    --yolk-muted: #6f756f;
    --yolk-line: #e6e0d8;
    --yolk-paper: #f6f3ee;
}

.yolk-app-bg {
    background:
        radial-gradient(circle at top left, rgba(211, 64, 54, 0.08), transparent 32rem),
        linear-gradient(180deg, #f8f5f0 0%, #f3f0ea 100%);
}

.dark .yolk-app-bg {
    background:
        radial-gradient(circle at top left, rgba(211, 64, 54, 0.16), transparent 30rem),
        linear-gradient(180deg, #0f1412 0%, #111827 100%);
}

.yolk-surface {
    border: 1px solid rgba(148, 123, 102, 0.18);
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 18px 50px rgba(79, 55, 39, 0.08);
}

.dark .yolk-surface {
    border-color: rgba(255, 255, 255, 0.10);
    background: rgba(15, 23, 42, 0.88);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
}

.yolk-metric {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
}

.yolk-action {
    transition: transform 180ms ease, background-color 180ms ease, color 180ms ease, box-shadow 180ms ease;
}

.yolk-action:active {
    transform: scale(0.98);
}

.yolk-ledger-card {
    border: 1px solid rgba(148, 123, 102, 0.18);
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 12px 34px rgba(79, 55, 39, 0.07);
}

.dark .yolk-ledger-card {
    border-color: rgba(255, 255, 255, 0.10);
    background: rgba(15, 23, 42, 0.9);
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
    outline: 2px solid var(--yolk-red);
    outline-offset: 2px;
}
```

- [ ] **Step 4: Update the body shell class**

Replace the existing `<body class="...">` with:

```html
<body data-yolk-shell class="yolk-app-bg min-h-screen font-sans text-[#1f2421] antialiased transition-colors duration-200 dark:text-slate-100">
```

- [ ] **Step 5: Replace the top nav with a page header**

Replace the existing top `<nav class="sticky top-0 ...">` block with:

```html
<nav class="sticky top-0 z-50 border-b border-[#e6e0d8]/80 bg-[#f8f5f0]/90 px-4 py-3 backdrop-blur-xl lg:ml-64 dark:border-white/10 dark:bg-slate-950/85">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d34036]" x-text="getPageEyebrow()"></p>
            <h1 class="truncate text-xl font-black leading-tight text-[#1f2421] dark:text-white" x-text="getPageTitle()"></h1>
        </div>
        <div class="flex items-center gap-2">
            <button @click="openReceiptModal()" class="yolk-action inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d34036] px-3 py-2 text-xs font-black text-white shadow-lg shadow-[#d34036]/20 hover:bg-[#b8322b] sm:text-sm">
                <i data-lucide="receipt-text" class="h-4 w-4"></i>
                <span class="hidden sm:inline">Weekly Report</span>
            </button>
            <button x-show="pinLockEnabled" @click="lockApp()" aria-label="Lock app" class="yolk-action inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e6e0d8] bg-white/80 text-[#1f2421] hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
                <i data-lucide="lock-keyhole" class="h-5 w-5"></i>
            </button>
            <button @click="toggleTheme()" aria-label="Toggle dark mode" class="yolk-action inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e6e0d8] bg-white/80 text-[#1f2421] hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
                <i x-show="!darkMode" data-lucide="moon" class="h-5 w-5"></i>
                <i x-show="darkMode" data-lucide="sun" class="h-5 w-5"></i>
            </button>
        </div>
    </div>
</nav>
```

- [ ] **Step 6: Update the desktop sidebar visual classes**

Keep the existing sidebar links and quick view data, but update the wrapper class to:

```html
<aside class="hidden lg:block fixed inset-y-0 left-0 w-64 border-r border-[#e6e0d8] bg-[#fbfaf7] px-4 py-5 dark:border-white/10 dark:bg-slate-950">
```

Replace `navButtonClass(page)` with:

```js
navButtonClass(page) {
    return this.currentPage === page ?
        'bg-[#1f2421] text-white shadow-sm dark:bg-white dark:text-slate-950' :
        'text-slate-600 hover:bg-[#eee8df] hover:text-[#1f2421] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white';
},
```

- [ ] **Step 7: Run the test to verify it passes**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: PASS for shell tests and existing business tests.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests\manual-adjustments.test.js
git commit -m "Add shared mobile ledger shell"
```

## Task 3: Dashboard Mobile Ledger Layout

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing test**

Add this test after `dashboard includes a customer loan reminder shortcut`:

```js
test('dashboard renders mobile ledger summary and quick actions', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /data-dashboard-hero/);
    assert.match(html, /data-dashboard-quick-actions/);
    assert.match(html, /data-dashboard-wallets/);
    assert.match(html, /@click="openAdjustmentModal\('cash'\)"/);
    assert.match(html, /@click="openAdjustmentModal\('stock'\)"/);
    assert.match(html, /@click="openReceiptModal\(\)"/);
    assert.match(html, /@click="currentPage = 'closing'; dailyClosingForm\.date = formatDateForInput\(\)"/);
    assert.match(html, /@click="currentPage = 'sync'"/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: FAIL because `data-dashboard-hero`, `data-dashboard-quick-actions`, and `data-dashboard-wallets` are not present.

- [ ] **Step 3: Replace the top dashboard metric grid**

In the dashboard section beginning at `x-show="currentPage === 'dashboard'"`, replace the first metric grid and online wallet block with:

```html
<div data-dashboard-hero class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
    <div class="yolk-surface rounded-[1.75rem] p-5">
        <div class="flex items-start justify-between gap-4">
            <div>
                <p class="text-xs font-black uppercase tracking-[0.16em] text-[#d34036]">Today overview</p>
                <h2 class="mt-2 text-2xl font-black leading-tight text-[#1f2421] dark:text-white">Cash and stock at a glance</h2>
            </div>
            <img src="HEAD.png" alt="YOLK" class="h-14 w-14 object-contain">
        </div>
        <div class="mt-5 grid grid-cols-2 gap-3">
            <div class="rounded-3xl bg-[#1f2421] p-4 text-white">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Cash on Hand</p>
                    <button @click="openAdjustmentModal('cash')" class="yolk-action rounded-full bg-white/12 px-3 py-1 text-[11px] font-black text-white hover:bg-white/20">Edit</button>
                </div>
                <p class="yolk-metric mt-3 text-2xl font-black" x-text="formatPHP(getCashOnHand())"></p>
                <p class="mt-1 text-[11px] font-semibold text-white/55">Cash only, after cash-outs</p>
            </div>
            <div class="rounded-3xl bg-[#fff4ee] p-4 text-[#1f2421] dark:bg-slate-800 dark:text-white">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a6358] dark:text-slate-400">Current Stock</p>
                    <button @click="openAdjustmentModal('stock')" class="yolk-action rounded-full bg-[#d34036]/10 px-3 py-1 text-[11px] font-black text-[#d34036] hover:bg-[#d34036]/15">Edit</button>
                </div>
                <p class="yolk-metric mt-3 text-2xl font-black" x-text="inventory"></p>
                <p class="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Available eggs</p>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
        <div class="yolk-surface rounded-[1.5rem] p-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Net Profit</p>
            <p class="yolk-metric mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400" x-text="formatPHP(getNetProfit())"></p>
            <p class="mt-1 text-[11px] text-slate-500">Revenue minus COGS</p>
        </div>
        <div class="yolk-surface rounded-[1.5rem] p-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Receivable</p>
            <p class="yolk-metric mt-2 text-xl font-black text-amber-600 dark:text-amber-400" x-text="formatPHP(getOutstandingLoans())"></p>
            <p class="mt-1 text-[11px] text-slate-500">Unpaid balance</p>
        </div>
    </div>
</div>

<div data-dashboard-wallets x-show="getWalletBalanceRows().length > 0" class="yolk-surface rounded-[1.75rem] p-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <p class="text-sm font-black text-[#1f2421] dark:text-white">Online Wallets</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">Not Cash on Hand until you cash out.</p>
        </div>
        <button @click="openWalletTransferModal(getWalletBalanceRows()[0]?.account || 'GCash')" class="yolk-action inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d34036] px-4 py-2 text-sm font-black text-white hover:bg-[#b8322b]">
            <i data-lucide="wallet-cards" class="h-4 w-4"></i>
            Cash Out
        </button>
    </div>
    <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <template x-for="wallet in getWalletBalanceRows()" :key="wallet.account">
            <div class="rounded-2xl bg-[#f6f3ee] p-3 dark:bg-white/5">
                <p class="text-xs font-black text-[#1f2421] dark:text-white" x-text="wallet.account"></p>
                <p class="yolk-metric mt-1 text-lg font-black text-[#d34036]" x-text="formatPHP(wallet.balance)"></p>
            </div>
        </template>
    </div>
</div>

<div data-dashboard-quick-actions class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    <button @click="openReceiptModal()" class="yolk-action yolk-surface flex min-h-[72px] flex-col items-start justify-between rounded-3xl p-4 text-left">
        <i data-lucide="receipt-text" class="h-5 w-5 text-[#d34036]"></i>
        <span class="text-sm font-black">Weekly Report</span>
    </button>
    <button @click="currentPage = 'closing'; dailyClosingForm.date = formatDateForInput()" class="yolk-action yolk-surface flex min-h-[72px] flex-col items-start justify-between rounded-3xl p-4 text-left">
        <i data-lucide="calendar-check" class="h-5 w-5 text-[#d34036]"></i>
        <span class="text-sm font-black">Close Day</span>
    </button>
    <button @click="currentPage = 'sales'" class="yolk-action yolk-surface flex min-h-[72px] flex-col items-start justify-between rounded-3xl p-4 text-left">
        <i data-lucide="shopping-bag" class="h-5 w-5 text-[#d34036]"></i>
        <span class="text-sm font-black">Sales</span>
    </button>
    <button @click="currentPage = 'expenses'" class="yolk-action yolk-surface flex min-h-[72px] flex-col items-start justify-between rounded-3xl p-4 text-left">
        <i data-lucide="receipt" class="h-5 w-5 text-[#d34036]"></i>
        <span class="text-sm font-black">Expense</span>
    </button>
    <button @click="openWalletTransferModal(getWalletBalanceRows()[0]?.account || 'GCash')" class="yolk-action yolk-surface flex min-h-[72px] flex-col items-start justify-between rounded-3xl p-4 text-left">
        <i data-lucide="wallet-cards" class="h-5 w-5 text-[#d34036]"></i>
        <span class="text-sm font-black">Cash Out</span>
    </button>
    <button @click="currentPage = 'sync'" class="yolk-action yolk-surface flex min-h-[72px] flex-col items-start justify-between rounded-3xl p-4 text-left">
        <i data-lucide="cloud" class="h-5 w-5 text-[#d34036]"></i>
        <span class="text-sm font-black">Sync</span>
    </button>
</div>
```

- [ ] **Step 4: Keep the record sale and expense forms below the quick actions**

Do not remove the existing `Record Sale` and `Record Expense` forms. Restyle their outer cards in the next pass only if needed, but keep their `x-model` fields and submit handlers exactly as they are.

- [ ] **Step 5: Run the test to verify it passes**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: PASS for dashboard test and existing business tests.

- [ ] **Step 6: Commit**

```powershell
git add index.html tests\manual-adjustments.test.js
git commit -m "Redesign dashboard for mobile ledger"
```

## Task 4: Mobile Ledger Cards for Sales, Customers, and Expenses

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing test**

Add this test after `customer order history edit controls are rendered`:

```js
test('mobile ledger cards render sales customer and expense rows', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /data-mobile-sales-card/);
    assert.match(html, /data-mobile-customer-order-card/);
    assert.match(html, /data-mobile-expense-card/);
    assert.match(html, /class="[^"]*lg:hidden[^"]*data-mobile-sales-list/);
    assert.match(html, /class="[^"]*hidden lg:block[^"]*data-desktop-sales-table/);
    assert.match(html, /getSaleBalance\(sale\)/);
    assert.match(html, /getSalePaymentTotal\(sale\)/);
    assert.match(html, /openPaymentModal\(sale\.id\)/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: FAIL because mobile ledger card markers do not exist.

- [ ] **Step 3: Add a mobile sales list above the desktop sales table**

In the Sales Ledger section, keep the current table for desktop. Wrap its scroll/table container with:

```html
<div data-desktop-sales-table class="hidden lg:block overflow-x-auto">
```

Before that desktop wrapper, add:

```html
<div data-mobile-sales-list class="space-y-3 p-4 lg:hidden">
    <template x-for="sale in sales" :key="sale.id">
        <article data-mobile-sales-card class="yolk-ledger-card rounded-3xl p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="truncate text-base font-black text-[#1f2421] dark:text-white" x-text="sale.customer"></p>
                    <p class="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span x-text="sale.orderDateDisplay || sale.date"></span>
                        <span x-show="sale.paidDateDisplay"> paid <span x-text="sale.paidDateDisplay"></span></span>
                    </p>
                </div>
                <span class="rounded-full px-3 py-1 text-[11px] font-black" :class="getSaleStatus(sale) === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : getSaleStatus(sale) === 'Partial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'" x-text="getSaleStatus(sale)"></span>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div class="rounded-2xl bg-[#f6f3ee] p-3 dark:bg-white/5">
                    <p class="text-slate-500">Eggs</p>
                    <p class="mt-1 font-black" x-text="sale.quantity"></p>
                </div>
                <div class="rounded-2xl bg-[#f6f3ee] p-3 dark:bg-white/5">
                    <p class="text-slate-500">Type</p>
                    <p class="mt-1 font-black" x-text="sale.eggType || 'Large'"></p>
                </div>
                <div class="rounded-2xl bg-[#f6f3ee] p-3 dark:bg-white/5">
                    <p class="text-slate-500">Total</p>
                    <p class="yolk-metric mt-1 font-black" x-text="formatPHP(getSaleTotal(sale))"></p>
                </div>
            </div>
            <div class="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 text-xs dark:bg-white/5">
                <span>Paid <b x-text="formatPHP(getSalePaymentTotal(sale))"></b></span>
                <span>Balance <b x-text="formatPHP(getSaleBalance(sale))"></b></span>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
                <button x-show="isFinancialSale(sale) && getSaleBalance(sale) > 0" @click="openPaymentModal(sale.id)" class="yolk-action inline-flex items-center gap-2 rounded-2xl bg-[#d34036] px-3 py-2 text-xs font-black text-white hover:bg-[#b8322b]">
                    <i data-lucide="badge-plus" class="h-4 w-4"></i>
                    Add Payment
                </button>
                <button @click="removeSale(sale.id)" class="yolk-action inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-300">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                    Remove
                </button>
            </div>
        </article>
    </template>
    <div x-show="sales.length === 0" class="rounded-3xl border border-dashed border-[#e6e0d8] p-6 text-center dark:border-white/10">
        <p class="text-sm font-black text-[#1f2421] dark:text-white">No sales yet</p>
        <p class="mt-1 text-xs text-slate-500">Record a sale from the dashboard to start the ledger.</p>
    </div>
</div>
```

- [ ] **Step 4: Add mobile customer order cards**

In the customer selected-order-history area, add `data-mobile-customer-order-card` to the existing repeated order card if it already uses cards. If it is table-like, wrap each order row in:

```html
<article data-mobile-customer-order-card class="yolk-ledger-card rounded-3xl p-4">
```

Keep existing controls:

```html
@click="openCustomerOrderEditModal(sale.id)"
@click="openPaymentModal(sale.id)"
@click="removeSale(sale.id)"
```

Do not change customer merge, rename, remove, past-order, or payment calculations.

- [ ] **Step 5: Add mobile expense cards above the desktop expense table**

In the Expenses Ledger section, before the existing expenses table/list, add:

```html
<div class="space-y-3 p-4 lg:hidden">
    <template x-for="expense in expenses" :key="expense.id">
        <article data-mobile-expense-card class="yolk-ledger-card rounded-3xl p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="truncate text-base font-black text-[#1f2421] dark:text-white" x-text="expense.category"></p>
                    <p class="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400" x-text="expense.date"></p>
                </div>
                <p class="yolk-metric text-lg font-black text-rose-600 dark:text-rose-400" x-text="formatPHP(expense.amount)"></p>
            </div>
            <p x-show="expense.notes" class="mt-3 rounded-2xl bg-[#f6f3ee] p-3 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300" x-text="expense.notes"></p>
        </article>
    </template>
    <div x-show="expenses.length === 0" class="rounded-3xl border border-dashed border-[#e6e0d8] p-6 text-center dark:border-white/10">
        <p class="text-sm font-black text-[#1f2421] dark:text-white">No expenses yet</p>
        <p class="mt-1 text-xs text-slate-500">Record expenses from the dashboard form.</p>
    </div>
</div>
```

- [ ] **Step 6: Run the test to verify it passes**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: PASS for mobile ledger card tests and all existing behavior tests.

- [ ] **Step 7: Commit**

```powershell
git add index.html tests\manual-adjustments.test.js
git commit -m "Add mobile ledger cards"
```

## Task 5: Weekly Report Sheet Polish

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing test**

Extend the existing `weekly report opens as a modern modal sheet` test with these assertions:

```js
assert.match(html, /data-weekly-report-sheet/);
assert.match(html, /data-weekly-report-summary/);
assert.match(html, /data-weekly-report-sales/);
assert.match(html, /data-weekly-report-expenses/);
assert.match(html, /Export Excel/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: FAIL because the report sheet markers do not exist.

- [ ] **Step 3: Add report sheet data attributes and polished structure**

In the weekly report modal around `x-show="showReceiptModal"`, add `data-weekly-report-sheet` to the main modal panel:

```html
<div data-weekly-report-sheet @click.stop class="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-[2rem] bg-[#f8f5f0] text-[#1f2421] shadow-2xl border border-[#e6e0d8] dark:bg-slate-900 dark:text-slate-100 dark:border-white/10"
```

Add `data-weekly-report-summary` to the summary card grid:

```html
<div data-weekly-report-summary class="grid grid-cols-2 gap-3 lg:grid-cols-3">
```

Add `data-weekly-report-sales` to the sales breakdown section wrapper:

```html
<div data-weekly-report-sales class="overflow-hidden rounded-3xl border border-[#e6e0d8] bg-white/80 dark:border-white/10 dark:bg-white/5">
```

Add `data-weekly-report-expenses` to the expenses breakdown section wrapper:

```html
<div data-weekly-report-expenses class="overflow-hidden rounded-3xl border border-[#e6e0d8] bg-white/80 dark:border-white/10 dark:bg-white/5">
```

Ensure the export button visible text is:

```html
Export Excel
```

Do not change `generateReceipt()`, `getWeeklyData()`, or `exportToExcel()` calculations in this task.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: PASS for report sheet tests and existing behavior tests.

- [ ] **Step 5: Commit**

```powershell
git add index.html tests\manual-adjustments.test.js
git commit -m "Polish weekly report sheet"
```

## Task 6: Final Consistency, Cache Bump, and Verification

**Files:**
- Modify: `service-worker.js`
- Optional Modify: `index.html`
- Optional Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Run the full focused test suite**

Run:

```powershell
node --test tests\manual-adjustments.test.js
```

Expected: 0 failures. If a test fails, fix the app or the test according to the behavior being protected. Do not delete business behavior tests.

- [ ] **Step 2: Check JavaScript syntax for service worker**

Run:

```powershell
node --check service-worker.js
```

Expected: exit code 0 with no output.

- [ ] **Step 3: Bump service worker cache**

In `service-worker.js`, change the cache version by one. If the current line is:

```js
const CACHE_NAME = 'egg-inventory-cache-v18';
```

change it to:

```js
const CACHE_NAME = 'egg-inventory-cache-v19';
```

If the existing version is already higher, increment that number by one instead.

- [ ] **Step 4: Run syntax and whitespace checks**

Run:

```powershell
node --check service-worker.js
git diff --check
```

Expected: `node --check` exits 0 and `git diff --check` exits 0. Line-ending warnings are acceptable only if the exit code is 0 and there are no whitespace errors.

- [ ] **Step 5: Run a browser check if available**

If the Browser plugin runtime is available, open the app in the browser and inspect:

```text
http://localhost:<port>
```

Verify:

- Light mode loads by default.
- Bottom navigation shows Home, People, Close, Sales, More.
- More opens Expenses Ledger, Manual Adjustments, and Cloud Sync.
- Dashboard cards do not overlap on iPhone-size width.
- Sales Ledger mobile cards show Add Payment and Remove where applicable.
- Weekly Report opens as a bottom sheet on mobile.

If the Browser plugin runtime is unavailable, state that in the final response and rely on automated tests plus manual browser instructions.

- [ ] **Step 6: Final commit**

```powershell
git add index.html service-worker.js tests/manual-adjustments.test.js
git commit -m "Finish mobile ledger redesign"
```

## Self-Review Checklist

- Spec coverage:
  - Shared shell: Task 2.
  - Mobile bottom navigation and More menu: Task 1.
  - Dashboard redesign: Task 3.
  - Mobile ledger cards: Task 4.
  - Weekly report sheet: Task 5.
  - Cache and verification: Task 6.
- Deferred-work scan:
  - No unfinished markers or shortcut instructions are used.
- Type and name consistency:
  - Navigation state is consistently `showMobileMoreMenu`.
  - Navigation helper is consistently `setCurrentPage(page)`.
  - More helper is consistently `isMorePage()`.
  - Data markers are consistently `data-dashboard-*`, `data-mobile-*`, and `data-weekly-report-*`.
