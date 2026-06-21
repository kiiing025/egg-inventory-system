# Offline-First IndexedDB and Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make YOLK fully usable offline, move durable business data to IndexedDB without losing existing phone records, and make Supabase a phone-first backup that cannot silently overwrite pending local changes.

**Architecture:** Add a standalone `storage.js` module with an IndexedDB backend, validated legacy migration, coalescing save queue, and bounded recovery snapshots. The existing Alpine app keeps its in-memory business model and delegates durable writes to that module, while local pinned assets and a corrected service worker provide offline startup. Cloud sign-in never pulls automatically; reconnect only uploads a successfully saved phone snapshot.

**Tech Stack:** Vanilla JavaScript, Alpine.js 3.15.12, Tailwind CSS 3.4.19, Lucide 1.21.0, Supabase JS 2.108.2, XLSX 0.18.5, IndexedDB, service workers, Node.js built-in test runner

---

## File map

- Create `storage.js`: IndexedDB backend, migration, recovery snapshots, save queue, storage estimates, and CommonJS/browser exports.
- Create `tests/storage.test.js`: deterministic storage, migration, queue, and recovery tests using an in-memory backend.
- Modify `index.html`: load local assets, initialize phone storage, queue saves, expose storage status, and enforce backup-only cloud behavior.
- Modify `tests/manual-adjustments.test.js`: app-integration, sync safety, offline shell, and service-worker regression tests.
- Create `package.json` and `package-lock.json`: pinned build-time dependencies and reproducible asset scripts.
- Create `tailwind.config.js` and `assets/tailwind.input.css`: reproducible local Tailwind build.
- Create `scripts/copy-vendor.ps1`: copy pinned browser builds into `vendor/`.
- Create generated `assets/app.css` and pinned `vendor/*.js`: offline runtime assets.
- Modify `service-worker.js`: pre-cache the complete shell and stop returning HTML for failed asset requests.
- Modify `README.md`: document supported HTTPS/localhost/PWA launch and offline/backup behavior.

### Task 1: Build and test the offline application shell

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tailwind.config.js`
- Create: `assets/tailwind.input.css`
- Create: `assets/app.css`
- Create: `scripts/copy-vendor.ps1`
- Create: `vendor/alpine.min.js`
- Create: `vendor/lucide.min.js`
- Create: `vendor/supabase.js`
- Create: `vendor/xlsx.full.min.js`
- Modify: `index.html:15-24`
- Modify: `index.html:5705`
- Modify: `service-worker.js`
- Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Add failing offline-shell tests**

Add these tests to `tests/manual-adjustments.test.js`:

```js
test('startup uses only local pinned runtime assets', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//);
    assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//);
    assert.match(html, /href="assets\/app\.css"/);
    assert.match(html, /src="vendor\/alpine\.min\.js"/);
    assert.match(html, /src="vendor\/lucide\.min\.js"/);
    assert.match(html, /src="vendor\/supabase\.js"/);
    assert.match(html, /src="vendor\/xlsx\.full\.min\.js"/);
});

