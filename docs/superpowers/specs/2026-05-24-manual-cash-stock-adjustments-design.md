# Manual Cash and Stock Adjustments Design

## Goal

Add direct edit controls for the dashboard's Cash on Hand and Current Stock cards so the user can correct real-world exceptions, such as emergency cash changes or cracked egg trays, without recording a fake sale, expense, or restock.

## Scope

- Add an Edit button to the Cash on Hand metric card.
- Add an Edit button to the Current Stock metric card.
- Let the user set the current cash or stock value directly.
- Save each manual change with date, old value, new value, difference, and an optional note.
- Show a recent adjustment ledger in the app so manual changes remain traceable.
- Persist the new data in the existing `egg_app_data` localStorage object.

## Current Behavior

Cash on Hand is calculated as paid sales minus expenses. Current Stock is stored as `inventory` and changes through sales, restocks, and sale deletion.

## Proposed Behavior

Cash on Hand will be calculated as:

```text
paid sales - expenses + manual cash adjustments
```

Current Stock will remain the stored `inventory` value. A stock edit will set `inventory` directly and record the difference as a stock adjustment.

## UI Design

Each affected dashboard card gets a small Edit button near the label or value.

Clicking Edit opens a compact modal with:

- Current value
- New value input
- Optional note input
- Cancel button
- Save button

The modal title and input formatting change based on the adjustment type:

- Cash uses Philippine peso formatting and accepts decimal values.
- Stock uses whole egg counts and rejects negative values.

## Data Model

The existing localStorage payload will add:

```js
cashAdjustments: [
  {
    id,
    date,
    oldValue,
    newValue,
    difference,
    note
  }
],
stockAdjustments: [
  {
    id,
    date,
    oldValue,
    newValue,
    difference,
    note
  }
]
```

Older saved data without these arrays will load with empty adjustment lists.

## Validation

- Cash new value is required and must be a valid number.
- Stock new value is required, must be a whole number, and cannot be below `0`.
- Save does nothing and shows an alert if validation fails.
- Cancel closes the modal without changing app state.

## Testing

Because this is a single static Alpine app with no existing automated test runner, add a small browser-based regression test file or script that can load `index.html`, exercise the Alpine component logic, and verify:

- Cash adjustments affect Cash on Hand.
- Stock adjustments set inventory directly.
- Both adjustment types are persisted in the same localStorage payload.
- Invalid stock values are rejected.

Manual browser verification should also cover opening the modal from both metric cards and confirming the updated values render correctly.
