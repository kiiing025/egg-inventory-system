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

    app.showMobileMoreMenu = true;
    app.setCurrentPage('expenses');
    assert.equal(app.currentPage, 'expenses');
    assert.equal(app.showMobileMoreMenu, false);
    assert.equal(app.isMorePage(), true);
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

test('customer book sorts customer names alphabetically', () => {
    const app = loadEggApp();
    app.sales = [
        { id: 12, customer: 'Ben', quantity: 1, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-05-03', paidDate: '' },
        { id: 13, customer: 'Ana', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-02', paidDate: '2026-05-02' },
        { id: 14, customer: 'Chandra', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-01', paidDate: '2026-05-01' }
    ];

    assert.equal(app.getCustomerSummaries().map(customer => customer.name).join('|'), 'Ana|Ben|Chandra');
});

test('customer book can rename a customer and merge misspelled names', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.sales = [
        { id: 20, customer: 'Chandra', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-01', paidDate: '2026-05-01' },
        { id: 21, customer: 'Chanda', quantity: 1, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-05-03', paidDate: '' },
        { id: 22, customer: 'Ana', quantity: 2, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-02', paidDate: '2026-05-02' }
    ];

    app.selectCustomer('chanda');
    assert.equal(app.openCustomerEdit(app.getSelectedCustomerSummary()), true);
    assert.equal(app.customerEditForm.open, true);
    assert.equal(app.customerEditForm.originalName, 'Chanda');

    app.customerEditForm.newName = ' Chandra ';
    assert.equal(app.saveCustomerName(), true);

    assert.equal(app.sales.find(sale => sale.id === 20).customer, 'Chandra');
    assert.equal(app.sales.find(sale => sale.id === 21).customer, 'Chandra');
    assert.equal(app.sales.find(sale => sale.id === 22).customer, 'Ana');
    assert.equal(app.customerEditForm.open, false);
    assert.equal(app.selectedCustomerKey, 'chandra');

    const summaries = app.getCustomerSummaries();
    const chandra = summaries.find(customer => customer.key === 'chandra');
    assert.equal(summaries.length, 2);
    assert.equal(chandra.orderCount, 2);
    assert.equal(chandra.totalQuantity, 2);
    assert.equal(chandra.unpaidAmount, 270);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.sales.find(sale => sale.id === 21).customer, 'Chandra');
});

test('customer rename keeps older imported history out of cash totals', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.applyPersistedState({
        inventory: 100,
        sales: [
            {
                id: 2201,
                customer: 'Chandra',
                quantity: 1,
                unitPrice: 270,
                type: 'Loaned',
                paid: true,
                orderDate: '2026-04-20',
                paidDate: '2026-05-06'
            },
            {
                id: 2202,
                customer: 'Chanda',
                quantity: 3,
                unitPrice: 250,
                type: 'Regular',
                paid: true,
                orderDate: '2026-04-07',
                paidDate: '2026-04-07'
            }
        ],
        expenses: [],
        cashAdjustments: [],
        stockAdjustments: [],
        dailyClosings: []
    });

    assert.equal(app.getCashOnHand(), 0);

    app.selectCustomer('chandra');
    assert.equal(app.openCustomerEdit(app.getSelectedCustomerSummary()), true);
    app.customerEditForm.newName = 'Chanda';

    assert.equal(app.saveCustomerName(), true);
    assert.equal(app.getCashOnHand(), 0);
    assert.equal(app.sales.every(sale => sale.customer === 'Chanda'), true);
    assert.equal(app.sales.every(sale => sale.historyOnly === true), true);
    assert.equal(app.sales.every(sale => sale.affectsCash === false), true);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.sales.every(sale => sale.customer === 'Chanda'), true);
    assert.equal(savedData.sales.every(sale => sale.historyOnly === true), true);
    assert.equal(savedData.sales.every(sale => sale.affectsCash === false), true);
});

test('customer book can remove a customer without changing current stock', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.inventory = 44;
    app.sales = [
        { id: 23, customer: 'Chandra', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-01', paidDate: '2026-05-01' },
        { id: 24, customer: 'Chandra', quantity: 2, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-05-02', paidDate: '' },
        { id: 25, customer: 'Ana', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-03', paidDate: '2026-05-03' }
    ];

    app.selectCustomer('chandra');
    assert.equal(app.removeSelectedCustomer(), true);

    assert.equal(app.inventory, 44);
    assert.equal(app.sales.length, 1);
    assert.equal(app.sales[0].customer, 'Ana');
    assert.equal(app.selectedCustomerKey, '');
    assert.equal(app.getCustomerSummaries().length, 1);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.inventory, 44);
    assert.equal(savedData.sales.length, 1);
    assert.equal(savedData.sales[0].customer, 'Ana');
});

test('customer book edit controls are rendered', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /Edit Name/);
    assert.match(html, /Remove Customer/);
    assert.match(html, /customerEditForm\.open/);
    assert.match(html, /@click="openCustomerEdit\(getSelectedCustomerSummary\(\)\)"/);
    assert.match(html, /@click="removeSelectedCustomer\(\)"/);
});

test('customer order history can edit an order without changing current stock', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.inventory = 88;
    app.sales = [
        {
            id: 30,
            customer: 'Chandra',
            quantity: 1,
            unitPrice: 250,
            type: 'Regular',
            paid: true,
            orderDate: '2026-05-01',
            orderDateDisplay: 'May 1',
            paidDate: '2026-05-01',
            paidDateDisplay: 'May 1'
        }
    ];

    assert.equal(app.openCustomerOrderEdit(30), true);
    assert.equal(app.customerOrderEditForm.open, true);
    assert.equal(app.customerOrderEditForm.quantity, 1);

    app.customerOrderEditForm.quantity = 3;
    app.customerOrderEditForm.type = 'Loaned';
    app.customerOrderEditForm.unitPrice = 270;
    app.customerOrderEditForm.orderDate = '2026-04-20';
    app.customerOrderEditForm.paid = false;
    app.customerOrderEditForm.paidDate = '';

    assert.equal(app.saveCustomerOrderEdit(), true);

    const sale = app.sales.find(record => record.id === 30);
    assert.equal(app.inventory, 88);
    assert.equal(sale.quantity, 3);
    assert.equal(sale.type, 'Loaned');
    assert.equal(sale.unitPrice, 270);
    assert.equal(sale.orderDate, '2026-04-20');
    assert.equal(sale.orderDateDisplay, 'Apr 20');
    assert.equal(sale.paid, false);
    assert.equal(sale.paidDate, '');
    assert.equal(sale.paidDateDisplay, '');
    assert.equal(app.getSelectedCustomerSummary().unpaidAmount, 810);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.inventory, 88);
    assert.equal(savedData.sales[0].quantity, 3);
});

