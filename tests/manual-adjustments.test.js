const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'manifest.json');
const serviceWorkerPath = path.join(rootDir, 'service-worker.js');
const syncConfigPath = path.join(rootDir, 'sync-config.js');

function createStorage(initial = {}) {
    const store = { ...initial };
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
        },
        setItem(key, value) {
            store[key] = String(value);
        },
        removeItem(key) {
            delete store[key];
        }
    };
}

function loadEggApp(storage = createStorage()) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    const script = scripts
        .map(match => match[1])
        .find(content => content.includes('function eggApp()'));
    const context = {
        localStorage: storage,
        alert() {},
        confirm() {
            return true;
        },
        console,
        Date
    };

    vm.createContext(context);
    vm.runInContext(script, context);

    return context.eggApp();
}

test('manual cash adjustment sets cash on hand by storing the difference', () => {
    const app = loadEggApp();
    app.sales = [
        { quantity: 2, unitPrice: 250, paid: true }
    ];
    app.expenses = [
        { amount: 100, category: 'Transportation' }
    ];

    assert.equal(app.getCashOnHand(), 400);

    app.openAdjustmentModal('cash');
    app.adjustmentModal.value = 650;
    app.adjustmentModal.note = 'Emergency cash added';

    assert.equal(app.saveAdjustment(), true);
    assert.equal(app.getCashOnHand(), 650);
    assert.equal(app.cashAdjustments.length, 1);
    assert.equal(app.cashAdjustments[0].difference, 250);
    assert.equal(app.cashAdjustments[0].note, 'Emergency cash added');
});

test('manual stock adjustment sets inventory directly', () => {
    const app = loadEggApp();
    app.inventory = 100;

    app.openAdjustmentModal('stock');
    app.adjustmentModal.value = 72;
    app.adjustmentModal.note = 'Cracked tray';

    assert.equal(app.saveAdjustment(), true);
    assert.equal(app.inventory, 72);
    assert.equal(app.stockAdjustments.length, 1);
    assert.equal(app.stockAdjustments[0].oldValue, 100);
    assert.equal(app.stockAdjustments[0].newValue, 72);
    assert.equal(app.stockAdjustments[0].difference, -28);
});

test('adjustments persist in egg_app_data', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);

    app.openAdjustmentModal('cash');
    app.adjustmentModal.value = 125;
    app.saveAdjustment();

    app.openAdjustmentModal('stock');
    app.adjustmentModal.value = 90;
    app.saveAdjustment();

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.cashAdjustments.length, 1);
    assert.equal(savedData.stockAdjustments.length, 1);
});

test('invalid stock values are rejected without changing inventory', () => {
    const app = loadEggApp();
    app.inventory = 100;

    app.openAdjustmentModal('stock');
    app.adjustmentModal.value = -1;

    assert.equal(app.saveAdjustment(), false);
    assert.equal(app.inventory, 100);
    assert.equal(app.stockAdjustments.length, 0);
});

test('saved zero inventory loads as zero', () => {
    const storage = createStorage({
        egg_app_data: JSON.stringify({
            inventory: 0,
            sales: [],
            expenses: [],
            config: { regularPrice: 250, loanPrice: 270 }
        })
    });
    const app = loadEggApp(storage);

    app.init();

    assert.equal(app.inventory, 0);
});

test('expense category field is editable with built-in suggestions', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /<input[^>]+x-model="expenseForm\.category"[^>]+list="expense-category-options"/);
    assert.match(html, /<datalist id="expense-category-options">/);
    assert.doesNotMatch(html, /<select x-model="expenseForm\.category"/);
});

test('sale form has editable order date and paid date ledger columns', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /<input[^>]+type="date"[^>]+x-model="saleForm\.orderDate"/);
    assert.match(html, /<th class="pb-2">Order Date<\/th>/);
    assert.match(html, /<th class="pb-2">Paid Date<\/th>/);
});

test('regular sale uses editable order date as order and paid date', () => {
    const app = loadEggApp();
    app.inventory = 100;
    app.saleForm.customer = 'Date Test';
    app.saleForm.quantity = 3;
    app.saleForm.type = 'Regular';
    app.saleForm.unitPrice = 250;
    app.saleForm.orderDate = '2026-05-01';

    app.submitSale();

    assert.equal(app.sales[0].orderDate, '2026-05-01');
    assert.equal(app.sales[0].paidDate, '2026-05-01');
    assert.equal(app.sales[0].dateDisplay, 'May 1');
    assert.equal(app.sales[0].paidDateDisplay, 'May 1');
});

