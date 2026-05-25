# Daily Closing Report Design

## Goal

Add a saved daily closing workflow so the owner can end the day with a simple snapshot of sales, expenses, cash, loans, and stock. The report should work like a daily business notebook, not a strict accounting lock.

## Scope

Daily closing will use the records already stored in the app. It does not require a new Supabase table because the existing sync payload can include a `dailyClosings` array.

Included:

- Daily Closing page in desktop navigation.
- Dashboard shortcut to close today.
- Closing form with editable date and optional notes.
- Saved closing history, newest first.
- A summary snapshot for the selected date.
- Ability to update an existing closing for the same date.
- Daily closings included in local storage and Supabase sync state.

Not included:

- Locking a day against edits.
- Formal accounting reconciliation.
- Printing or sharing the daily closing.
- Automatic close at a scheduled time.

## Metrics

For the selected closing date, the app calculates:

- `orderCount`: number of sales ordered that day.
- `eggsSold`: total eggs ordered that day.
- `salesRevenue`: total value of orders placed that day.
- `collectedRevenue`: money collected that day based on paid dates.
- `expenseTotal`: expenses recorded that day.
- `netCashChange`: collected revenue minus expenses.
- `outstandingLoans`: current unpaid loan total at closing time.
- `cashOnHand`: current cash on hand at closing time.
- `stockOnHand`: current inventory count at closing time.

## User Experience

The dashboard shows a compact Daily Closing card with today's closing status and a button to open the page.

The Daily Closing page has two main areas:

- Today/selected date preview with metrics and notes.
- Saved closing history with date, cash, stock, sales, expenses, and notes.

Pressing `Save Closing` stores a snapshot. If that date already has a closing, the app updates the existing snapshot instead of creating a duplicate.

## Data Flow

The app adds:

- `dailyClosings: []`
- `dailyClosingForm.date`
- `dailyClosingForm.notes`

The closing snapshot is derived from the existing `sales`, `expenses`, `inventory`, `cashAdjustments`, and `stockAdjustments`. Saved snapshots are persisted through `getPersistableState()` and restored through `applyPersistedState()`.

## Error Handling

If no closing date is selected, saving fails and shows an alert. If there are no records for a date, the app still allows saving a closing with zero values so the owner can record that the day was checked.

## Testing

Add tests for:

- Daily closing page and dashboard shortcut rendering.
- Daily closing summary calculations.
- Saving a new closing.
- Updating an existing closing for the same date.
- Persisting `dailyClosings` in app state.

## Later Upgrade Reminder

After this phase, remind the owner that the remaining approved upgrades are:

- Better Auto Sync Status.
- PIN Lock.
- Export and Backup.