test('customer order history edit controls are rendered', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /Edit Order/);
    assert.match(html, /customerOrderEditForm\.open/);
    assert.match(html, /@click="openCustomerOrderEdit\(sale\.id\)"/);
});

test('mobile ledger cards render sales customer and expense rows', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /data-mobile-sales-list/);
    assert.match(html, /data-mobile-sales-card/);
    assert.match(html, /data-mobile-customer-order-card/);
    assert.match(html, /data-mobile-expense-card/);
    assert.match(html, /data-desktop-sales-table/);
    assert.match(html, /getSaleBalance\(sale\)/);
    assert.match(html, /getSalePaymentTotal\(sale\)/);
    assert.match(html, /openPaymentModal\(sale\.id\)/);
});

test('past customer order can be added without changing financial or stock totals', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.inventory = 44;
    app.sales = [
        { id: 30, customer: 'Ana', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-01', paidDate: '2026-06-01' },
        { id: 31, customer: 'Ben', quantity: 1, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-06-01', paidDate: '' }
    ];
    app.expenses = [
        { id: 32, category: 'Restocking Cost', amount: 100, date: '2026-06-01' }
    ];

    const beforeCash = app.getCashOnHand();
    const beforeProfit = app.getNetProfit();
    const beforeReceivable = app.getOutstandingLoans();
    const beforeStock = app.inventory;

    assert.equal(app.openPastOrderModal('Chanda'), true);
    app.pastOrderForm.customer = 'Chanda';
    app.pastOrderForm.orderDate = '2026-04-20';
    app.pastOrderForm.paid = false;
    app.pastOrderForm.paidDate = '';
    app.pastOrderForm.quantity = 3;
    app.pastOrderForm.type = 'Loaned';
    app.pastOrderForm.unitPrice = 270;
    app.pastOrderForm.paymentMethod = 'GCash';

    assert.equal(app.savePastOrder(), true);

    const pastOrder = app.sales[0];
    assert.equal(pastOrder.customer, 'Chanda');
    assert.equal(pastOrder.historyOnly, true);
    assert.equal(pastOrder.affectsCash, false);
    assert.equal(pastOrder.paymentMethod, 'GCash');
    assert.equal(app.getCashOnHand(), beforeCash);
    assert.equal(app.getNetProfit(), beforeProfit);
    assert.equal(app.getOutstandingLoans(), beforeReceivable);
    assert.equal(app.inventory, beforeStock);
    assert.equal(app.getDailyClosingSummary('2026-04-20').salesRevenue, 0);

    const chanda = app.getCustomerSummaries().find(customer => customer.key === 'chanda');
    assert.equal(chanda.orderCount, 1);
    assert.equal(chanda.unpaidAmount, 0);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.sales[0].historyOnly, true);
    assert.equal(savedData.sales[0].affectsCash, false);
    assert.equal(savedData.sales[0].paymentMethod, 'GCash');
});

