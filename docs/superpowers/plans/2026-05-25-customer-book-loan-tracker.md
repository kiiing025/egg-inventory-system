# Customer Book and Loan Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 of the upgrade roadmap: a customer book page with grouped customer history and loan collection actions.

**Architecture:** Keep sales as the source of truth. Add computed customer summary helpers inside the existing Alpine app, then render a new Customers page in the existing single-file UI. Reuse `collectLoan`, `persistState`, and the existing local/Supabase sync state.

**Tech Stack:** HTML, Tailwind, Alpine.js, Lucide icons, Node test runner.

---

### Task 1: Customer Summary Behavior

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests**

Add tests that call `getCustomerSummaries`, `selectCustomer`, `getSelectedCustomerSummary`, and `collectCustomerLoan`. Use sample sales for one paid regular sale, two unpaid loaned sales, and one paid loaned sale.

- [ ] **Step 2: Verify tests fail**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because the customer helper methods do not exist yet.

- [ ] **Step 3: Implement summary helpers**

Add app state for `customerSearch` and `selectedCustomerKey`. Add methods for normalized customer names, display names, grouped summary data, filtered summaries, selected summary fallback, and customer loan collection.

- [ ] **Step 4: Verify tests pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 2: Customers Page UI

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests**

Assert that desktop navigation includes `currentPage = 'customers'`, mobile navigation includes a Customers tab with a users icon, and the page contains `x-show="currentPage === 'customers'"`.

- [ ] **Step 2: Verify tests fail**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because the page does not exist yet.

- [ ] **Step 3: Implement Customers page**

Add desktop and mobile navigation entries, page titles, a search box, summary metric cards, customer list, customer detail panel, and loan collection buttons.

- [ ] **Step 4: Verify tests pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 3: Dashboard Loan Reminder

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing test**

Assert the dashboard includes a customer loan reminder block and a Customers shortcut.

- [ ] **Step 2: Verify test fails**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because the reminder block is missing.

- [ ] **Step 3: Implement reminder**

Add a compact dashboard reminder that appears when unpaid customer loans exist and links to the Customers page.

- [ ] **Step 4: Verify tests pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 4: Final Verification

**Files:**
- Modify: `service-worker.js`

- [ ] **Step 1: Bump service worker cache**

Update the cache version so phones receive the new app shell.

- [ ] **Step 2: Run automated checks**

Run:

```powershell
node --test tests/manual-adjustments.test.js
node --check service-worker.js
```

Expected: both commands pass.

- [ ] **Step 3: Browser smoke test**

Open the local app at `http://127.0.0.1:8000/index.html`, check desktop and mobile Customers page layout, and confirm the bottom navigation still fits.
