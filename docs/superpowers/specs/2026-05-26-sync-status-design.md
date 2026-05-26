# Better Auto Sync Status Design

## Goal

Make the laptop and iPhone sync state easier to trust at a glance. The owner should be able to tell whether the app is online, signed in, saving, waiting to save, up to date, or in an error state without guessing.

## Scope

This phase improves sync visibility and status tracking. It does not change the Supabase table schema and does not add record-by-record conflict resolution.

Included:

- Clear sync health status labels.
- Online/offline awareness.
- Unsynced local changes indicator.
- Last local change timestamp.
- Last cloud save timestamp.
- Last cloud load timestamp.
- Last sync error message.
- Dashboard sync card.
- Cloud Sync health panel.
- Local metadata persistence for device-specific sync state.

Not included:

- Full conflict merge UI.
- Background sync when the app is fully closed.
- Record-level comparison between laptop and iPhone.
- Push notifications.

## Status Rules

The app should show one of these health states:

- `Needs setup`: Supabase URL or key is missing.
- `Offline`: the browser reports no internet connection.
- `Needs sign in`: Supabase is configured but no user is signed in.
- `Saving`: a push or pull is in progress.
- `Sync error`: the last cloud operation failed.
- `Unsynced`: local changes exist but have not reached the cloud.
- `Up to date`: local data has been saved to or loaded from cloud.
- `Ready`: signed in and ready, but no cloud sync has happened yet.

## Data Flow

Business data remains in `egg_app_data`. Device sync metadata is stored separately in local storage under `egg_sync_meta` so timestamps such as last local change and last cloud load stay specific to each device.

Local changes call a helper that records `syncLastLocalChangeAt` and marks `syncPendingChanges` as true. A successful push clears `syncPendingChanges` and stores `syncLastCloudSaveAt`. A successful pull clears pending changes and stores `syncLastCloudLoadAt`.

## User Experience

The dashboard gets a compact sync card showing the health label and one useful detail, such as `Unsynced changes waiting` or `Last cloud save: ...`.

The Cloud Sync page gets a health panel with:

- Connection.
- Account.
- Local changes.
- Cloud save.
- Cloud load.
- Last error.

Manual Push and Pull buttons remain available.

## Error Handling

If the app is offline, automatic push should not run. Local changes stay marked as unsynced. When the browser comes back online, the app may attempt the queued auto-save if the user is signed in.

If push or pull fails, the app stores the error message in `syncLastError` and shows `Sync error` until a later successful cloud operation clears it.

## Testing

Add tests for:

- Marking local changes as unsynced.
- Health label priority for offline, signed out, unsynced, error, saving, and up to date.
- Successful push metadata updates.
- Successful pull metadata updates.
- Sync dashboard and health panel rendering.

## Later Upgrade Reminder

After this phase, remind the owner that the remaining approved upgrades are:

- PIN Lock.
- Export and Backup.