test('customer order edit can update online payment tag', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.sales = [
        {
            id: 33,
            customer: 'Chanda',
            quantity: 1,
            unitPrice: 250,
            type: 'Regular',
            paid: true,
            orderDate: '2026-04-20',
            paidDate: '2026-04-20',
            historyOnly: true,
            affectsCash: false
        }
    ];

    assert.equal(app.openCustomerOrderEdit(33), true);
    app.customerOrderEditForm.paymentMethod = 'GoTyme';

    assert.equal(app.saveCustomerOrderEdit(), true);
    assert.equal(app.sales[0].paymentMethod, 'GoTyme');

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.sales[0].paymentMethod, 'GoTyme');
});

test('deleting a history-only order does not change current stock', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.inventory = 44;
    app.sales = [
        { id: 34, customer: 'Chanda', quantity: 3, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-04-20', paidDate: '', historyOnly: true, affectsCash: false },
        { id: 35, customer: 'Ana', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-06-01', paidDate: '2026-06-01' }
    ];

    app.deleteSale(34);

    assert.equal(app.inventory, 44);
    assert.equal(app.sales.length, 1);
    assert.equal(app.sales[0].customer, 'Ana');
});

test('past order controls and payment tags are rendered', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /Add Past Order/);
    assert.match(html, /pastOrderForm\.open/);
    assert.match(html, /@click="openPastOrderModal/);
    assert.match(html, /x-model="pastOrderForm\.paymentMethod"/);
    assert.match(html, /x-model="customerOrderEditForm\.paymentMethod"/);
    assert.match(html, /History Only/);
    assert.match(html, /paymentMethod/);
});

test('partial online payment reduces receivable without changing cash on hand', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.inventory = 100;
    app.sales = [
        { id: 40, customer: 'Chanda', quantity: 3, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-06-10', paidDate: '' }
    ];

    assert.equal(app.getCashOnHand(), 0);
    assert.equal(app.getOutstandingLoans(), 810);
    assert.equal(app.openPaymentModal(40), true);
    app.paymentForm.amount = 400;
    app.paymentForm.account = 'GCash';
    app.paymentForm.date = '2026-06-12';

    assert.equal(app.savePayment(), true);

    const sale = app.sales[0];
    assert.equal(sale.paid, false);
    assert.equal(sale.paidDate, '');
    assert.equal(sale.payments.length, 1);
    assert.equal(sale.payments[0].amount, 400);
    assert.equal(sale.payments[0].account, 'GCash');
    assert.equal(app.getSalePaymentTotal(sale), 400);
    assert.equal(app.getSaleBalance(sale), 410);
    assert.equal(app.getSaleStatus(sale), 'Partially Paid');
    assert.equal(app.getOutstandingLoans(), 410);
    assert.equal(app.getCashOnHand(), 0);
    assert.equal(app.getWalletBalances().GCash, 400);
    assert.equal(app.inventory, 100);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.sales[0].payments[0].account, 'GCash');
});

test('cash out moves wallet balance into cash on hand', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.sales = [
        {
            id: 41,
            customer: 'Chanda',
            quantity: 2,
            unitPrice: 270,
            type: 'Loaned',
            paid: false,
            orderDate: '2026-06-10',
            paidDate: '',
            payments: [{ id: 1, date: '2026-06-12', amount: 400, account: 'GCash', note: '' }]
        }
    ];

    assert.equal(app.getCashOnHand(), 0);
    assert.equal(app.getWalletBalances().GCash, 400);
    assert.equal(app.openWalletTransferModal('GCash'), true);
    app.walletTransferForm.amount = 250;
    app.walletTransferForm.date = '2026-06-12';

    assert.equal(app.saveWalletTransfer(), true);
    assert.equal(app.getCashOnHand(), 250);
    assert.equal(app.getWalletBalances().GCash, 150);
    assert.equal(app.walletTransfers.length, 1);
    assert.equal(app.walletTransfers[0].account, 'GCash');

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.walletTransfers[0].amount, 250);
});

test('cash payment adds to cash and completes loan when balance is paid', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.sales = [
        { id: 42, customer: 'Chanda', quantity: 3, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-06-10', paidDate: '' }
    ];

    assert.equal(app.openPaymentModal(42), true);
    app.paymentForm.amount = 810;
    app.paymentForm.account = 'Cash';
    app.paymentForm.date = '2026-06-12';

    assert.equal(app.savePayment(), true);
    assert.equal(app.sales[0].paid, true);
    assert.equal(app.sales[0].paidDate, '2026-06-12');
    assert.equal(app.getOutstandingLoans(), 0);
    assert.equal(app.getCashOnHand(), 810);
});

test('regular sale paid online goes to wallet instead of cash on hand', () => {
    const app = loadEggApp();
    app.inventory = 10;
    app.saleForm.customer = 'Online Buyer';
    app.saleForm.quantity = 1;
    app.saleForm.type = 'Regular';
    app.saleForm.unitPrice = 250;
    app.saleForm.orderDate = '2026-06-12';
    app.saleForm.paymentAccount = 'GCash';

    app.submitSale();

    assert.equal(app.inventory, 9);
    assert.equal(app.sales[0].paid, true);
    assert.equal(app.sales[0].payments[0].account, 'GCash');
    assert.equal(app.getOutstandingLoans(), 0);
    assert.equal(app.getCashOnHand(), 0);
    assert.equal(app.getWalletBalances().GCash, 250);
});

