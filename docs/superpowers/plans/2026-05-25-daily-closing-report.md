# Daily Closing Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a saved daily closing page that records end-of-day snapshots for sales, expenses, cash, loans, stock, and notes.

**Architecture:** Keep the existing single-file Alpine app. Add `dailyClosings` and `dailyClosingForm` state, derive closing metrics from the current records, persist snapshots through the existing local storage and Supabase sync payload, and render a dedicated Daily Closing page plus dashboard shortcut.

**Tech Stack:** HTML, Tailwind, Alpine.js, Lucide icons, Node test runner.

---

### Task 1: Daily Closing Data Model

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests**

Add tests for `getDailyClosingSummary`, `saveDailyClosing`, updating an existing closing for the same date, and persisting `dailyClosings`.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because daily closing methods and state do not exist yet.

- [ ] **Step 3: Implement data model and methods**

Add `dailyClosings`, `dailyClosingForm`, date matching helpers, summary calculation, save/update behavior, and persistence support.

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 2: Daily Closing UI

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing UI tests**

Assert the app renders a Daily Closing page, desktop navigation entry, dashboard shortcut, and history labels.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because the page is not rendered yet.

- [ ] **Step 3: Implement page and dashboard shortcut**

Add desktop navigation, page title metadata, dashboard closing card, daily metric preview, notes field, save button, and saved history list.

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 3: Cache and Browser Verification

**Files:**
- Modify: `service-worker.js`

- [ ] **Step 1: Bump service worker cache**

Update `CACHE_NAME` to the next version so installed devices refresh the app shell.

- [ ] **Step 2: Run automated checks**

Run:

```powershell
node --test tests\manual-adjustments.test.js
node --check service-worker.js
```

Expected: both commands pass.

- [ ] **Step 3: Browser smoke test**

Open `http://127.0.0.1:8000/index.html`, navigate to Daily Closing, save a sample closing if needed, and check mobile layout does not break the existing bottom navigation.
