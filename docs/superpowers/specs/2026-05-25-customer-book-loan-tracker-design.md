# Customer Book and Loan Tracker Design

## Goal

Add a focused customer page that makes repeat buyers and unpaid loans easy to manage without crowding the dashboard. The page should help the owner quickly answer: who ordered, who still owes money, how much they owe, when they last ordered, and what their history looks like.

## Scope

Phase 1 adds customer organization on top of the existing sales records. It does not require a new database table because the app already stores customer names, order dates, paid dates, sale type, and paid status in each sale. Customer summaries are derived from the sales ledger so older records remain compatible.

Included:

- Customer Book page in desktop and mobile navigation.
- Searchable customer list derived from sales records.
- Customer summary cards showing total orders, unpaid balance, last order date, and latest payment date.
- Customer detail panel with order history.
- Loan-focused actions, including marking one unpaid sale as paid from the customer page.
- Dashboard reminder for unpaid customer balances.
- Persistable state remains compatible with local storage and Supabase sync.

Not included in Phase 1:

- Scheduled reminders or SMS messages.
- Separate customer contact fields.
- Automatic debt due dates.
- Excel export.

## User Experience

The new Customers page should feel like a working business notebook. At the top, the owner sees total customers, total unpaid balances, and count of customers with open loans. Below that, search helps find a customer by name.

Selecting a customer opens a detail area showing their unpaid amount, regular paid sales, loaned sales, last order, and order history. Loaned unpaid rows include a paid action so collection can happen from the customer view instead of hunting through the sales ledger.

On mobile, Customers should be reachable from the bottom navigation because it becomes a daily-use page. The existing separate ledgers and adjustments remain available from desktop navigation and page controls.

## Data Flow

Sales remain the source of truth. A computed `customerSummaries` list groups sales by normalized customer name and calculates:

- total order count
- total eggs bought
- total sales value
- unpaid loan amount
- unpaid order count
- last order date
- last paid date
- sales history sorted newest first

Marking a customer loan as paid updates the matching sale record, sets `paid` to true, stores the editable paid date, and persists through the existing local storage and Supabase sync flow.

## Error Handling

Empty customer names are shown as `Walk-in Customer` so records do not disappear. If no customer exists, the page shows an empty state. If a selected customer no longer exists after deleting sales, the app falls back to the first available customer or no selection.

## Testing

Add focused tests for:

- Customer page and navigation rendering.
- Customer summaries grouping sales correctly.
- Unpaid loan totals and counts.
- Marking a loan paid from the customer page.
- Persistable sync state still containing sales and business records.

## Later Upgrade Reminder

After Phase 1 is complete, remind the owner about the remaining approved upgrades:

- Stock Alerts.
- Daily Closing Report.
- Better Auto Sync Status.
- PIN Lock.
- Export and Backup.
