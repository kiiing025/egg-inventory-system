# Export and Backup Phase Design

## Goal

Add a simple Backup Center so the owner can save a full copy of YOLK records and restore that copy later if a device loses data or sync gets confusing.

## Scope

This phase adds local file backup and restore. It does not replace Supabase cloud sync, and it does not create scheduled backups. The existing weekly report stays as the readable Excel/reporting export.

## User Experience

The Cloud Sync page gains a Backup Center panel. The owner can download a full JSON backup file, paste backup JSON into a restore box, preview the counts, and restore the backup after confirmation.

The panel shows backup counts for sales, expenses, cash edits, stock edits, daily closings, customers, inventory, cash on hand, and outstanding loans. It also shows the last backup action message.

## Backup Data

Backup files contain:

- `app`: `YOLK Inventory`
- `version`: `1`
- `exportedAt`: local ISO timestamp
- `summary`: record counts and key totals
- `data`: the existing `getPersistableState()` payload

Backups include business records only. They do not include PIN lock settings, Supabase credentials, Supabase session data, sync metadata, or browser theme preference.

## Restore Rules

The restore flow accepts either a full YOLK backup file or a raw `egg_app_data` style object. It validates that the payload is an object, normalizes missing arrays to empty arrays through the existing `applyPersistedState` method, persists the restored records, and queues sync like any other local data change.

If JSON is invalid or missing usable business data, the restore is rejected with an inline message and current records stay unchanged.

## Testing

Node tests cover backup payload shape, summary counts, filename format, JSON export, restore preview, restore success, invalid restore rejection, sync-change marking after restore, and ensuring PIN/sync secrets stay out of backup JSON. HTML tests confirm the Backup Center UI exists on the Cloud Sync page.
