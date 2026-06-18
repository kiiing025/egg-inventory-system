# Activity History and Undo Design

## Goal

Reduce bookkeeping mistakes without slowing down everyday sales, restocking, expenses, payments, or wallet transfers. The app should provide a brief Undo action after a change and a separate Activity History page for reviewing and safely reversing older changes.

## Design Principles

- Keep Record Sale and other daily forms fast and uncluttered.
- Show protection only after a change or when a problem is detected.
- Preserve an honest history instead of silently rewriting financial records.
- Use the same business calculations for normal actions and reversals.
- Keep the feature responsive on both the laptop and iPhone.

## User Experience

After a protected action succeeds, a compact toast appears for 10 seconds. It names the completed action and provides an `Undo` button. The toast does not block the screen or require another confirmation.

A separate Activity History page is available from desktop navigation and the mobile menu. It displays the newest activity first and loads 25 records at a time. The page includes:

- Search by customer, category, note, wallet, or egg type.
- Filters for All, Sales, Money, Stock, Customers, and Products.
- A concise summary for each activity.
- Date, time, action type, and affected amount or quantity.
- Expandable before-and-after details for edits.
- A `Reverse` action when the change can still be reversed safely.

The regular dashboard and entry forms do not gain extra cards or confirmation screens.

## Protected Actions

Activity records and Undo support cover:

- Creating, editing, deleting, collecting, or partially paying a sale.
- Creating, editing, or deleting an expense.
- Restocking and manual stock corrections.
- Manual physical cash corrections.
- Online wallet payments and transfers to physical cash.
- Creating, renaming, merging, or removing customers.
- Adding or editing egg types, prices, costs, stock, or active status.

Routine navigation, report viewing, cloud status checks, and form typing are not recorded.

## Reversal Rules

- Undoing a new sale removes its current effects from stock, physical cash, online wallets, and accounts receivable.
- Undoing a sale or expense edit restores the complete previous record and recalculates all affected balances.
- Undoing a deletion restores the original record with its original identifier and values.
- Undoing a partial payment restores the previous paid amount, balance, payment status, and destination balance.
- Undoing a wallet transfer reduces physical cash and restores the source wallet. It is blocked if the reversal would create an invalid physical cash balance.
- Undoing a stock action is blocked if it would make an egg type's stock negative.
- Undoing a product price change restores the prior catalog price without changing unit prices already stored on past sales.
- Undoing a customer rename or merge restores the original names and order ownership from the saved before-state.
- A completed reversal creates its own activity record and marks the original activity as reversed. The same activity cannot be reversed twice.

If an older action conflicts with newer business activity, the app explains why it cannot be reversed and leaves all data unchanged.

## Mistake Prevention

The feature also adds focused validation at the point of entry:

- Warn about a possible duplicate sale when customer, order date, egg type, and tray quantity match a recent sale. The owner can deliberately continue.
- Block negative stock.
- Block payments above the remaining balance unless the form explicitly supports change or overpayment later.
- Block wallet transfers above the source wallet balance.
- Block invalid, blank, negative, or nonnumeric money and quantity values.
- Display the exact cash, wallet, receivable, and stock effects before reversing an older activity.

## Data Model

Add `activityLog: []` to the existing persisted and cloud-synced business state. Each entry stores compact action data:

- `id`: unique activity identifier.
- `actionType`: stable machine-readable action name.
- `entityType` and `entityId`: affected business record.
- `summary`: short reader-facing description.
- `occurredAt`: ISO date and time.
- `before` and `after`: only the record values needed to review or reverse the action.
- `effects`: physical cash, wallet, receivable, profit, and stock differences.
- `note`: optional correction or reversal note.
- `reversalOf` and `reversedBy`: links between an action and its reversal.

Existing installations migrate by initializing an empty activity log. Historical business records remain unchanged; activity tracking begins after the feature is installed.

## Action Recording

Protected mutations run through one action-recording boundary:

1. Validate the requested change.
2. Capture the relevant before-state.
3. Apply the business mutation once.
4. Recalculate derived totals using existing calculation helpers.
5. Capture the after-state and financial or stock effects.
6. Append one activity record.
7. Persist locally and mark cloud data as needing sync.
8. Show the temporary Undo toast.

Reversal operations use the same mutation and calculation helpers with activity recursion disabled. This avoids duplicating financial formulas inside the history feature.

## Performance and Retention

- Render only 25 activities at a time.
- Search and filter a bounded activity list instead of repeatedly recalculating business totals during rendering.
- Keep the newest 1,000 activities in active app data to prevent the synced payload from growing without limit.
- Include activity history in downloaded JSON backups.
- Remove only the oldest entries after the 1,000-entry limit is exceeded; never remove current sales, expenses, customers, balances, or inventory.

## Cloud Sync and iPhone Data Safety

The iPhone currently contains the newest business data and is the source of truth for rollout.

Before using the updated feature:

1. On the iPhone, confirm Cloud Sync reports that its latest changes are uploaded.
2. Do not manually push the laptop's older business state to Supabase.
3. Open the updated app and pull the cloud copy before recording new laptop transactions.
4. Confirm recent iPhone sales, expenses, wallet balances, cash, receivables, and stock are present.
5. Create a downloaded backup before the first real Undo test.

Feature development and automated tests use isolated test state and must not connect to or mutate the owner's Supabase data.

Activity entries are part of the same persistable state as the related business records, so a synced action and its history travel together. Existing cloud-merge protections for historical orders remain in effect.

## Error Handling

- Validation failure: show a specific message and write no business or activity data.
- Persistence failure: keep the current in-memory state, show that saving failed, and do not claim the action is synced.
- Unsafe reversal: explain the conflicting balance or stock condition and make no partial changes.
- Missing target record: mark the activity as unavailable for reversal while keeping it visible for review.
- Duplicate reversal attempt: reject it without changing data.
- Cloud sync failure: retain the local activity and show the existing unsynced status until synchronization succeeds.

## Testing

Automated tests will cover:

- Activity records for every protected action type.
- Correct before, after, and effects data.
- Immediate Undo for sales, expenses, payments, stock, cash, wallets, customers, and products.
- Older reversal from Activity History.
- Restoring physical cash, wallet balances, receivables, and per-size stock exactly.
- Profit remaining unchanged for wallet-to-physical-cash transfer and its reversal.
- Old sale prices remaining unchanged after catalog price reversals.
- Duplicate sale warnings and numeric validation.
- Blocking unsafe or duplicate reversals without partial mutation.
- Persistence, backup inclusion, cloud state inclusion, and empty-log migration.
- Pagination and filtering without rendering the entire history.
- Existing regression tests continuing to pass.

## Non-Goals

- Multi-user staff permissions or identifying which employee made a change.
- Formal double-entry accounting.
- Restoring activity older than the retained 1,000 entries.
- Automatically changing or deleting historical orders during migration.
- Sending notifications for every activity.
