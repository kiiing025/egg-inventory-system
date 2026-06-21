# Offline-First IndexedDB and Data Safety Design

**Date:** 2026-06-21
**Status:** Approved for planning

## Purpose

YOLK will use the phone as the primary working copy, remain fully usable without Wi-Fi, and use Supabase as a protected backup rather than an authority that can silently overwrite newer phone records. Business data will move from synchronous, capacity-limited `localStorage` into IndexedDB while retaining the existing backup format and Customer Book performance cache.

## Current risks

- Tailwind, Alpine, Lucide, Supabase, and XLSX are loaded from internet CDNs, so a cold offline load loses styling or behavior.
- The service worker only pre-caches local shell files and returns `index.html` for failed non-navigation requests, which can serve HTML to a JavaScript request.
- Business state is rewritten synchronously into one `localStorage` value after every change. This blocks the main thread and is constrained by browser-specific storage quotas.
- Signing in automatically pulls cloud state.
- Manual cloud pull replaces local state and clears the pending-change marker, even when the phone has newer unsynced records.
- Opening the app through `file://` cannot provide a functioning service worker.

## Goals

- Open and operate the complete core app without Wi-Fi after the PWA has been installed once.
- Save sales, customers, expenses, inventory, payments, activity history, adjustments, and catalog changes durably on the phone.
- Preserve every valid existing `egg_app_data` record during migration.
- Keep the UI responsive as data grows.
- Never let sign-in or cloud restore silently overwrite pending phone changes.
- Automatically back up pending phone changes after connectivity returns.
- Preserve JSON backup export and restore as an independent recovery path.
- Keep the current Customer Book summary and search caches.

## Non-goals

- Active multi-device editing or record-level conflict merging.
- End-to-end encryption managed by an app-specific recovery key.
- Replacing Supabase.
- Changing the business-data or JSON backup schema unless a compatibility version field is added.
- Rebuilding the application in a framework or introducing a server-side runtime.

## Source-of-truth model

During a running session, the Alpine application state is the active in-memory model. IndexedDB is the durable phone database. Supabase is a backup snapshot of the phone database.

Cloud data is never applied automatically after sign-in. The only automatic reconnect action is uploading a successfully saved local snapshot when `syncPendingChanges` is true.

## Storage architecture

### IndexedDB database

Create a focused `storage.js` module loaded before the application script. It exposes a small `window.YolkStorage` API and contains no UI or sync logic.

Database name: `yolk-inventory`
Database version: `1`

Object stores:

1. `app_state`
   - Key: `default`
   - Value: `{ key, schemaVersion, revision, savedAt, data }`
   - Holds the latest complete persistable business snapshot.
2. `recovery_snapshots`
   - Key: generated snapshot ID
   - Value: `{ id, reason, createdAt, data }`
   - Holds bounded rollback snapshots created before cloud restore or other destructive replacement.
   - Retain the newest three snapshots.

The snapshot shape remains compatible with `getPersistableState()`, cloud backup, and JSON export. This avoids a risky record-by-record schema rewrite while moving writes off the main thread and raising practical capacity.

### Small local settings

`localStorage` remains limited to small device-only values:

- dark-mode preference;
- PIN configuration and hash;
- sync metadata and pending status;
- IndexedDB migration status;
- non-sensitive UI preferences.

Business collections are not mirrored to `localStorage` after successful migration.

## Existing-data migration

Migration is idempotent and runs behind the loading screen:

1. Open IndexedDB and read `app_state/default`.
2. If an IndexedDB state exists, validate and load it. Do not inspect or import an older legacy copy.
3. If IndexedDB is empty, read `localStorage.egg_app_data`.
4. Validate the legacy payload using the same business-state checks used by backup restore.
5. Write the payload to IndexedDB in one transaction.
6. Read it back and validate the stored record.
7. Only after verification succeeds, set a migration marker and remove `egg_app_data` from `localStorage`.
8. If any step fails, keep the legacy value untouched, show a storage warning, and load the validated legacy state for that session.

Migration never starts from defaults when either storage location contains a valid business state. Invalid state produces a blocking recovery message rather than silently replacing records with an empty database.

## Save queue

The existing synchronous `persistState()` call sites remain the entry point, but persistence becomes a coalescing asynchronous queue:

1. Capture a cloned persistable snapshot and increment a local revision.
2. Replace any queued-but-not-started snapshot with the newest revision.
3. Allow only one IndexedDB write transaction at a time.
4. After a successful write, update the local-save status and mark cloud backup pending.
5. If a newer revision arrived during the write, immediately write that revision next.
6. Queue cloud backup only after the matching local write succeeds.

This keeps existing action methods simple, avoids synchronous serialization into `localStorage`, and prevents stale writes from finishing after newer writes.

On `visibilitychange` and `pagehide`, the app starts any queued write immediately. The UI displays `Saving on phone`, `Saved on phone`, or `Phone save failed` so durability is visible.

If a transaction fails, data remains in memory, the pending snapshot stays retryable, cloud upload is not marked complete, and the user receives a persistent warning with Retry and Export Backup actions.

