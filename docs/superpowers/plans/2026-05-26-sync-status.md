# Better Auto Sync Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clearer sync health tracking so the owner can see whether laptop/iPhone data is saved, unsynced, offline, signed out, or in error.

**Architecture:** Keep the current Supabase sync table and business payload unchanged. Add local-only sync metadata in `egg_sync_meta`, derive a health state from existing sync state plus metadata, and render the result on the dashboard and Cloud Sync page.

**Tech Stack:** HTML, Tailwind, Alpine.js, Supabase JS client, Node test runner.

---

### Task 1: Sync Metadata and Health State

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests**

Add tests for `markLocalSyncChange`, `syncPendingChanges`, `syncLastLocalChangeAt`, `syncHealthState`, `syncHealthLabel`, and `syncHealthDetail`.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because sync health metadata methods do not exist yet.

- [ ] **Step 3: Implement local metadata and health methods**

Add local-only sync metadata state, local storage helpers, online detection, health-state priority, labels, detail text, and CSS class helpers.

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 2: Push/Pull Metadata Updates

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests**

Add tests with a fake `syncClient` that verify successful `pushSync` clears pending changes and stores `syncLastCloudSaveAt`, and successful `pullSync` clears pending changes and stores `syncLastCloudLoadAt`.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because push/pull do not update the new metadata yet.

- [ ] **Step 3: Implement push/pull metadata updates**

Update `persistState`, `queueSyncPush`, `pushSync`, `pullSync`, and error paths to set pending, cloud save/load timestamps, online/offline status, and last error correctly.

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 3: Sync Health UI

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing UI tests**

Assert the dashboard contains a Sync Health card and Cloud Sync contains Online/Offline, Last local change, Last cloud save, Last cloud load, Unsynced changes, and Last error labels.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because the UI has not been added yet.

- [ ] **Step 3: Implement dashboard and sync-page panels**

Add the dashboard sync card and Cloud Sync health grid using existing page styles.

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 4: Cache and Verification

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

Open `http://127.0.0.1:8000/index.html`, inspect dashboard Sync Health and Cloud Sync page on desktop and mobile width, and confirm no console errors.
