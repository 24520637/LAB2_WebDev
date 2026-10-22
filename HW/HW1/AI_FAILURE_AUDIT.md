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

- **Error found during review:** Numeric comparison used subtraction. Comparing equal infinities (for example, `Infinity - Infinity`) produces `NaN`, which can make the comparator treat distinct numeric values as equal and return an incorrect order.
- **Detection:** Added ascending/descending regression coverage for positive and negative infinity alongside `NaN`, plus coverage for mixed number, string, and bigint values.
- **Fix:** Compare numeric values with `<` and `>` instead of subtraction. Keep `null`, `undefined`, and `NaN` at the end in either direction; compare other value combinations by their string representation with a numeric-aware collator, preserving original order for ties.
- **Status:** Fixed. All 9 focused sorting tests pass; `npm run build` passes; browser smoke testing verified ascending/descending row order, the active `aria-sort` state, and no sort button or ARIA sort state on the non-sortable column.
