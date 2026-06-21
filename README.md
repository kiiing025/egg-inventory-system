# YOLK Inventory System

YOLK is a phone-friendly inventory, sales, customer, expense, and cash-tracking app for an egg business. It works offline after its first successful install and keeps the phone as the primary copy of the business data.

## Run the app

The app must be served from `localhost` during development or from an HTTPS website in production. Do not open `index.html` through a `file://` URL because service workers, offline installation, and browser storage protections do not work correctly there.

```powershell
git clone https://github.com/kiiing025/egg-inventory-system.git
cd egg-inventory-system
npm ci
npm run build
python -m http.server 8000
```

Open `http://localhost:8000`. On a phone, deploy the folder to an HTTPS host, open it once while online, then use the browser's **Add to Home Screen** or **Install App** option.

## Offline and phone storage

- The app shell is cached locally after the first successful online load.
- Sales, expenses, customers, inventory, payments, and settings are saved in IndexedDB on the phone.
- Existing `egg_app_data` records are migrated from localStorage only after the IndexedDB copy is written and verified.
- Rapid changes are saved in order, with the newest state winning.
- The loading screen waits for phone storage so an empty app cannot silently replace saved records.
- Browser theme, PIN-lock metadata, and cloud-sync status remain device-local and are not included in business-data backups.

Use the same browser and installed app. Do not clear the browser's site data. The Backup Center shows save status, storage pressure, and up to three rollback snapshots. Export a JSON backup regularly as an additional copy outside the browser.

## Cloud backup behavior

Supabase is optional and acts as a backup for the phone; it is not the primary database.

- Offline changes remain on the phone and are marked for backup.
- When connectivity returns and the user is signed in, pending phone changes are backed up automatically.
- Signing in never downloads or replaces phone data.
- **Back Up Now** uploads the latest successfully saved phone snapshot.
- **Restore Cloud Backup** is explicit and is blocked while phone changes are unsaved or waiting for backup.
- Before a cloud restore replaces phone records, YOLK creates a local rollback snapshot.

Configure Supabase in `sync-config.js`. Never commit a service-role key; the browser configuration must use the public anonymous key with Row Level Security enabled.

## Development checks

```powershell
npm test
node --check storage.js
node --check service-worker.js
npm audit --audit-level=high
```

The runtime libraries and generated Tailwind stylesheet are committed locally so the installed app does not depend on a CDN while offline.
