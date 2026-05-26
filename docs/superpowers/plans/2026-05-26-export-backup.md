# Export and Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Backup Center that exports and restores full YOLK business records as a local JSON backup file.

**Architecture:** Reuse the existing single-file Alpine app and `getPersistableState` as the backup source of truth. Add backup helpers for payload creation, validation, preview, download, and restore, then render a Cloud Sync page panel that keeps backup separate from Supabase sync and PIN lock settings.

**Tech Stack:** HTML, Tailwind, Alpine.js, browser Blob/download APIs, Node test runner.

---

### Task 1: Backup Payload and Summary

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests**

Add tests for `getBackupSummary`, `createBackupPayload`, `createBackupJson`, and `getBackupFileName`. Assert backup JSON includes sales, expenses, adjustments, daily closings, inventory, and config but excludes PIN and sync metadata.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because backup helper methods do not exist.

- [ ] **Step 3: Implement backup helpers**

Add `backupForm`, `backupMessage`, `backupPreview`, `getBackupSummary`, `createBackupPayload`, `createBackupJson`, and `getBackupFileName`.

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 2: Restore Validation and Import

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests**

Add tests for `parseBackupText`, `previewBackupRestore`, and `restoreBackupFromText`. Cover full backup payloads, raw business payloads, invalid JSON, missing business data, and marking restored records as an unsynced local change.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because restore helpers do not exist.

- [ ] **Step 3: Implement restore helpers**

Add parsing, validation, preview, and restore methods. Restore should call `applyPersistedState` and `persistState()` so local storage and cloud sync status are updated.

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test tests/manual-adjustments.test.js`

Expected: PASS.

### Task 3: Backup Center UI

**Files:**
- Modify: `tests/manual-adjustments.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing UI tests**

Assert Cloud Sync includes `Backup Center`, `Download Backup`, restore textarea binding, `Preview Backup`, and `Restore Backup`.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/manual-adjustments.test.js`

Expected: FAIL because the Backup Center UI has not been added.

- [ ] **Step 3: Implement UI and download action**

Add Backup Center panel to the Cloud Sync page and implement `downloadBackup` using Blob, object URL, and a temporary anchor. In non-browser tests, return the JSON string.

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

Open `http://127.0.0.1:8000/index.html`, navigate to Cloud Sync, verify the Backup Center appears, create a backup preview from generated JSON, reject invalid JSON, and confirm mobile width has no horizontal overflow.
