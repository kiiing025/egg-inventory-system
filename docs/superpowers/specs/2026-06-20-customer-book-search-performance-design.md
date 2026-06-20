# Customer Book Search Performance Design

**Date:** 2026-06-20
**Status:** Approved for planning

## Problem

Typing in the Customer Book search field is slow because each reactive search update repeatedly rebuilds the complete customer summary collection. The current page calls `getCustomerSummaries()`, `getFilteredCustomerSummaries()`, and `getSelectedCustomerSummary()` throughout the template. A selected-customer lookup can rebuild summaries twice, so one search render currently performs 31 complete summary builds.

A diagnostic benchmark with 2,500 orders across 500 customers took about 23 seconds for the same set of calculations used by one Customer Book render. Debouncing would reduce how often that work runs, but it would not remove the repeated work and would make search feel delayed.

## Goals

- Keep the search field responsive while the user types.
- Build expensive customer summaries at most once while business data is unchanged.
- Reuse the prepared summaries for each search query.
- Refresh cached data automatically after sales, payments, imports, restores, sync pulls, customer edits, and customer removals.
- Preserve current search results, selected-customer behavior, order history, totals, and payment actions.
- Add deterministic regression coverage for the performance problem and nearby stale-data risks.

## Non-goals

- Redesigning or paginating the Customer Book.
- Changing the persisted business-data schema.
- Storing the cache in local storage, backups, or cloud sync.
- Using debounce as the primary fix.
- Refactoring unrelated dashboard or ledger code.

## Design

### 1. Separate summary construction from view derivation

Introduce a dedicated summary builder containing the existing grouping, totals, date calculation, and history sorting logic. `getCustomerSummaries()` becomes the cached accessor instead of rebuilding the collection directly.

The in-memory cache records:

- the current Customer Book data revision;
- the prepared customer-summary array;
- the last normalized search query and selected key;
- the last derived view containing `filtered`, `selected`, and `isEmpty`.

The cache is runtime-only and is never included in `getPersistableState()`.

### 2. Invalidate by business-data revision

Maintain a small numeric Customer Book revision. Invalidating the cache increments the revision and clears the derived view.

The central persistence path invalidates whenever an in-memory business mutation reaches persistence, even if the local-storage write later fails. Direct state-replacement paths—initial load, backup restore, historical import, and cloud pull—must also invalidate before the UI can render the replacement data. It is acceptable for expense-only changes to invalidate the cache; correctness is more important than optimizing rare writes.

Search text and selected-customer changes do not invalidate the prepared summaries because neither changes business data.

### 3. Derive one Customer Book view per search state

A `getCustomerBookView()` accessor uses the prepared summaries to produce the filtered list and selected customer once for each combination of:

- Customer Book revision;
- normalized search query;
- selected customer key.

Repeated template expressions during the same render receive the same view object. Existing `getFilteredCustomerSummaries()` and `getSelectedCustomerSummary()` methods delegate to that view so existing actions remain compatible.

Current selection semantics remain unchanged: an existing selected customer remains selected even if the search query does not match; otherwise the first filtered customer is selected for display, falling back to the first customer when appropriate.

### 4. Template cleanup

The Customer Book template reads the cached view rather than independently triggering full summary calculations for the list, empty state, and detail panel. The visible layout and controls remain unchanged.

### 5. Adjacent stability audit

The implementation pass will verify Customer Book behavior for:

- no search matches;
- customer removal and renaming;
- adding and editing orders;
- collecting or adding a payment;
- backup restore and cloud data replacement;
- stale selected-customer keys;
- browser console errors during rapid typing.

Only issues directly caused by or exposed through the Customer Book data flow are in scope.

## Error handling and data safety

If no customers exist, the derived view returns an empty filtered list and a `null` selected customer. Cache invalidation is synchronous, so the next read rebuilds from current in-memory sales. No cache content is persisted, synced, exported, or allowed to overwrite business records.

## Testing strategy

Implementation follows red-green-refactor:

1. Add a failing regression test proving repeated Customer Book reads rebuild summaries more than once today.
2. Add a failing test proving changing only the search query should not rebuild prepared summaries.
3. Implement the minimal summary and derived-view caches.
4. Add invalidation tests for record creation, customer edits/removal, payments, restore, and cloud replacement paths.
5. Preserve existing customer grouping, filtering, selection, and totals tests.