test('loaned sale stores order date and gets paid date when collected', () => {
    const app = loadEggApp();
    app.inventory = 100;
    app.saleForm.customer = 'Loan Date Test';
    app.saleForm.quantity = 1;
    app.saleForm.type = 'Loaned';
    app.saleForm.unitPrice = 270;
    app.saleForm.orderDate = '2026-05-02';

    app.submitSale();

    assert.equal(app.sales[0].orderDate, '2026-05-02');
    assert.equal(app.sales[0].paidDate, '');
    assert.equal(app.sales[0].paidDateDisplay, '');

    app.collectLoan(app.sales[0].id);

    assert.equal(app.sales[0].paid, true);
    assert.match(app.sales[0].paidDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.notEqual(app.sales[0].paidDateDisplay, '');
});

test('app shell separates dashboard, ledgers, and adjustments into pages', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = loadEggApp();

    assert.equal(app.currentPage, 'dashboard');
    assert.match(html, /@click="currentPage = 'dashboard'"/);
    assert.match(html, /@click="currentPage = 'customers'"/);
    assert.match(html, /@click="currentPage = 'sales'"/);
    assert.match(html, /@click="currentPage = 'expenses'"/);
    assert.match(html, /@click="currentPage = 'adjustments'"/);
    assert.match(html, /x-show="currentPage === 'dashboard'"/);
    assert.match(html, /x-show="currentPage === 'customers'"/);
    assert.match(html, /x-show="currentPage === 'sales'"/);
    assert.match(html, /x-show="currentPage === 'expenses'"/);
    assert.match(html, /x-show="currentPage === 'adjustments'"/);
});

test('mobile navigation uses a fixed bottom tab bar with icons', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = loadEggApp();

    assert.equal(typeof app.mobileBottomNavItemClass, 'function');
    assert.equal(typeof app.mobileBottomNavIconClass, 'function');
    assert.match(html, /aria-label="Mobile bottom navigation"/);
    assert.match(html, /fixed inset-x-0 bottom-0/);
    assert.match(html, /pb-\[calc\(env\(safe-area-inset-bottom\)\+0\.75rem\)\]/);
    assert.match(html, /data-lucide="layout-dashboard"/);
    assert.match(html, /data-lucide="users"/);
    assert.match(html, /data-lucide="shopping-bag"/);
    assert.match(html, /data-lucide="receipt-text"/);
    assert.match(html, /data-lucide="sliders-horizontal"/);
    assert.match(html, /data-lucide="cloud"/);
    assert.match(html, /<main class="[^"]*pb-28/);
    assert.doesNotMatch(html, /lg:hidden grid grid-cols-2 sm:grid-cols-5/);
});

