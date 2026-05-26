# PIN Lock Phase Design

## Goal

Add a simple owner PIN lock so the installed YOLK app can hide business records when opened on the laptop or iPhone.

## Scope

This phase adds a local privacy gate, not a full cloud login system. The PIN protects casual access to the app on a device after it opens. It does not encrypt Supabase data, local storage records, exported files, or browser developer tools.

## User Experience

If no PIN exists, the app opens normally. The owner can open Cloud Sync and use a new App Lock panel to set a 4 to 6 digit PIN.

If a PIN exists, the app shows the existing loading animation first, then displays a centered unlock screen. The dashboard and records remain covered until the correct PIN is entered. After unlock, the app stays open for the current browser session. A Lock Now button lets the owner manually lock it again.

The App Lock panel also lets the owner change the PIN or disable the lock. Changing or disabling requires the current PIN.

## Data Model

PIN settings are stored separately from business records in `localStorage` under `egg_pin_lock`. The synced business payload from `egg_app_data` remains unchanged, so the PIN is not copied to Supabase or another device.

The stored object contains:

- `enabled`: whether the local device should ask for a PIN.
- `pinHash`: a one-way local hash of the PIN.
- `createdAt`: local timestamp for display/debugging.
- `updatedAt`: local timestamp for display/debugging.

The app never stores the raw PIN after validation.

## Behavior Rules

PINs must contain only digits and be 4 to 6 characters long. Setup and change forms require matching confirmation. Unlock failures show a short inline message and keep the app locked.

The lock does not mark records as changed, queue cloud sync, or alter the business export data.

## UI Placement

The unlock screen is a fixed full-screen panel using the app's light visual system and existing logo. The App Lock management panel lives on the Cloud Sync page because the user already uses that area for phone/laptop access controls.

## Testing

Node tests cover PIN validation, setup, unlock failure/success, change, disable, local storage persistence, and keeping PIN data out of the synced business payload. HTML tests confirm the unlock screen, App Lock panel, and Lock Now button exist.