test('partial payment and wallet controls are rendered', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /Add Payment/);
    assert.match(html, /paymentForm\.open/);
    assert.match(html, /x-model(?:\.number)?="paymentForm\.amount"/);
    assert.match(html, /x-model="paymentForm\.account"/);
    assert.match(html, /Cash Out/);
    assert.match(html, /walletTransferForm\.open/);
    assert.match(html, /x-model="saleForm\.paymentAccount"/);
    assert.match(html, /getWalletBalances/);
});

test('dashboard includes a customer loan reminder shortcut', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /Loan Follow-up/);
    assert.match(html, /getCustomersWithOpenLoans\(\)\.length/);
    assert.match(html, /@click="currentPage = 'customers'"/);
});

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

test('daily closing page and dashboard shortcut are rendered', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /@click="currentPage = 'closing'"/);
    assert.match(html, /x-show="currentPage === 'closing'"/);
    assert.match(html, /Daily Closing/);
    assert.match(html, /Save Closing/);
    assert.match(html, /Closing History/);
});

test('daily closing summary calculates selected day totals', () => {
    const app = loadEggApp();
    app.inventory = 42;
    app.sales = [
        { id: 1, customer: 'Ana', quantity: 2, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-25', paidDate: '2026-05-25' },
        { id: 2, customer: 'Ben', quantity: 1, unitPrice: 270, type: 'Loaned', paid: false, orderDate: '2026-05-25', paidDate: '' },
        { id: 3, customer: 'Cora', quantity: 3, unitPrice: 270, type: 'Loaned', paid: true, orderDate: '2026-05-20', paidDate: '2026-05-25' }
    ];
    app.expenses = [
        { id: 4, date: 'May 25', category: 'Transportation', amount: 150 },
        { id: 5, date: 'May 24', category: 'Feed Supplies', amount: 200 }
    ];

    const summary = app.getDailyClosingSummary('2026-05-25');

    assert.equal(summary.date, '2026-05-25');
    assert.equal(summary.dateDisplay, 'May 25');
    assert.equal(summary.orderCount, 2);
    assert.equal(summary.eggsSold, 3);
    assert.equal(summary.salesRevenue, 770);
    assert.equal(summary.collectedRevenue, 1310);
    assert.equal(summary.expenseTotal, 150);
    assert.equal(summary.netCashChange, 1160);
    assert.equal(summary.outstandingLoans, 270);
    assert.equal(summary.cashOnHand, 960);
    assert.equal(summary.stockOnHand, 42);
});

test('saving daily closing creates and updates one snapshot per date', () => {
    const app = loadEggApp();
    app.inventory = 50;
    app.sales = [
        { id: 1, customer: 'Ana', quantity: 1, unitPrice: 250, type: 'Regular', paid: true, orderDate: '2026-05-25', paidDate: '2026-05-25' }
    ];
    app.expenses = [];
    app.dailyClosingForm.date = '2026-05-25';
    app.dailyClosingForm.notes = 'Checked drawer';

    assert.equal(app.saveDailyClosing(), true);
    assert.equal(app.dailyClosings.length, 1);
    assert.equal(app.dailyClosings[0].date, '2026-05-25');
    assert.equal(app.dailyClosings[0].notes, 'Checked drawer');
    assert.equal(app.dailyClosings[0].salesRevenue, 250);
    assert.equal(app.dailyClosings[0].stockOnHand, 50);

    app.inventory = 45;
    app.dailyClosingForm.notes = 'Updated after recount';

    assert.equal(app.saveDailyClosing(), true);
    assert.equal(app.dailyClosings.length, 1);
    assert.equal(app.dailyClosings[0].notes, 'Updated after recount');
    assert.equal(app.dailyClosings[0].stockOnHand, 45);
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
    assert.match(html, /data-weekly-report-sheet/);
    assert.match(html, /data-weekly-report-summary/);
    assert.match(html, /data-weekly-report-sales/);
    assert.match(html, /data-weekly-report-expenses/);
    assert.match(html, /Revenue/);
    assert.match(html, /Net Profit/);
    assert.match(html, /Sales Activity/);
    assert.match(html, /Expense Activity/);
    assert.match(html, /@click="exportToExcel\(\)"/);
    assert.match(html, /Export Excel/);
    assert.doesNotMatch(html, /fixed left-0 top-0 h-screen w-96/);
});

test('app shell defaults to light mode and keeps dark mode opt-in', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const app = loadEggApp(createStorage());

    app.init();

    assert.equal(app.darkMode, false);
    assert.match(html, /<body data-yolk-shell class="yolk-app-bg[^"]*dark:text-slate-100/);
    assert.doesNotMatch(html, /<body class="bg-slate-950 text-slate-100/);
    assert.match(html, /<aside class="[^"]*bg-\[#fbfaf7\][^"]*dark:bg-slate-950/);
});

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

test('operations desk redesign adds command center and work queues', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /data-ops-command-center/);
    assert.match(html, /data-ops-priority-rail/);
    assert.match(html, /data-ops-work-queue/);
    assert.match(html, /data-ops-entry-grid/);
    assert.match(html, /\.ops-panel/);
    assert.match(html, /\.ops-kpi/);
    assert.match(html, /Operations desk/);
    assert.match(html, /Today\'s work queue/);
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

test('sync metadata tracks unsynced local changes', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);

    assert.equal(app.syncPendingChanges, false);
    assert.equal(app.markLocalSyncChange(), true);
    assert.equal(app.syncPendingChanges, true);
    assert.match(app.syncLastLocalChangeAt, /^\d{1,2}\/\d{1,2}\/\d{4}/);

    const meta = JSON.parse(storage.getItem('egg_sync_meta'));
    assert.equal(meta.syncPendingChanges, true);
    assert.equal(meta.syncLastLocalChangeAt, app.syncLastLocalChangeAt);
});