test('customer summaries group sales and calculate unpaid loan balances', () => {
    const app = loadEggApp();
    app.sales = [
        { id: 1, customer: 'Ana', quantity: 2, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-01', paidDate: '2026-05-01' },
        { id: 2, customer: ' Ana ', quantity: 1, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-05-03', paidDate: '' },
        { id: 3, customer: 'Ben', quantity: 3, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-05-02', paidDate: '' },
        { id: 4, customer: 'Ben', quantity: 1, unitPrice: 270, type: 'Loaned', paid: true, orderDate: '2026-05-01', paidDate: '2026-05-04' }
    ];

    const summaries = app.getCustomerSummaries();
    const ana = summaries.find(customer => customer.key === 'ana');
    const ben = summaries.find(customer => customer.key === 'ben');

    assert.equal(summaries.length, 2);
    assert.equal(ana.name, 'Ana');
    assert.equal(ana.orderCount, 2);
    assert.equal(ana.totalQuantity, 3);
    assert.equal(ana.totalValue, 770);
    assert.equal(ana.unpaidAmount, 270);
    assert.equal(ana.unpaidCount, 1);
    assert.equal(ana.lastOrderDateDisplay, 'May 3');
    assert.equal(ben.unpaidAmount, 810);
    assert.equal(ben.lastPaidDateDisplay, 'May 4');
});

test('customer search selects customers and collects one loan from customer page', () => {
    const app = loadEggApp();
    app.sales = [
        { id: 10, customer: 'Ana', quantity: 1, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-05-03', paidDate: '' },
        { id: 11, customer: 'Ben', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-02', paidDate: '2026-05-02' }
    ];

    app.customerSearch = 'ana';
    assert.equal(app.getFilteredCustomerSummaries().length, 1);
    app.selectCustomer('ana');

    assert.equal(app.getSelectedCustomerSummary().name, 'Ana');
    assert.equal(app.getSelectedCustomerSummary().unpaidAmount, 270);

    assert.equal(app.collectCustomerLoan(10), true);
    assert.equal(app.sales[0].paid, true);
    assert.match(app.sales[0].paidDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(app.getSelectedCustomerSummary().unpaidAmount, 0);
});

test('dashboard includes a customer loan reminder shortcut', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /Loan Follow-up/);
    assert.match(html, /getCustomersWithOpenLoans\(\)\.length/);
    assert.match(html, /@click="currentPage = 'customers'"/);
});

test('weekly report opens as a modern modal sheet', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = loadEggApp();

    assert.equal(typeof app.openReceiptModal, 'function');
    app.openReceiptModal();
    assert.equal(app.showReceiptModal, true);
    assert.match(html, /@click="openReceiptModal\(\)"/);
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /items-end sm:items-center/);
    assert.match(html, /rounded-t-3xl sm:rounded-3xl/);
    assert.match(html, /x-transition:enter="[^"]*duration-300/);
    assert.match(html, /Weekly Performance/);
    assert.match(html, /Revenue/);
    assert.match(html, /Net Profit/);
    assert.match(html, /Sales Activity/);
    assert.match(html, /Expense Activity/);
    assert.doesNotMatch(html, /fixed left-0 top-0 h-screen w-96/);
    assert.doesNotMatch(html, /border-dashed/);
});

test('app shell defaults to light mode and keeps dark mode opt-in', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = loadEggApp(createStorage());

    app.init();

    assert.equal(app.darkMode, false);
    assert.match(html, /<body class="bg-slate-50 text-slate-900[^"]*dark:bg-slate-950/);
    assert.doesNotMatch(html, /<body class="bg-slate-950 text-slate-100/);
    assert.match(html, /<aside class="[^"]*bg-white[^"]*dark:bg-slate-950/);
});

test('app shows a jumping HEAD loading screen on startup', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = loadEggApp(createStorage());

    assert.equal(app.isLoading, true);
    assert.equal(app.isLoadingExit, false);
    assert.match(html, /id="app-loading-screen"/);
    assert.match(html, /src="HEAD\.png"/);
    assert.match(html, /class="[^"]*loading-logo-bounce/);
    assert.match(html, /@keyframes yolkJump/);
    assert.match(html, /@keyframes yolkSwallow/);
    assert.match(html, /@keyframes yolkCenterSwallow/);
    assert.match(html, /animation:\s*yolkJump[^;]+5 forwards;/);
    assert.match(html, /class="[^"]*loading-logo-stage/);
    assert.match(html, /class="[^"]*loading-red-swallow/);
    assert.match(html, /loading-red-swallow-active/);
    assert.match(html, /top:\s*50%;/);
    assert.match(html, /left:\s*50%;/);
    assert.match(html, /translate\(-50%, -50%\) scale\(0\)/);
    assert.match(html, /loading-logo-swallow/);
    assert.match(html, /isLoadingExit = true/);
    assert.match(html, /finishLoadingScreen\(\)/);
});

test('app includes install files and registers the service worker', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');

    assert.equal(manifest.name, 'YOLK Inventory');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, './index.html');
    assert.ok(manifest.icons.some(icon => icon.src === 'YOLK..png' && icon.purpose.includes('any')));
    assert.match(html, /<link rel="manifest" href="manifest\.json">/);
    assert.match(html, /<link rel="apple-touch-icon" href="YOLK\.\.png">/);
    assert.match(html, /navigator\.serviceWorker\.register\('service-worker\.js'\)/);
    assert.match(serviceWorker, /egg-inventory-cache-v/);
    assert.match(serviceWorker, /sync-config\.js/);
    assert.match(serviceWorker, /event\.request\.mode === 'navigate'/);
    assert.match(serviceWorker, /fetch\(event\.request\)\.then\(response =>/);
});

test('app exposes a sync page wired to Supabase configuration', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const syncConfig = fs.readFileSync(syncConfigPath, 'utf8');
    const app = loadEggApp();

    assert.equal(app.syncForm.email, '');
    assert.equal(app.syncStatus, 'not-configured');
    assert.equal(app.isSyncConfigured(), false);
    assert.match(html, /<script src="sync-config\.js"><\/script>/);
    assert.match(html, /@click="currentPage = 'sync'"/);
    assert.match(html, /x-show="currentPage === 'sync'"/);
    assert.match(html, /supabase-js@2/);
    assert.match(syncConfig, /window\.YOLK_SYNC_CONFIG/);
    assert.match(syncConfig, /tableName:\s*'egg_app_state'/);
});

test('persistable sync state contains all business data', () => {
    const app = loadEggApp();
    app.inventory = 42;
    app.sales = [{ id: 1, customer: 'Ana' }];
    app.expenses = [{ id: 2, category: 'Tithing', amount: 150 }];
    app.cashAdjustments = [{ id: 3, difference: 200 }];
    app.stockAdjustments = [{ id: 4, difference: -30 }];

    const data = app.getPersistableState();

    assert.equal(data.inventory, 42);
    assert.deepEqual(data.sales, app.sales);
    assert.deepEqual(data.expenses, app.expenses);
    assert.deepEqual(data.cashAdjustments, app.cashAdjustments);
    assert.deepEqual(data.stockAdjustments, app.stockAdjustments);
    assert.deepEqual(data.config, app.config);
});