## Offline application shell

Replace startup CDN dependencies with version-pinned local assets:

- generated local Tailwind CSS instead of the Tailwind browser compiler;
- local Alpine build;
- local Lucide build;
- local Supabase client build;
- local XLSX build so exports remain available offline.

All required HTML, CSS, JavaScript, icons, storage code, sync configuration, and export code are included in the service-worker pre-cache.

Service-worker behavior:

- navigation: network-first with cached `index.html` fallback;
- versioned local static assets: cache-first;
- `sync-config.js`: network-first with its cached copy as fallback;
- missing JavaScript, CSS, images, or fonts: return a normal failure response, never `index.html`;
- cache version bump removes obsolete app-shell caches after activation.

The app must be opened through HTTPS, an installed PWA, or localhost. `file://` is not an offline-supported launch mode. The first PWA installation necessarily requires access to the hosted app; subsequent launches use the cached shell.

## Phone-first cloud backup

### Reconnect

When the browser reports online:

1. Finish any queued IndexedDB write.
2. If signed in and `syncPendingChanges` is true, upload the newest durable phone snapshot.
3. Clear pending status only after Supabase confirms the upsert.
4. Never pull automatically.

### Sign-in

Sign-in authenticates the account but does not load cloud business data. If the phone has pending data, it backs up that data after the local save queue is clear. If the phone has no local business state, the UI may offer Restore Cloud Backup, but the restore remains explicit.

### Cloud controls

Rename the manual actions:

- `Push` becomes `Back Up Now`.
- `Pull` becomes `Restore Cloud Backup`.

Restore is disabled while local writes or pending cloud backup exist. Before applying cloud state, the app shows local/cloud timestamps and record counts, requires confirmation, and writes the current phone state to `recovery_snapshots`. The restored cloud state is then validated, applied, and saved to IndexedDB before pending status is cleared.

The latest recovery snapshot can be restored from the Backup Center if the cloud restore was accidental.

## Capacity and retention

At startup and after large imports, use `navigator.storage.estimate()` when available. Show a warning at 80 percent usage and provide immediate backup export. Request persistent storage with `navigator.storage.persist()` when supported; denial does not block the app.

Activity history remains capped at 1,000 entries. Recovery snapshots remain capped at three. Customer and order records are not silently deleted.

## Security boundaries

The design protects against accidental overwrite, offline loss, quota pressure, and cloud restore mistakes. Device storage remains protected by the phone operating system and browser profile. The existing PIN prevents casual app access but does not encrypt IndexedDB. Supabase authentication and row-level access remain responsible for cloud isolation.

Backups continue to exclude device PIN secrets, sync credentials, and runtime cache state.

## UI behavior

- Loading screen remains until storage initialization and migration finish.
- Dashboard and Sync page show phone-save state separately from cloud-backup state.
- Offline status says records are saved on the phone and waiting for backup.
- Storage failure warnings remain visible until a successful retry or explicit dismissal after export.
- Cloud restore explains that it replaces phone records and identifies the rollback snapshot.

## Error handling

- IndexedDB unavailable with valid legacy data: use legacy data for the session, retain it, and show a degraded-storage warning.
- IndexedDB unavailable without valid local data: show a blocking storage error rather than opening an empty writable app.
- Migration write or verification failure: retain legacy data and allow retry.
- Local write failure: keep the newest pending snapshot in memory, block cloud-complete status, and expose retry/export.
- Offline cloud request: retain pending status and retry on the next online event.
- Invalid cloud payload: reject it without changing phone state or recovery snapshots.
- Restore failure after checkpoint creation: reapply the checkpoint to memory and IndexedDB, keep pending status accurate, and retain the checkpoint.

## Testing strategy

Implementation follows red-green-refactor and uses an injectable storage adapter so Node tests do not depend on a real browser database.

Automated coverage includes:

- fresh IndexedDB initialization;
- successful legacy migration and verified legacy cleanup;
- interrupted or failed migration retaining legacy data;
- loading IndexedDB in preference to stale legacy data;
- coalescing rapid saves and preventing stale-write ordering;
- retry after transaction failure;
- local-save status and cloud-pending transitions;
- reconnect pushing only after durable local save;
- sign-in never auto-pulling;
- restore blocked by pending local data;
- restore checkpoint, validation, rollback, and retention limits;
- business data excluded from post-migration `localStorage`;
- storage estimate warnings;
- no required startup CDN URLs;
- complete service-worker pre-cache;
- non-navigation failures never falling back to HTML;
- existing Customer Book performance and all business-operation tests.

Browser verification installs the PWA online once, records data while offline, reloads offline, confirms the records remain, reconnects, confirms backup completion, and verifies no console or failed-script errors.

## Rollout

1. Ship local dependencies, storage module, migration, and service-worker cache update together.
2. Keep JSON backup import compatible with pre-migration exports.
3. Verify migration against representative existing phone backups before release.
4. Do not remove legacy `egg_app_data` until IndexedDB read-back verification succeeds on that device.
5. Push only after automated tests, offline browser verification, and a clean data-safety diff review.