test('sync health labels prioritize setup, offline, sign in, saving, errors, unsynced, and up to date', () => {
    const app = loadEggApp();

    assert.equal(app.syncHealthState(), 'needs-setup');
    assert.equal(app.syncHealthLabel(), 'Needs setup');

    app.isSyncConfigured = () => true;
    app.syncOnline = false;
    assert.equal(app.syncHealthState(), 'offline');
    assert.equal(app.syncHealthLabel(), 'Offline');

    app.syncOnline = true;
    app.syncUser = null;
    assert.equal(app.syncHealthState(), 'needs-sign-in');

    app.syncUser = { id: 'user-1' };
    app.syncStatus = 'syncing';
    assert.equal(app.syncHealthState(), 'saving');

    app.syncStatus = 'error';
    app.syncLastError = 'Cloud save failed.';
    assert.equal(app.syncHealthState(), 'error');
    assert.equal(app.syncHealthDetail(), 'Cloud save failed.');

    app.syncStatus = 'signed-in';
    app.syncLastError = '';
    app.syncPendingChanges = true;
    assert.equal(app.syncHealthState(), 'unsynced');
    assert.equal(app.syncHealthLabel(), 'Unsynced');

    app.syncPendingChanges = false;
    app.syncLastCloudSaveAt = '5/26/2026, 9:30:00 AM';
    assert.equal(app.syncHealthState(), 'up-to-date');
    assert.equal(app.syncHealthDetail(), 'Last cloud save: 5/26/2026, 9:30:00 AM');
});

test('successful push and pull update sync metadata', async () => {
    const app = loadEggApp(createStorage());
    app.requireSyncReady = () => true;
    app.getSyncConfig = () => ({ tableName: 'egg_app_state', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon' });
    app.syncUser = { id: 'user-1' };
    app.syncPendingChanges = true;
    app.syncClient = {
        from() {
            return {
                upsert: async () => ({ error: null }),
                select() {
                    const query = {
                        eq() {
                            return query;
                        },
                        maybeSingle: async () => ({
                            data: {
                                data: {
                                    inventory: 77,
                                    sales: [],
                                    expenses: [],
                                    cashAdjustments: [],
                                    stockAdjustments: [],
                                    dailyClosings: [],
                                    config: { regularPrice: 250, loanPrice: 270 }
                                },
                                updated_at: '2026-05-26T16:00:00.000Z'
                            },
                            error: null
                        })
                    };
                    return query;
                }
            };
        }
    };

    assert.equal(await app.pushSync(false), true);
    assert.equal(app.syncPendingChanges, false);
    assert.notEqual(app.syncLastCloudSaveAt, '');
    assert.equal(app.syncLastError, '');

    app.syncPendingChanges = true;
    assert.equal(await app.pullSync(false), true);
    assert.equal(app.inventory, 77);
    assert.equal(app.syncPendingChanges, false);
    assert.notEqual(app.syncLastCloudLoadAt, '');
    assert.equal(app.syncLastError, '');
});

test('cloud pull keeps historical April customer orders when cloud copy is older', async () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.requireSyncReady = () => true;
    app.getSyncConfig = () => ({ tableName: 'egg_app_state', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon' });
    app.syncUser = { id: 'user-1' };
    app.syncClient = {
        from() {
            return {
                select() {
                    const query = {
                        eq() {
                            return query;
                        },
                        maybeSingle: async () => ({
                            data: {
                                data: {
                                    inventory: 88,
                                    sales: [
                                        { id: 'cloud-sale-1', customer: 'June Buyer', orderDate: '2026-06-01', date: '2026-06-01', quantity: 1, type: 'Regular', unitPrice: 250, paid: true }
                                    ],
                                    expenses: [],
                                    cashAdjustments: [],
                                    stockAdjustments: [],
                                    walletTransfers: [],
                                    dailyClosings: [],
                                    config: { regularPrice: 250, loanPrice: 270 }
                                },
                                updated_at: '2026-06-13T16:00:00.000Z'
                            },
                            error: null
                        })
                    };
                    return query;
                }
            };
        }
    };

    assert.equal(await app.pullSync(false), true);
    assert.equal(app.sales.some(sale => sale.id === 'cloud-sale-1'), true);
    assert.equal(app.sales.filter(sale => sale.source === 'historical-april-2026-sheet').length, 30);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.sales.filter(sale => sale.source === 'historical-april-2026-sheet').length, 30);
});

test('sync health is visible on dashboard and cloud sync page', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /Sync Health/);
    assert.match(html, /syncHealthLabel\(\)/);
    assert.match(html, /syncHealthDetail\(\)/);
    assert.match(html, /Connection/);
    assert.match(html, /Account/);
    assert.match(html, /Last local change/);
    assert.match(html, /Last cloud save/);
    assert.match(html, /Last cloud load/);
    assert.match(html, /Unsynced changes/);
    assert.match(html, /Last error/);
});

