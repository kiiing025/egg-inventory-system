# Entry Success Feedback Design

## Goal

Give immediate, calm confirmation after a successful Record Sale, Restock, or Record Expense action without adding visual clutter or changing transaction calculations.

## Interaction Design

Each of the three dashboard entry cards receives the same two-part confirmation:

1. The submitted card briefly lifts and shows a soft accent-colored glow.
2. Its submit button temporarily changes to a checkmark and `Added`, then returns to its normal label.

At the same time, the existing Undo notification remains the single persistent feedback surface. It appears at the lower right on desktop and above the bottom navigation on mobile. Its main message stays contextual:

- `Sale added for <customer>`
- `<quantity> <egg type> eggs restocked`
- `<category> expense added`

The notification keeps its Undo button and does not introduce a second toast system.

## Behavior

- Feedback runs only after the corresponding action passes validation and is added successfully.
- Failed validation does not animate the card or show an Added button state.
- A new successful entry replaces any previous temporary card/button animation cleanly.
- The success state resets automatically after about 1.2 seconds.
- Existing Activity History and Undo behavior remains unchanged.
- Sale, stock, cash, expense, payment, and synchronization calculations are not modified.

## Implementation Shape

Add one temporary Alpine state object that identifies the active entry type (`sale`, `restock`, or `expense`) and owns the reset timer. A shared helper starts the success state after a successful mutation. The three cards bind a success class and their buttons bind temporary success text from that state.

CSS supplies one short lift/glow keyframe with color variants matching the existing amber, blue, and rose actions. The effect uses transforms and opacity only so it remains lightweight on mobile.

## Accessibility

- `prefers-reduced-motion: reduce` disables the lift/glow animation while preserving the textual `Added` confirmation and Undo notification.
- The effect does not move focus, block input, or require interaction.
- Button labels remain readable in light and dark mode.

## Testing

Automated tests will verify:

- All three entry cards are wired to the shared success state.
- Successful sale, restock, and expense actions activate the correct feedback type.
- Validation failures do not activate success feedback.
- The state reset helper clears the active feedback.
- Reduced-motion CSS is present.

An isolated browser check will submit one sale, one restock, and one expense and confirm the contextual notification, temporary Added state, Undo availability, and absence of console errors. No Supabase account will be connected during verification.