test('service worker precaches every offline runtime asset', () => {
    const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
    for (const asset of [
        './assets/app.css',
        './vendor/alpine.min.js',
        './vendor/lucide.min.js',
        './vendor/supabase.js',
        './vendor/xlsx.full.min.js'
    ]) {
        assert.match(serviceWorker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.doesNotMatch(serviceWorker, /catch\(\(\) => caches\.match\('\.\/index\.html'\)\)[\s\S]*?event\.request\.mode !== 'navigate'/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
node --test --test-name-pattern="startup uses only local|service worker precaches every" tests\manual-adjustments.test.js
```

Expected: FAIL because CDN scripts remain and the service worker does not include local runtime assets.

- [ ] **Step 3: Add pinned build dependencies**

Create `package.json`:

```json
{
  "name": "yolk-inventory-system",
  "private": true,
  "scripts": {
    "build:css": "tailwindcss -i ./assets/tailwind.input.css -o ./assets/app.css --minify",
    "build:vendor": "powershell -ExecutionPolicy Bypass -File ./scripts/copy-vendor.ps1",
    "build": "npm run build:vendor && npm run build:css",
    "test": "node --test tests/*.test.js"
  },
  "devDependencies": {
    "@supabase/supabase-js": "2.108.2",
    "alpinejs": "3.15.12",
    "lucide": "1.21.0",
    "tailwindcss": "3.4.19",
    "xlsx": "0.18.5"
  }
}
```

Run `npm install` to create `package-lock.json`.

- [ ] **Step 4: Add reproducible asset build files**

Create `tailwind.config.js`:

```js
module.exports = {
    content: ['./index.html'],
    darkMode: 'class',
    theme: { extend: {} },
    plugins: []
};
```

Create `assets/tailwind.input.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `scripts/copy-vendor.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$vendor = Join-Path $root 'vendor'
New-Item -ItemType Directory -Force -Path $vendor | Out-Null
Copy-Item (Join-Path $root 'node_modules\alpinejs\dist\cdn.min.js') (Join-Path $vendor 'alpine.min.js') -Force
Copy-Item (Join-Path $root 'node_modules\lucide\dist\umd\lucide.min.js') (Join-Path $vendor 'lucide.min.js') -Force
Copy-Item (Join-Path $root 'node_modules\@supabase\supabase-js\dist\umd\supabase.js') (Join-Path $vendor 'supabase.js') -Force
Copy-Item (Join-Path $root 'node_modules\xlsx\dist\xlsx.full.min.js') (Join-Path $vendor 'xlsx.full.min.js') -Force
```

Run `npm run build` and commit the generated files.

- [ ] **Step 5: Replace CDN references and lazy XLSX loading**

Replace the CDN block in `index.html` with:

```html
<link rel="stylesheet" href="assets/app.css">
<script defer src="vendor/alpine.min.js"></script>
<script src="vendor/lucide.min.js"></script>
<script src="sync-config.js"></script>
<script src="vendor/supabase.js"></script>
<script src="vendor/xlsx.full.min.js"></script>
```

Change `ensureXlsxLoaded()` to return the already-local global:

```js
ensureXlsxLoaded() {
    return Promise.resolve(Boolean(window.XLSX));
},
```

- [ ] **Step 6: Correct the service-worker strategies**

Use cache version `egg-inventory-cache-v32`. Include all local shell assets in `APP_ASSETS`. Keep network-first navigation and `sync-config.js`, use cache-first for other local assets, and replace the generic HTML fallback with:

```js
return fetch(event.request).then(response => {
  if (response.ok && event.request.url.startsWith(self.location.origin)) {
    const responseCopy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
  }
  return response;
}).catch(() => new Response('Offline asset unavailable', {
  status: 503,
  statusText: 'Offline'
}));
```

- [ ] **Step 7: Run focused tests and verify GREEN**

```powershell
npm run build
node --test --test-name-pattern="startup uses only local|service worker precaches every|service worker cache version" tests\manual-adjustments.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit the offline shell**

```powershell
git add package.json package-lock.json tailwind.config.js assets scripts vendor index.html service-worker.js tests/manual-adjustments.test.js
git commit -m "Bundle the app shell for offline use"
```

### Task 2: Add the IndexedDB storage service with migration and save queue

**Files:**
- Create: `storage.js`
- Create: `tests/storage.test.js`

- [ ] **Step 1: Add failing migration, queue, and recovery tests**

Create `tests/storage.test.js` with an in-memory backend implementing `getState`, `putState`, `addRecovery`, `listRecoveries`, and `deleteRecovery`. Cover these exact expectations:

```js
const assert = require('node:assert/strict');
const test = require('node:test');
const { createStorageService } = require('../storage.js');

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createStorage(initial = {}) {
    const values = { ...initial };
    return {
        getItem: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
        setItem: (key, value) => { values[key] = String(value); },
        removeItem: key => { delete values[key]; }
    };
}

function createMemoryBackend(options = {}) {
    let state = null;
    let recoveries = [];
    let releaseWrite = null;
    let writeGate = options.holdWrites ? new Promise(resolve => { releaseWrite = resolve; }) : Promise.resolve();
    return {
        async getState() { return clone(state); },
        async putState(record) {
            if (options.failPut) throw new Error('Write failed');
            await writeGate;
            state = clone(record);
            return clone(record);
        },
        async addRecovery(record) { recoveries.push(clone(record)); return clone(record); },
        async listRecoveries() { return clone(recoveries); },
        async deleteRecovery(id) { recoveries = recoveries.filter(item => item.id !== id); },
        async estimate() { return { usage: 0, quota: 1 }; },
        async requestPersistence() { return false; },
        releaseWrites() { if (releaseWrite) releaseWrite(); writeGate = Promise.resolve(); }
    };
}

function incrementingClock() {
    let value = Date.parse('2026-06-21T00:00:00Z');
    return () => new Date(value += 1000).toISOString();
}

test('migrates validated legacy state and removes it only after read-back verification', async () => {
    const legacy = createStorage({ egg_app_data: JSON.stringify({ sales: [{ id: 1 }], expenses: [] }) });
    const backend = createMemoryBackend();
    const service = createStorageService({ backend, legacyStorage: legacy, validate: value => Array.isArray(value.sales) });
    const result = await service.initialize();
    assert.equal(result.source, 'legacy-migrated');
    assert.equal((await backend.getState()).data.sales[0].id, 1);
    assert.equal(legacy.getItem('egg_app_data'), null);
});

test('failed migration keeps legacy state untouched', async () => {
    const legacyPayload = JSON.stringify({ sales: [{ id: 2 }], expenses: [] });
    const legacy = createStorage({ egg_app_data: legacyPayload });
    const backend = createMemoryBackend({ failPut: true });
    const service = createStorageService({ backend, legacyStorage: legacy, validate: value => Array.isArray(value.sales) });
    const result = await service.initialize();
    assert.equal(result.source, 'legacy-fallback');
    assert.equal(legacy.getItem('egg_app_data'), legacyPayload);
});

test('coalesces queued saves and never lets an older revision win', async () => {
    const backend = createMemoryBackend({ holdWrites: true });
    const service = createStorageService({ backend, legacyStorage: createStorage(), validate: () => true });
    const first = service.queueSave({ sales: [{ id: 1 }] });
    const second = service.queueSave({ sales: [{ id: 2 }] });
    backend.releaseWrites();
    await Promise.all([first, second, service.flush()]);
    assert.equal((await backend.getState()).data.sales[0].id, 2);
});

test('keeps only the newest three recovery snapshots', async () => {
    const backend = createMemoryBackend();
    const service = createStorageService({ backend, legacyStorage: createStorage(), validate: () => true, now: incrementingClock() });
    for (let id = 1; id <= 4; id += 1) await service.createRecovery({ sales: [{ id }] }, 'cloud-restore');
    const snapshots = await service.listRecoveries();
    assert.deepEqual(snapshots.map(snapshot => snapshot.data.sales[0].id), [4, 3, 2]);
});
```

- [ ] **Step 2: Run storage tests and verify RED**

```powershell
node --test tests\storage.test.js
```

Expected: FAIL because `storage.js` does not exist.

- [ ] **Step 3: Implement the storage module API**

`storage.js` must export in CommonJS and assign `window.YolkStorage` in browsers:

```js
{
  DB_NAME: 'yolk-inventory',
  DB_VERSION: 1,
  createIndexedDbBackend,
  createStorageService
}
```

`createIndexedDbBackend(indexedDB)` opens stores `app_state` and `recovery_snapshots`, wraps requests/transaction completion in promises, and exposes:

```js
getState()
putState(record)
addRecovery(record)
listRecoveries()
deleteRecovery(id)
estimate()
requestPersistence()
```

`createStorageService({ backend, legacyStorage, validate, now, clone })` exposes:

```js
initialize()
queueSave(data)
flush()
createRecovery(data, reason)
listRecoveries()
restoreRecovery(id)
estimate()
requestPersistence()
getStatus()
subscribe(listener)
```

Use monotonically increasing revisions, one active write, one newest queued snapshot, shared completion promises, read-back validation during migration, and a three-snapshot retention pass after every recovery write.

- [ ] **Step 4: Run storage tests and verify GREEN**

```powershell
node --test tests\storage.test.js
node --check storage.js
```

Expected: all storage tests PASS and syntax check exits 0.

- [ ] **Step 5: Commit the storage service**

```powershell
git add storage.js tests/storage.test.js
git commit -m "Add durable IndexedDB phone storage"
```

### Task 3: Integrate phone storage into the Alpine application

**Files:**
- Modify: `index.html:23-25`
- Modify: `index.html:2300-2330`
- Modify: `index.html:2443-2470`
- Modify: `index.html:2497-2528`
- Modify: `index.html:3082-3097`
- Modify: `tests/manual-adjustments.test.js`
- Modify: `service-worker.js`

- [ ] **Step 1: Add failing integration tests**

Add tests proving:

```js
test('phone storage loads IndexedDB state before finishing startup', async () => {
    const app = loadEggApp();
    app.phoneStorage = {
        initialize: async () => ({ source: 'indexeddb', data: { inventory: 42, sales: [], expenses: [], config: {} } }),
        subscribe: () => () => {}
    };
    await app.initializePhoneStorage();
    assert.equal(app.inventory, 42);
    assert.equal(app.phoneStorageReady, true);
});

test('persistState queues IndexedDB save instead of writing business data to localStorage', async () => {
    const storage = createStorage();
    const app = loadEggApp(storage);
    let saved = null;
    app.phoneStorage = {
        queueSave: async data => { saved = data; return { revision: 1 }; },
        flush: async () => true
    };
    app.phoneStorageReady = true;
    app.sales = [{ id: 1, customer: 'Ana' }];
    assert.equal(app.persistState({ sync: false }), true);
    await app.flushPhoneStorage();
    assert.equal(saved.sales[0].customer, 'Ana');
    assert.equal(storage.getItem('egg_app_data'), null);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
node --test --test-name-pattern="phone storage|persistState queues IndexedDB" tests\manual-adjustments.test.js
```

Expected: FAIL because phone-storage state and methods do not exist.

- [ ] **Step 3: Load and initialize `storage.js`**

Load `storage.js` before the Alpine script and add state:

```js
phoneStorage: null,
phoneStorageReady: false,
phoneSaveStatus: 'loading',
phoneSaveMessage: 'Opening phone storage...',
phoneStorageWarning: '',
phoneStorageUsage: null,
```

Add `initializePhoneStorage()`, which creates `YolkStorage.createStorageService`, subscribes to status changes, awaits `initialize()`, applies validated data, sets readiness, requests persistent storage, updates the estimate, and only then allows the loading screen to exit.

Keep the current synchronous legacy path only when `window.YolkStorage` or IndexedDB is unavailable and a valid `egg_app_data` payload exists. Do not open an empty writable app after a storage initialization failure.

- [ ] **Step 4: Queue durable saves**

In `persistState(options)`, preserve the existing localStorage path for Node tests and degraded legacy mode. When phone storage is ready:

```js
const snapshot = this.cloneActivityValue(this.getPersistableState());
this.phoneSaveStatus = 'saving';
this.phoneSaveMessage = 'Saving on phone...';
this.phoneStorage.queueSave(snapshot)
    .then(() => {
        this.phoneSaveStatus = 'saved';
        this.phoneSaveMessage = 'Saved on phone';
        if (options.sync !== false) {
            this.markLocalSyncChange();
            this.queueSyncPush();
        }
    })
    .catch(error => {
        this.phoneSaveStatus = 'error';
        this.phoneSaveMessage = 'Phone save failed';
        this.phoneStorageWarning = error?.message || 'Phone storage failed';
        this.syncPendingChanges = true;
    });
return true;
```

Add `flushPhoneStorage()` and call it before cloud push. Register `visibilitychange` and `pagehide` handlers that invoke it without clearing pending status.

- [ ] **Step 5: Cache `storage.js` and run integration tests**

Add `./storage.js` to `APP_ASSETS`, then run:

```powershell
node --test --test-name-pattern="phone storage|persistState queues IndexedDB" tests\manual-adjustments.test.js
node --test tests\storage.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit app storage integration**

```powershell
git add index.html storage.js service-worker.js tests/manual-adjustments.test.js tests/storage.test.js
git commit -m "Store business data safely on the phone"
```

### Task 4: Make Supabase a safe phone backup

**Files:**
- Modify: `index.html:1520-1650`
- Modify: `index.html:3480-3785`
- Modify: `tests/manual-adjustments.test.js`

- [ ] **Step 1: Add failing cloud-safety tests**

Add these helper clients and tests:

```js
function createSuccessfulAuthClient() {
    return {
        auth: {
            signInWithPassword: async () => ({ data: { user: { id: 'owner' } }, error: null })
        }
    };
}

function createCloudStateClient(cloudData) {
    const query = {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
            return {
                data: { data: cloudData, updated_at: '2026-06-21T00:00:00Z' },
                error: null
            };
        }
    };
    return {
        from() { return query; }
    };
}

test('sign in never pulls cloud data automatically', async () => {
    const app = loadEggApp();
    let pulls = 0;
    app.syncClient = createSuccessfulAuthClient();
    app.pullSync = async () => { pulls += 1; return true; };
    app.syncForm.email = 'owner@example.com';
    app.syncForm.password = 'secret';
    assert.equal(await app.signInSync(), true);
    assert.equal(pulls, 0);
});

test('cloud restore is blocked while phone changes are pending', async () => {
    const app = loadEggApp();
    app.syncPendingChanges = true;
    app.syncClient = createCloudStateClient({ sales: [] });
    app.syncUser = { id: 'owner' };
    assert.equal(await app.restoreCloudBackup(true), false);
    assert.match(app.syncMessage, /back up.*phone changes first/i);
});

test('cloud restore checkpoints phone data before replacement', async () => {
    const app = loadEggApp();
    const calls = [];
    app.phoneStorage = {
        createRecovery: async data => calls.push(['checkpoint', data.sales[0].id]),
        queueSave: async data => calls.push(['save', data.sales[0].id]),
        flush: async () => true
    };
    app.phoneStorageReady = true;
    app.sales = [{ id: 1 }];
    app.syncClient = createCloudStateClient({ sales: [{ id: 2 }], expenses: [], config: {} });
    app.syncUser = { id: 'owner' };
    assert.equal(await app.restoreCloudBackup(false), true);
    assert.deepEqual(calls, [['checkpoint', 1], ['save', 2]]);
});
```

- [ ] **Step 2: Run cloud tests and verify RED**

```powershell
node --test --test-name-pattern="sign in never pulls|cloud restore" tests\manual-adjustments.test.js
```

Expected: FAIL because sign-in still pulls and `restoreCloudBackup()` does not exist.

- [ ] **Step 3: Remove automatic pull and guard reconnect**

After sign-in, set signed-in status and call `queueSyncPush()` only when `syncPendingChanges` is true. Do not call `pullSync(false)`.

Make `pushSync()` await `flushPhoneStorage()` before reading `getPersistableState()`. Keep pending true until the upsert succeeds.

- [ ] **Step 4: Implement guarded cloud restore**

Rename `pullSync()` to `restoreCloudBackup()`. Before fetching or applying cloud state:

```js
if (this.syncPendingChanges || this.phoneSaveStatus === 'saving') {
    this.syncStatus = 'unsynced';
    this.syncMessage = 'Back up pending phone changes before restoring cloud data.';
    return false;
}
```

Validate the cloud payload, confirm when `manual` is true, checkpoint current phone data, apply cloud data, queue and flush the restored snapshot with sync disabled, then clear pending status. On failure after checkpoint, restore and flush the checkpoint before reporting the error.

- [ ] **Step 5: Rename the controls**

Replace `Pull` with `Restore Cloud Backup` and `Push` with `Back Up Now`. Disable restore while `syncPendingChanges`, `syncBusy`, or `phoneSaveStatus === 'saving'`.

- [ ] **Step 6: Run cloud tests and verify GREEN**

```powershell
node --test --test-name-pattern="sign in never pulls|cloud restore|successful push and pull" tests\manual-adjustments.test.js
```

Update the legacy push/pull test name and expectations to the new backup/restore semantics. Expected: PASS.

- [ ] **Step 7: Commit cloud safeguards**

```powershell
git add index.html tests/manual-adjustments.test.js
git commit -m "Protect phone data during cloud backup"
```

### Task 5: Add capacity warnings and recovery controls

**Files:**
- Modify: `index.html:1500-1650`
- Modify: `index.html:2300-2330`
- Modify: `tests/manual-adjustments.test.js`
- Modify: `tests/storage.test.js`

- [ ] **Step 1: Add failing capacity and recovery tests**

Test that an estimate at or above 80 percent sets a warning, persistence denial does not block readiness, recovery snapshots are listed newest-first, and restoring a recovery snapshot applies and saves its data.

Use these assertions:

```js
assert.equal(app.getPhoneStorageUsagePercent({ usage: 8, quota: 10 }), 80);
assert.match(app.getPhoneStorageWarning({ usage: 8, quota: 10 }), /80%/);
assert.equal(await app.requestPhoneStoragePersistence({ requestPersistence: async () => false }), false);
assert.equal(app.phoneStorageReady, true);
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
node --test --test-name-pattern="storage usage|recovery snapshot|persistence denial" tests\manual-adjustments.test.js tests\storage.test.js
```

Expected: FAIL because capacity helpers and recovery UI integration do not exist.

- [ ] **Step 3: Implement capacity state and helpers**

Add `phoneStorageUsage`, `phoneStorageQuota`, `phoneStoragePersistent`, and `phoneRecoverySnapshots`. Implement estimate-to-percent conversion with a zero-quota guard, warning text at 80 percent, non-blocking persistence requests, recovery refresh, and recovery restore with confirmation.

- [ ] **Step 4: Add Backup Center controls**

Show phone save state, approximate storage usage, persistent-storage status, Retry Phone Save, Export Backup, and the newest three rollback snapshots. Do not expose PIN hash or sync credentials.

- [ ] **Step 5: Run focused tests and verify GREEN**

```powershell
node --test --test-name-pattern="storage usage|recovery snapshot|persistence denial" tests\manual-adjustments.test.js tests\storage.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit capacity and recovery UI**

```powershell
git add index.html tests/manual-adjustments.test.js tests/storage.test.js
git commit -m "Add phone storage recovery controls"
```

### Task 6: Document, audit, verify offline behavior, and publish

**Files:**
- Modify: `README.md`
- Verify: all changed files

- [ ] **Step 1: Correct launch and backup documentation**

Remove the recommendation to open `index.html` directly. Document localhost/HTTPS/PWA requirements, first-install connectivity, offline phone saves, automatic cloud backup after reconnect, explicit cloud restore, IndexedDB migration, and JSON backup recovery.

- [ ] **Step 2: Run the complete build and automated suite**

```powershell
npm ci
npm run build
npm test
node --check storage.js
node --check service-worker.js
git diff --check
```

Expected: every test passes and all checks exit 0.

- [ ] **Step 3: Audit runtime dependencies and data boundaries**

```powershell
rg -n "<script[^>]+src=\"https?://|<link[^>]+href=\"https?://" index.html
rg -n "egg_app_data" index.html storage.js
git diff --stat
git status --short --branch
```

Expected: no required runtime CDN URLs; legacy business-data access exists only in migration/fallback code; no credentials, user data, or unrelated files are added.

- [ ] **Step 4: Verify online install then offline reload**

Serve the repository on localhost. In a fresh browser origin:

1. Load online and wait for the service worker to control the page.
2. Add a uniquely named customer and sale.
3. Wait for `Saved on phone`.
4. Switch the browser offline and reload.
5. Confirm styling, icons, Customer Book, sale, expense, inventory, backup export, and the unique record still work.
6. Add another offline record and reload offline again.
7. Reconnect and confirm the pending backup uploads without any automatic restore.
8. Confirm there are no console errors or failed JavaScript/CSS requests.

- [ ] **Step 5: Review the final data-safety diff**

Confirm migration removes legacy data only after verified IndexedDB read-back, failed writes remain visible and retryable, sign-in never pulls, restore is blocked by pending data, and recovery snapshots are bounded.

- [ ] **Step 6: Commit final documentation or cache adjustments**

```powershell
git add README.md service-worker.js tests index.html storage.js assets vendor package.json package-lock.json tailwind.config.js scripts
git commit -m "Document offline phone data safety"
```

Skip this commit only if Step 1 produced no uncommitted changes because documentation was committed with an earlier task.

- [ ] **Step 7: Push after user-approved verification**

```powershell
git push origin main
```

Expected: `origin/main` advances to the final verified offline-first release.