test('pin lock can be configured and unlocks with the correct pin', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);

    assert.equal(app.getPinLockStorageKey(), 'egg_pin_lock');
    assert.equal(app.pinLockEnabled, false);
    assert.equal(app.pinUnlocked, true);
    assert.equal(app.isValidPin('1234'), true);
    assert.equal(app.isValidPin('123456'), true);
    assert.equal(app.isValidPin('123'), false);
    assert.equal(app.isValidPin('1234567'), false);
    assert.equal(app.isValidPin('12ab'), false);

    app.pinForm.newPin = '1234';
    app.pinForm.confirmPin = '1234';

    assert.equal(app.setPinLock(), true);
    assert.equal(app.pinLockEnabled, true);
    assert.equal(app.pinUnlocked, true);
    assert.notEqual(app.pinLockHash, '1234');
    assert.equal(app.verifyPin('1234'), true);

    const savedSettings = JSON.parse(storage.getItem('egg_pin_lock'));
    assert.equal(savedSettings.enabled, true);
    assert.equal(savedSettings.pinHash, app.pinLockHash);

    assert.equal(app.lockApp(), true);
    assert.equal(app.pinUnlocked, false);

    app.pinForm.unlockPin = '0000';
    assert.equal(app.unlockApp(), false);
    assert.equal(app.pinUnlocked, false);
    assert.match(app.pinMessage, /Incorrect PIN/);

    app.pinForm.unlockPin = '1234';
    assert.equal(app.unlockApp(), true);
    assert.equal(app.pinUnlocked, true);
    assert.equal(app.pinForm.unlockPin, '');
});

test('pin lock can be changed, disabled, and stays out of synced business data', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);

    app.pinForm.newPin = '1234';
    app.pinForm.confirmPin = '1234';
    assert.equal(app.setPinLock(), true);

    const reloadedApp = loadEggApp(storage);
    reloadedApp.init();
    assert.equal(reloadedApp.pinLockEnabled, true);
    assert.equal(reloadedApp.pinUnlocked, false);
    assert.equal(reloadedApp.verifyPin('1234'), true);

    reloadedApp.pinForm.currentPin = '0000';
    reloadedApp.pinForm.newPin = '9876';
    reloadedApp.pinForm.confirmPin = '9876';
    assert.equal(reloadedApp.changePinLock(), false);
    assert.equal(reloadedApp.verifyPin('1234'), true);

    reloadedApp.pinForm.currentPin = '1234';
    reloadedApp.pinForm.newPin = '9876';
    reloadedApp.pinForm.confirmPin = '9876';
    assert.equal(reloadedApp.changePinLock(), true);
    assert.equal(reloadedApp.verifyPin('9876'), true);
    assert.equal(reloadedApp.verifyPin('1234'), false);

    reloadedApp.pinForm.currentPin = '1234';
    assert.equal(reloadedApp.disablePinLock(), false);
    assert.equal(reloadedApp.pinLockEnabled, true);

    reloadedApp.pinForm.currentPin = '9876';
    assert.equal(reloadedApp.disablePinLock(), true);
    assert.equal(reloadedApp.pinLockEnabled, false);
    assert.equal(reloadedApp.pinUnlocked, true);
    assert.equal(storage.getItem('egg_pin_lock'), null);

    const data = app.getPersistableState();
    assert.equal(Object.prototype.hasOwnProperty.call(data, 'pinLockHash'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(data, 'pinLockEnabled'), false);
});

test('pin lock UI is present for startup and cloud sync management', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /App Lock/);
    assert.match(html, /x-show="shouldShowPinLock\(\)"/);
    assert.match(html, /x-model="pinForm\.unlockPin"/);
    assert.match(html, /@click="unlockApp\(\)"/);
    assert.match(html, /@click="lockApp\(\)"/);
    assert.match(html, /@click="setPinLock\(\)"/);
    assert.match(html, /@click="changePinLock\(\)"/);
    assert.match(html, /@click="disablePinLock\(\)"/);
});

