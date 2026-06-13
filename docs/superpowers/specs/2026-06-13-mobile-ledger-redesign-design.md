# Mobile Ledger Redesign Design

## Goal

Upgrade YOLK from an average-looking inventory page into a polished, phone-first business app. The redesign should make daily work faster on iPhone while keeping the laptop layout clean, readable, and familiar.

## Design Direction

The approved direction is Option B: Mobile Ledger.

The app should feel like a light, installed mobile operations app:

- Light mode remains the default and primary design.
- Dark mode remains available and useful.
- The YOLK red is the main action and active-state color.
- Surfaces use soft off-white, white, charcoal text, subtle borders, and restrained shadows.
- Numbers use tabular alignment so cash, stock, and receivable values scan cleanly.
- Mobile pages prioritize touch comfort and visible hierarchy over dense tables.

## Scope

Included:

- A more polished global shell for desktop and mobile.
- A cleaner top bar with page title, current page context, and compact actions.
- A refined fixed bottom tab bar for mobile.
- A dashboard redesign focused on today's cash, stock, receivables, online wallets, and quick actions.
- More modern card-based mobile treatment for sales, customer order history, expenses, and receipt/weekly report surfaces.
- Consistent button, input, modal, badge, empty-state, and ledger-row styling.
- Accessibility-preserving focus states and touch target sizes.
- Tests that verify the redesigned shell and key UI controls remain present.

Not included:

- Changing stored data shape unless a small UI helper needs no migration.
- Changing sales, expenses, customer, payment, sync, backup, or PIN behavior.
- Adding stock alerts, analytics charts, or new business features.
- Replacing Alpine or Tailwind CDN with a build system.
- Making the app dark by default.

## Navigation

Mobile navigation uses the bottom tab bar only for top-level app sections:

- Dashboard
- Customers
- Closing
- Sales
- More

The `More` tab opens access to Expenses, Manual Adjustments, and Cloud Sync so the bottom bar does not become overcrowded. Contextual actions such as Add Payment, Cash Out, Weekly Report, Save Closing, and Export stay inside the current page instead of living in the tab bar.

Desktop navigation keeps the left sidebar because it works well on wider screens, but it should look more intentional: stronger active state, better spacing, cleaner quick stats, and matching icon treatment.

## Dashboard

The dashboard becomes the most polished screen because it is the first screen users see.

It should include:

- A hero summary card with Cash on Hand and Current Stock.
- Secondary metric tiles for Net Profit, Accounts Receivable, and online wallet balances.
- Quick action row for Weekly Report, Close Day, Add Sale, Add Expense, Cash Out, and Sync.
- A compact customer loan reminder card.
- Empty or low-data states that still look composed.

The design must not hide the existing edit controls for Cash on Hand and Current Stock. Those controls should become clearer icon/text actions inside the relevant cards.

## Ledgers and Customers

On mobile, long lists should feel like order cards rather than squeezed desktop tables.

Sales Ledger cards should show:

- Customer name
- Order date and paid date
- Egg type, tray count, and unit price
- Sale type and payment status
- Paid amount, balance, and payment account where available
- Add Payment and Remove actions where applicable

Customer order history should follow the same card language so editing names, merging customers, adding payments, and removing customers feel consistent.

Expenses Ledger cards should show:

- Category
- Date
- Amount
- Notes preview
- Edit/remove actions if existing behavior supports them

Desktop ledger tables can remain table-based, but should receive cleaner spacing, sticky-feeling section headers where reasonable, and consistent badges.

## Receipts and Weekly Report

The weekly report modal should feel like a modern report sheet:

- Larger report title and date range.
- Summary cards for sales, expenses, cost, net profit, cash, and receivables.
- Sales and expenses sections with modern list rows.
- Clear export action.
- Better mobile sizing so the report feels like a sheet, not a cramped popup.

The existing report calculations should not be changed as part of the visual redesign unless tests reveal a current display bug.

## Components

Because this is a single-file app, the first pass should use reusable CSS utility classes and small Alpine helper methods rather than a framework migration.

Create or refine these component patterns:

- `app-shell`: body background, top bar, desktop sidebar, mobile bottom navigation.
- `surface-card`: standard card surface for dashboard and reports.
- `metric-card`: numeric summaries with label, value, helper text, and optional action.
- `ledger-card`: mobile-first card pattern for sales, expenses, and customer history.
- `action-button`: primary, secondary, subtle, danger, and icon button styles.
- `status-badge`: paid, partial, unpaid, loaned, regular, history-only, and online-wallet states.
- `modal-sheet`: consistent modal sizing and header/footer treatment.

## Data Flow

The redesign should read from the same Alpine state and methods already used by the app.

Allowed helper additions:

- Page title and page context helpers can be reused or refined.
- Navigation helpers can add a `More` menu state.
- Formatting helpers can support cleaner display text.

Disallowed changes:

- Do not recalculate business totals differently.
- Do not add past orders to current stock, Cash on Hand, Net Profit, or Accounts Receivable.
- Do not count online wallet payments as Cash on Hand until cash out.

## Error Handling and States

The redesign should improve visual states without changing business rules:

- Empty ledgers show a clean empty card instead of leaving blank space.
- Form focus states remain visible.
- Buttons have hover, active, and disabled states where applicable.
- Modals remain readable on mobile and desktop.
- Reduced motion keeps the loading screen and transitions usable.

## Testing

Add or update tests for:

- Mobile bottom navigation includes the approved top-level sections and a More entry.
- More menu exposes Expenses, Manual Adjustments, and Cloud Sync.
- Dashboard still renders Cash on Hand edit, Current Stock edit, online wallets, and daily closing controls.
- Sales/customer/payment controls remain present after the ledger redesign.
- Weekly report modal still renders the modern sheet and export action.
- Existing business behavior tests continue passing.

Verification commands:

- `node --test tests\manual-adjustments.test.js`
- `node --check service-worker.js`
- `git diff --check`

## Rollout

Implement in small visual slices:

1. Shared style foundation and shell.
2. Mobile navigation and More menu.
3. Dashboard redesign.
4. Ledger/customer mobile cards.
5. Receipt/weekly report polish.
6. Final consistency pass and cache bump.

Each slice should preserve existing app behavior before moving to the next.
