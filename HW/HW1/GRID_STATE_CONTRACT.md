# Data Grid State Contract — T-02.2

Planning document only. No Data Grid behavior is implemented in this task.

## State to track

- **Sort:** active `accessorKey` (`keyof T`) or none, plus ascending/descending direction. Only columns explicitly marked `sortable: true` can activate sorting; omitted `sortable` means not sortable. Initial sort: none.
- **Filter:** the current text query, initially empty. Which columns are searched remains an open question; do not implement filtering until approved.
- **Page:** a 1-based current page index, initially 1. Page size remains an open question.
- **Keyboard focus:** current visible row/cell location, or none if there are no focusable cells. Focus must be reconciled when visible rows change. Exact arrow-key and Enter/Space behavior remains an open question.
- **Selection:** selected record identity or none. `onRowSelect` is optional; absence must not throw. The identity strategy and what happens when a selected record is removed or filtered out remain open questions.

## Derived data and operation order

1. Start with `data` provided by the caller; do not mutate it.
2. Apply the approved filter to obtain matching rows.
3. Sort a copy of those rows if a sortable column is active; otherwise preserve their order. Comparator behavior for mixed, missing, and non-string values needs confirmation.
4. Paginate the filtered/sorted rows using the approved page size.
5. Render only the current page and derive accessible status information from the resulting view.

## Changes and edge cases

- When a filter changes, return to page 1; if data changes, clamp the page to the available page range.
- For zero matches, expose an empty state, with no selectable or focusable data cells; page controls must not point to a nonexistent page.
- When the focused cell disappears after sorting, filtering, pagination, or data replacement, move focus to a valid visible location or to an appropriate grid control; never leave a stale focus reference.
- Selection and focus are separate state. Behavior for selection of filtered-out/removed records is unresolved and must be approved before implementation.
- Sorting and filtering must not modify the caller's `data` array or record objects.

## Open questions / blockers

- The copied requirement `Zero div-soup: Must use native...` is incomplete; the required native HTML tags are unknown. Do not guess them.
- Confirm filter scope, page size, sort comparison/toggle rules, row identity, selection persistence, and keyboard focus/activation model before implementing those features.
- No WCAG 2.2 AA or Lighthouse score is claimed by this planning document.