test('backup export contains business data, summary, and no local secrets', () => {
    const app = loadEggApp();
    app.inventory = 42;
    app.sales = [
        { id: 1, customer: 'Ana', quantity: 2, unitPrice: 250, paid: true },
        { id: 2, customer: 'Ben', quantity: 1, unitPrice: 270, type: 'Loaned', paid: false }
    ];
    app.expenses = [{ id: 3, category: 'Tithing', amount: 150 }];
    app.cashAdjustments = [{ id: 4, difference: 200 }];
    app.stockAdjustments = [{ id: 5, difference: -30 }];
    app.dailyClosings = [{ id: 6, date: '2026-05-26', cashOnHand: 550 }];
    app.pinLockHash = 'pin-v1:secret';
    app.syncLastCloudSaveAt = '5/26/2026, 9:30:00 AM';

    const summary = app.getBackupSummary();
    assert.equal(summary.sales, 2);
    assert.equal(summary.expenses, 1);
    assert.equal(summary.cashAdjustments, 1);
    assert.equal(summary.stockAdjustments, 1);
    assert.equal(summary.dailyClosings, 1);
    assert.equal(summary.customers, 2);
    assert.equal(summary.inventory, 42);
    assert.equal(summary.cashOnHand, 550);
    assert.equal(summary.outstandingLoans, 270);

    const payload = app.createBackupPayload();
    assert.equal(payload.app, 'YOLK Inventory');
    assert.equal(payload.version, 1);
    assert.deepEqual(payload.summary, summary);
    assert.deepEqual(payload.data, app.getPersistableState());
    assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(app.getBackupFileName(), /^YOLK_Backup_\d{4}-\d{2}-\d{2}\.json$/);

    const json = app.createBackupJson();
    assert.equal(json, JSON.stringify(payload, null, 2));
    assert.doesNotMatch(json, /pinLockHash/);
    assert.doesNotMatch(json, /pin-v1:secret/);
    assert.doesNotMatch(json, /syncLastCloudSaveAt/);
    assert.doesNotMatch(json, /supabaseAnonKey/);
});

test('backup restore previews and imports full backup payloads', () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    app.inventory = 5;
    app.sales = [];
    app.getSyncConfig = () => ({ tableName: 'egg_app_state', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon' });
    app.syncUser = { id: 'user-1' };

    const backup = {
        app: 'YOLK Inventory',
        version: 1,
        exportedAt: '2026-05-26T12:00:00.000Z',
        data: {
            inventory: 77,
            sales: [{ id: 1, customer: 'Restore Customer', quantity: 3, unitPrice: 250, paid: true }],
            expenses: [{ id: 2, category: 'Feed', amount: 120 }],
            cashAdjustments: [],
            stockAdjustments: [],
            dailyClosings: [],
            config: { regularPrice: 250, loanPrice: 270 }
        }
    };

    app.backupForm.restoreText = JSON.stringify(backup);
    assert.equal(app.previewBackupRestore(), true);
    assert.equal(app.backupPreview.sales, 1);
    assert.equal(app.backupPreview.expenses, 1);
    assert.equal(app.backupPreview.inventory, 77);

    assert.equal(app.restoreBackupFromText(), true);
    assert.equal(app.inventory, 77);
    assert.equal(app.sales[0].customer, 'Restore Customer');
    assert.equal(app.expenses[0].category, 'Feed');
    assert.equal(app.syncPendingChanges, true);
    assert.match(app.backupMessage, /Backup restored/);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.inventory, 77);
    assert.equal(savedData.sales.length, 1);
});

test('backup restore rejects invalid text and supports raw business payloads', () => {
    const app = loadEggApp();
    app.inventory = 12;

    app.backupForm.restoreText = '{bad json';
    assert.equal(app.previewBackupRestore(), false);
    assert.equal(app.inventory, 12);
    assert.match(app.backupMessage, /Invalid backup JSON/);

    app.backupForm.restoreText = JSON.stringify({ app: 'Wrong App', version: 1 });
    assert.equal(app.restoreBackupFromText(), false);
    assert.equal(app.inventory, 12);
    assert.match(app.backupMessage, /does not contain YOLK records/);

    app.backupForm.restoreText = JSON.stringify({
        inventory: 88,
        sales: [],
        expenses: [],
        cashAdjustments: [],
        stockAdjustments: [],
        dailyClosings: [],
        config: { regularPrice: 250, loanPrice: 270 }
    });
    assert.equal(app.restoreBackupFromText(), true);
    assert.equal(app.inventory, 88);
});

test('backup center UI is present on the cloud sync page', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /Backup Center/);
    assert.match(html, /Download Backup/);
    assert.match(html, /x-model="backupForm\.restoreText"/);
    assert.match(html, /@click="downloadBackup\(\)"/);
    assert.match(html, /@click="previewBackupRestore\(\)"/);
    assert.match(html, /@click="restoreBackupFromText\(\)"/);
});

