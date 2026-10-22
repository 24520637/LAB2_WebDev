# AI Failure Audit

## T-03.1–T-03.3 — Grid foundation

- **Prompt that caused the error:** Read TASK_DECOMPOSITION.md and PROJECT_RULE.md first. Implement only T-03.1 to T-03.3.
Build the accessible grid structure, render generic columns and records, and handle empty data. Use semantic HTML and the approved ARIA structure. Do not add sorting, filtering, or pagination yet.
Run relevant tests, inspect the diff, update AI_FAILURE_AUDIT.md, fix confirmed defects, retest, and commit only when the module passes.
Commit: feat: implement accessible data grid foundation
- **Error:** While creating the temporary verification demo for T-03, a second default `App` function was added without removing the original. This temporarily caused TypeScript compilation to fail.
- **Detection:** `npm run typecheck` reported duplicate default exports and duplicate function implementations (`TS2323`, `TS2393`).
- **Fix:** Removed the duplicate from the temporary demo, verified typecheck, then restored the original `App.tsx`.
- **Status:** Fixed; the restored app passed the final typecheck and production build. Review of T-03.1–T-03.3 found no remaining confirmed defect in the grid component.

## T-04.1–T-04.2 — Sorting
- **Prompt that caused the error:** Read TASK_DECOMPOSITION.md and PROJECT_RULE.md first. Implement T-04.1 and T-04.2: sorting in both directions, sortable-column restrictions, and accessible sort state.
Include tests for strings, numbers, missing values, and non-sortable columns. 
Commit: feat: add sortable column support
- **Error found during review:** Numeric comparison used subtraction. Comparing equal infinities (for example, `Infinity - Infinity`) produces `NaN`, which can make the comparator treat distinct numeric values as equal and return an incorrect order.
- **Detection:** Added ascending/descending regression coverage for positive and negative infinity alongside `NaN`, plus coverage for mixed number, string, and bigint values.
- **Fix:** Compare numeric values with `<` and `>` instead of subtraction. Keep `null`, `undefined`, and `NaN` at the end in either direction; compare other value combinations by their string representation with a numeric-aware collator, preserving original order for ties.
- **Status:** Fixed. All 9 focused sorting tests pass; `npm run build` passes; browser smoke testing verified ascending/descending row order, the active `aria-sort` state, and no sort button or ARIA sort state on the non-sortable column.

## Final completion review — 2026-10-22

- **Defect found:** The sorting helper and its unit tests existed, and the demo
  marked columns sortable, but `DataGrid` did not call the helper. The user
  interface therefore could not sort rows.
- **Detection:** Reviewed the component's full filter/pagination pipeline and
  confirmed the `sortRows` helper was never called by `DataGrid`. Added
  component tests for ascending/descending sorting, non-sortable columns, sort
  state, sorting after filtering, and page reset; all pass after the fix.
- **Fix:** Connected the stable sorting helper between filtering and pagination,
  reset the requested page on sort changes, and exposed `aria-sort` and native
  sort buttons for explicitly sortable headers.
- **Additional test defect found:** The stale-page reproduction test asserted a
  hard-coded failure from manually slicing a filtered array instead of testing
  the grid. Replaced it with a component-level regression test; it now verifies
  filtering from page 3 actually returns five matching rows on page 1.
- **Lighthouse defects found:** The production build lacked a favicon and meta
  description, and had no valid robots.txt, causing 404/SEO audit failures.
  Added a local SVG favicon, description metadata, and robots.txt.
- **Verification:** `npm test` passed 42 tests (22 unit and 20 component tests);
  `npm run typecheck` and `npm run build` passed. Lighthouse 13.5.0 with
  Headless Chrome 155 scored 100/100 for Performance, Accessibility,
  Best Practices, and SEO. At 375 px, the page had no horizontal overflow and
  the table scrolled within its focusable region.
- **Limitations:** Screen-reader behavior was not manually verified. The
  controlled challenge-defect exercise was not run because the task plan
  requires explicit agreement before introducing an intentional defect.

