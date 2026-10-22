# Data Grid State Contract

This contract describes the implemented HW1 grid behavior.

## Public API

`ColumnDef<T>` exposes a header, a `keyof T` accessor, and an optional
`sortable` flag. A column is sortable only when `sortable: true`.
`DataGridProps<T>` requires data, columns, and an accessible grid label;
`onRowSelect` remains optional.

## State and data flow

- Filtering starts empty and searches all displayed columns case-insensitively.
- Sorting starts inactive. Sortable values are compared stably; missing values
  remain last in either direction. Mixed primitive values use natural
  case-insensitive string order.
- Pagination uses 10 rows per page. Filtering and changing sort reset the page
  to page 1; data changes clamp the requested page to the current result range.
- The grid derives rows in this order: filter, sort, paginate.
- Operations work on copies and do not mutate the caller's data or records.

## Keyboard focus and selection

- The grid uses one tabbable visible cell. Arrow keys move within the current
  page and stop at its boundaries. Enter and Space select the focused row;
  Space does not scroll the page. Tab and Shift+Tab are not intercepted.
- Focus is clamped to a valid visible cell when the visible result changes. If
  there are no visible rows, focus returns to the filter input.
- Selection is single-row and tracked by record reference identity. A selected
  record remains selected while filtered out or paginated away; if that same
  object appears again it is shown as selected. Replacing it with a distinct
  object does not select the replacement.
- Selection is independent of focus. The callback is optional and runs once per
  selection action. The grid announces the selected row.

## Semantics and responsive behavior

- The grid uses a native `table`, `thead`, `tbody`, `tr`, `th`, and `td`
  structure, with an accessible grid name and explicit row/header/cell roles.
- Each data cell references its column header using the `headers` attribute.
- Sort state is exposed with `aria-sort`; row selection is exposed using
  `aria-selected`.
- On narrow viewports the table scrolls inside a named, keyboard-focusable
  horizontal region rather than widening the page.

## Verification limitations

Automated tests, typecheck, production build, browser layout checks, and
Lighthouse can be run locally. Screen-reader behavior still requires manual
verification with an assistive technology; Lighthouse is not a substitute.

The original copied phrase “Zero div-soup: Must use native...” was incomplete.
The project owner approved the current semantic native table structure; no
additional required tag list was supplied.