test('historical April customer sales import without changing current stock', () => {
    const storage = createStorage({
        egg_app_data: JSON.stringify({
            inventory: 500,
            sales: [],
            expenses: [],
            cashAdjustments: [],
            stockAdjustments: [],
            dailyClosings: [],
            config: { regularPrice: 250, loanPrice: 270 }
        })
    });
    const app = loadEggApp(storage);

    app.init();

    const importedSales = app.sales.filter(sale => sale.source === 'historical-april-2026-sheet');
    assert.equal(importedSales.length, 30);
    assert.equal(app.inventory, 500);
    assert.equal(importedSales.reduce((sum, sale) => sum + sale.quantity, 0), 36);
    assert.equal(importedSales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0), 9080);
    assert.equal(importedSales.every(sale => sale.paid), true);
    assert.equal(importedSales.every(sale => sale.historyOnly === true), true);
    assert.equal(importedSales.every(sale => sale.affectsCash === false), true);
    assert.equal(importedSales.filter(sale => sale.type === 'Loaned').length, 4);
    assert.equal(app.getCashOnHand(), 0);
    assert.equal(app.getNetProfit(), 0);
    assert.equal(app.getOutstandingLoans(), 0);

    const aprilSevenSummary = app.getDailyClosingSummary('2026-04-07');
    assert.equal(aprilSevenSummary.orderCount, 0);
    assert.equal(aprilSevenSummary.salesRevenue, 0);
    assert.equal(aprilSevenSummary.collectedRevenue, 0);
    app.exportForm.startDate = '2026-04-01';
    app.exportForm.endDate = '2026-04-30';
    assert.equal(app.getWeeklyData().weeklySales.length, 0);

    const honey = importedSales.find(sale => sale.customer === 'Honey');
    assert.equal(honey.orderDate, '2026-04-20');
    assert.equal(honey.paidDate, '2026-05-19');
    assert.equal(honey.unitPrice, 270);
    assert.equal(honey.eggType, 'Large');

    const jayneSales = importedSales.filter(sale => sale.customer === 'Jayne Labuntog');
    assert.equal(jayneSales.length, 3);
    assert.equal(jayneSales.reduce((sum, sale) => sum + sale.quantity, 0), 9);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    assert.equal(savedData.sales.filter(sale => sale.source === 'historical-april-2026-sheet').length, 30);

    app.init();
    assert.equal(app.sales.filter(sale => sale.source === 'historical-april-2026-sheet').length, 30);
});

test('existing imported historical April sales are migrated away from cash totals', () => {
    const storage = createStorage({
        egg_app_data: JSON.stringify({
            inventory: 500,
            sales: [
                {
                    id: 'historical-april-2026-01',
                    source: 'historical-april-2026-sheet',
                    date: '2026-04-07',
                    orderDate: '2026-04-07',
                    paidDate: '2026-04-07',
                    customer: 'Jayne Labuntog',
                    quantity: 3,
                    type: 'Regular',
                    unitPrice: 250,
                    paid: true
                }
            ],
            expenses: [],
            cashAdjustments: [],
            stockAdjustments: [],
            dailyClosings: [],
            config: { regularPrice: 250, loanPrice: 270 }
        })
    });
    const app = loadEggApp(storage);

    app.init();

    const migratedSale = app.sales.find(sale => sale.id === 'historical-april-2026-01');
    assert.equal(migratedSale.historyOnly, true);
    assert.equal(migratedSale.affectsCash, false);
    assert.equal(app.getCashOnHand(), 0);
    assert.equal(app.getNetProfit(), 0);
    assert.equal(app.getDailyClosingSummary('2026-04-07').salesRevenue, 0);

    const savedData = JSON.parse(storage.getItem('egg_app_data'));
    const savedMigratedSale = savedData.sales.find(sale => sale.id === 'historical-april-2026-01');
    assert.equal(savedMigratedSale.historyOnly, true);
    assert.equal(savedMigratedSale.affectsCash, false);
});

test('persistable sync state contains all business data', () => {
    const app = loadEggApp();
    app.inventory = 42;
    app.sales = [{ id: 1, customer: 'Ana' }];
    app.expenses = [{ id: 2, category: 'Tithing', amount: 150 }];
    app.cashAdjustments = [{ id: 3, difference: 200 }];
    app.stockAdjustments = [{ id: 4, difference: -30 }];
    app.dailyClosings = [{ id: 5, date: '2026-05-25', cashOnHand: 200 }];

    const data = app.getPersistableState();

    assert.equal(data.inventory, 42);
    assert.deepEqual(data.sales, app.sales);
    assert.deepEqual(data.expenses, app.expenses);
    assert.deepEqual(data.cashAdjustments, app.cashAdjustments);
    assert.deepEqual(data.stockAdjustments, app.stockAdjustments);
    assert.deepEqual(data.dailyClosings, app.dailyClosings);
    assert.deepEqual(data.config, app.config);
});
