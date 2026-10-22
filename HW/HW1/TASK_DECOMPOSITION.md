# TASK DECOMPOSITION

## HW1 Production Enterprise Data-Grid — WCAG 2.2 AA
---

## 1. Project Objective

Build a reusable TypeScript Data Grid that displays a list of records and lets users sort, filter, move between pages, select rows, and use the grid with a keyboard or screen reader.

The grid must follow the project's existing code style and aim for **WCAG 2.2 AA** accessibility.

### Required TypeScript API

```ts
type ColumnDef<T> = {
  header: string;
  accessorKey: keyof T;
  sortable?: boolean;
};

type DataGridProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  onRowSelect?: (item: T) => void;
  ariaLabel: string;
};
```

In simple terms:

- `data`: the records shown in the grid.
- `columns`: the column names and the record field each column displays.
- `sortable`: whether a column can be sorted.
- `onRowSelect`: an optional callback that runs when a row is selected.
- `ariaLabel`: the accessible name that helps screen-reader users identify the grid.

Keep this API unless the project requirements are clarified and the change is approved.

### Features included

- A reusable, generic TypeScript component.
- Column sorting, data filtering, and pagination.
- Row selection and keyboard navigation.
- Accessible names, roles, states, focus indicators, and screen-reader announcements.
- Responsive layout and readable text contrast.
- Automated tests and manual accessibility checks.
- An `AI_FAILURE_AUDIT.md` file that records AI-generated mistakes and verified fixes during implementation.
- Small changes, checked and committed one task at a time.

### Not included unless approved

- Backend, database, or API work.
- New third-party libraries or package installations.
- Column resizing, column reordering, virtualization, data export, or multi-row selection.
- Changes to unrelated screens or features.

### Definition of Done

The project is ready for final review when:

- [ ] The public TypeScript API matches the approved requirements.
- [ ] Sorting, filtering, pagination, selection, and keyboard controls work.
- [ ] Important edge cases pass tests.
- [ ] Accessibility checks cover names, roles, focus, contrast, and announcements.
- [ ] Existing project checks pass, and their real results are recorded.
- [ ] Lighthouse Accessibility and Best Practices each score **100/100** on a representative build, if the project environment supports a valid run. If not, document the blocker instead of claiming success.
- [ ] `AI_FAILURE_AUDIT.md` accurately records the checks, defects, and fixes.
- [ ] The final changes are reviewed and committed; known limitations are reported.

---

## 2. Repository Check — Verified

- Framework: React 19, TypeScript 5.8, and Vite 6.
- Package manager: npm; `package-lock.json` is present.
- Source: `src/`; tests: `tests/`, including Node tests and React component tests.
- Available scripts: `npm run typecheck`, `npm test`, `npm run build`,
  `npm run dev`, and `npm run preview`.
- Browser: Chrome is installed. Lighthouse CLI 13.5.0 can run through npm exec.
- Git branch at inspection: `main`. Existing user-provided coverage test was
  untracked and was retained.

### Confirmed behavior

- Filtering searches all displayed columns, case-insensitively.
- Page size is 10; filtering and sorting reset the page to 1.
- Only explicitly sortable columns can be sorted; sorting is stable and does
  not mutate source data.
- Enter and Space select the focused row; arrows move the single active cell;
  normal Tab behavior is retained.
- Selection is by record reference and remains selected while filtered or
  paginated out; it reappears if the same object becomes visible again.
- The project owner accepted the semantic native table structure for the
  incomplete “Zero div-soup: Must use native...” requirement.

Full screen-reader verification remains a manual accessibility task.

---

## 3. Work Breakdown Structure (WBS)

Each **Epic** is a group of related tasks. Each task lists what to do, what it depends on, and how to check that it is finished.

**Rule:** Do not start a task until its dependencies are complete. Do not commit a task until its acceptance checklist passes.

### EPIC 1: Requirements & Repository Audit

#### TASK 1.1: Inspect the repository
**Goal:** Understand the project before changing it.

**Steps**
- [ ] Check the project folders, Git status, and recent commits.
- [ ] Read the README, package configuration, TypeScript configuration, and relevant source files.
- [ ] Identify the framework, component patterns, and styling approach.
- [ ] Record anything missing or inaccessible.

**Depends on:** None  
**Done when:** The plan records verified repository facts and does not claim unverified details.

#### TASK 1.2: Find the project's existing checks
**Goal:** Know how to test the project.

**Steps**
- [ ] Find the actual commands for tests, linting, type checking, and building.
- [ ] Check whether browser and accessibility tools are already available.
- [ ] Record the exact command names and configuration files.
- [ ] Mark missing commands as “not found”; do not invent commands or install packages.

**Depends on:** Task 1.1  
**Done when:** The available checks and their limitations are documented.

#### TASK 1.3: Map requirements to tests
**Goal:** Make sure every requirement can be checked.

**Steps**
- [ ] List each required feature and important edge case.
- [ ] Link each requirement to a task in this plan.
- [ ] Decide whether each requirement needs an automated test, a manual check, or both.
- [ ] Keep unclear requirements visible as open questions.

**Depends on:** Task 1.1  
**Done when:** Every requirement has a planned way to verify it.

#### TASK 1.4: Confirm unclear requirements
**Goal:** Avoid implementing the wrong behavior.

**Steps**
- [ ] Ask what the incomplete “Zero div-soup” requirement means.
- [ ] Confirm important sorting, filtering, pagination, and keyboard behavior.
- [ ] Record approved decisions.
- [ ] Do not guess missing requirements.

**Depends on:** Task 1.3  
**Done when:** Important decisions are confirmed or clearly marked as blockers/open questions.

### EPIC 2: Component Contract

#### TASK 2.1: Define the TypeScript types
**Goal:** Make the component safe and predictable to use.

**Steps**
- [ ] Add or update `ColumnDef<T>` and `DataGridProps<T>` in the project's existing style.
- [ ] Ensure `accessorKey` only accepts keys that exist on `T`.
- [ ] Keep `onRowSelect` optional and make its argument type `T`.
- [ ] Ensure `data`, `columns`, and `ariaLabel` are required.
- [ ] Export the types in the way the project already uses.

**Depends on:** Tasks 1.2 and 1.4  
**Done when:** Valid types compile and an invalid column key is rejected by TypeScript.

#### TASK 2.2: Plan the grid's state and behavior
**Goal:** Decide how the grid keeps track of user actions.

**Steps**
- [ ] Define how sorting, filtering, page number, focus, and selection are tracked.
- [ ] Decide the order of operations: filter, sort, then paginate, unless the approved requirements say otherwise.
- [ ] Define what happens when data changes or the current page no longer exists.
- [ ] Avoid changing the original `data` array.

**Depends on:** Task 2.1  
**Done when:** State behavior is clear enough to implement and test.

### EPIC 3: Grid Foundation

#### TASK 3.1: Build the grid structure
**Goal:** Show a correctly labelled grid.

**Steps**
- [ ] Follow the approved HTML and accessibility structure.
- [ ] Give the grid the accessible name from `ariaLabel`.
- [ ] Use suitable row, header, and cell semantics.
- [ ] Avoid unnecessary wrapper elements and invalid ARIA roles.

**Depends on:** Tasks 1.4 and 2.2  
**Done when:** The browser accessibility tree shows a clearly named grid with understandable rows and cells.

#### TASK 3.2: Render columns and data
**Goal:** Display different record types through the same component.

**Steps**
- [ ] Create column headers from `columns`.
- [ ] Read each cell's value using its `accessorKey`.
- [ ] Handle missing values without crashing.
- [ ] Do not use unsafe HTML injection.
- [ ] Do not mutate the input records.

**Depends on:** Task 3.1  
**Done when:** Different valid record shapes render the correct headers and values.

#### TASK 3.3: Handle empty data
**Goal:** Make the grid understandable when there is nothing to show.

**Steps**
- [ ] Show a clear empty-state message when there are no records.
- [ ] Do not show phantom or selectable rows.
- [ ] Keep the grid's accessible name.
- [ ] Handle an empty column list safely if it is allowed by the agreed requirements.

**Depends on:** Task 3.2  
**Done when:** Empty data and valid empty configurations do not cause errors or confusing output.

### EPIC 4: Data Operations

#### TASK 4.1: Add sorting
**Goal:** Let users order records by supported columns.

**Steps**
- [ ] Allow sorting on columns marked as sortable.
- [ ] Toggle ascending and descending order.
- [ ] Expose the current sort state accessibly.
- [ ] Define and test how supported value types are compared.
- [ ] Keep the original data unchanged.

**Depends on:** Task 3.2  
**Done when:** Sorting produces the expected order in both directions.

#### TASK 4.2: Protect non-sortable columns
**Goal:** Make sure disabled sorting really stays disabled.

**Steps**
- [ ] Follow the approved default for columns with `sortable` omitted.
- [ ] Do not sort when a non-sortable header is activated.
- [ ] Do not tell screen readers that a non-sortable column can be sorted.

**Depends on:** Task 4.1  
**Done when:** Pointer and keyboard interaction cannot sort a non-sortable column.

#### TASK 4.3: Add filtering
**Goal:** Let users find matching records.

**Steps**
- [ ] Implement the approved filter behavior.
- [ ] Give the filter input an accessible label.
- [ ] Let users clear the filter.
- [ ] Show a clear message when there are no matches.
- [ ] Do not mutate the original data.

**Depends on:** Tasks 3.2 and 1.4  
**Done when:** Matching records appear, nonmatching records disappear, and clearing the filter restores the results.

#### TASK 4.4: Add pagination
**Goal:** Let users move through large result sets.

**Steps**
- [ ] Add the agreed page controls and page size.
- [ ] Show the correct records and page information.
- [ ] Disable Previous on the first page and Next on the last page.
- [ ] Keep the page number valid when filtering reduces the results.
- [ ] Handle zero results safely.

**Depends on:** Tasks 4.3 and 3.2  
**Done when:** Page navigation works and filtering cannot leave the grid stuck on an invalid page.

### EPIC 5: Keyboard & Selection

#### TASK 5.1: Add row selection
**Goal:** Let users select a row and notify the parent component.

**Steps**
- [ ] Implement the approved single-row selection behavior.
- [ ] Call `onRowSelect` with the selected record.
- [ ] Do not crash when `onRowSelect` is omitted.
- [ ] Expose selected state to assistive technology where appropriate.

**Depends on:** Tasks 3.2 and 2.2  
**Done when:** Selecting a row works and the callback receives the correct record.

#### TASK 5.2: Add keyboard navigation
**Goal:** Make the grid usable without a mouse.

**Steps**
- [ ] Implement the approved arrow-key movement.
- [ ] Support Enter and Space as agreed.
- [ ] Keep focus visible.
- [ ] Prevent keyboard movement from getting stuck at grid boundaries.
- [ ] Prevent Space from scrolling the page when the grid handles it.
- [ ] Make sure Tab can leave the grid normally.

**Depends on:** Tasks 3.1 and 5.1  
**Done when:** A user can navigate and select using the keyboard, with predictable focus behavior.

#### TASK 5.3: Check keyboard edge cases
**Goal:** Prevent common navigation bugs.

**Steps**
- [ ] Test the first and last rows and cells.
- [ ] Test empty data and a single-row grid.
- [ ] Test navigation after filtering or changing pages.
- [ ] Test what happens when the focused or selected row disappears.

**Depends on:** Task 5.2  
**Done when:** Focus remains valid and understandable in these cases.

### EPIC 6: Accessibility & Styling

#### TASK 6.1: Complete ARIA and screen-reader support
**Goal:** Make grid information understandable to assistive technology.

**Steps**
- [ ] Check accessible names, roles, and states.
- [ ] Announce useful updates such as sorting, filtering, or selection when needed.
- [ ] Ensure headers and cells have clear relationships.
- [ ] Remove unnecessary or conflicting ARIA attributes.

**Depends on:** Tasks 3.1, 4.1, 4.3, and 5.1  
**Done when:** Keyboard and screen-reader checks show clear structure and meaningful state changes.

#### TASK 6.2: Add visible focus and sufficient contrast
**Goal:** Make controls easy to see and use.

**Steps**
- [ ] Add a visible keyboard-focus indicator.
- [ ] Check normal text contrast is at least **4.5:1**.
- [ ] Check controls and selected states remain distinguishable.
- [ ] Reuse existing design tokens and styles when possible.

**Depends on:** Task 1.1  
**Done when:** Focus is easy to see and contrast checks pass for the tested theme.

#### TASK 6.3: Check responsive layout
**Goal:** Keep the grid usable on narrow screens.

**Steps**
- [ ] Test at a viewport width of 375 px.
- [ ] Check that the page does not overflow horizontally unless the grid's approved design intentionally allows a contained scroll area.
- [ ] Make sure controls remain visible and usable.
- [ ] Check long values and narrow columns.

**Depends on:** Tasks 3.2 and 6.2  
**Done when:** The grid remains usable at the required viewport and has no unintended page-level overflow.

### EPIC 7: Verification

#### TASK 7.1: Test normal behavior
**Goal:** Prove the main features work.

**Steps**
- [ ] Test rendering and TypeScript types.
- [ ] Test sorting in both directions.
- [ ] Test filtering and clearing the filter.
- [ ] Test pagination and page boundaries.
- [ ] Test row selection and keyboard navigation.

**Depends on:** Tasks 3.1–6.3  
**Done when:** Existing relevant tests pass and results are recorded.

#### TASK 7.2: Test important edge cases
**Goal:** Find failures that normal use may miss.

**Steps**
- [ ] Test empty data and no filter matches.
- [ ] Test filtering while on the last page.
- [ ] Test non-sortable columns.
- [ ] Test missing values and optional callbacks.
- [ ] Test keyboard boundaries and changing data.

**Depends on:** Task 7.1  
**Done when:** Each listed case has a passing test or a documented manual result.

#### TASK 7.3: Run accessibility and Lighthouse checks
**Goal:** Check the built page with real tools.

**Steps**
- [ ] Run the accessibility checks available in the repository.
- [ ] Test keyboard-only use and screen-reader output where possible.
- [ ] Run Lighthouse on a representative local build if supported.
- [ ] Record the URL, viewport, tool/browser version, scores, and any findings.
- [ ] Do not claim a score if the run was not completed.

**Depends on:** Tasks 6.1–6.3 and 7.1  
**Done when:** Results are recorded honestly; target scores are met or remaining blockers are explained.

### EPIC 8: AI Failure Audit & Repair

#### TASK 8.1: Start the AI failure audit
**Goal:** Track mistakes instead of trusting generated code automatically.

**Steps**
- [ ] Create `AI_FAILURE_AUDIT.md` as part of implementation, before or with the first code task.
- [ ] Record each task, the AI-generated change, the check used, and the observed result.
- [ ] Record only defects that were actually found.
- [ ] Include evidence for each fix.

**Depends on:** Task 1.3; begin before the first implementation task  
**Done when:** The audit is maintained as work progresses and does not contain invented findings.

#### TASK 8.2: Run a controlled defect-and-repair exercise
**Goal:** Demonstrate that a defect can be detected and fixed.

**Steps**
- [ ] Agree on a small, safe challenge defect before introducing it.
- [ ] Keep the defect isolated and clearly labelled in the audit notes.
- [ ] Run the relevant test to detect it.
- [ ] Fix the defect and rerun the same test.
- [ ] Confirm the defect is not present in the final code.

**Depends on:** The relevant feature task and Task 8.1  
**Done when:** The audit shows the defect, evidence that the check detected it, the fix, and a passing retest. The intentional defect must not remain in the final version.

### EPIC 9: Final Delivery

#### TASK 9.1: Review the final changes
**Goal:** Make sure the finished work matches the plan.

**Steps**
- [ ] Review the final Git diff.
- [ ] Confirm only agreed files changed.
- [ ] Rerun relevant checks after the final fix.
- [ ] Check that every acceptance item is complete or clearly marked as blocked.
- [ ] Review `AI_FAILURE_AUDIT.md`.

**Depends on:** Tasks 7.2, 7.3, and 8.2  
**Done when:** The final changes and test evidence are reviewed.

#### TASK 9.2: Prepare the handover
**Goal:** Explain what was delivered and what remains.

**Steps**
- [ ] Summarize the completed features.
- [ ] List the checks run and their actual results.
- [ ] Record any known issues or uncompleted requirements.
- [ ] List the relevant commits.

**Depends on:** Task 9.1  
**Done when:** Another developer or reviewer can understand the result without guessing.

---

## 4. Task Dependencies

Follow this order. Some tasks can overlap only when their dependencies are complete.

1. **Inspect first:** Tasks 1.1–1.4.
2. **Agree on the contract:** Tasks 2.1–2.2.
3. **Build the basic grid:** Tasks 3.1–3.3.
4. **Add data operations:** Tasks 4.1–4.4.
5. **Add interaction:** Tasks 5.1–5.3.
6. **Finish accessibility and responsive styling:** Tasks 6.1–6.3.
7. **Test the full grid:** Tasks 7.1–7.3.
8. **Keep the AI audit updated throughout implementation:** Tasks 8.1–8.2.
9. **Review and hand over:** Tasks 9.1–9.2.

If a task fails its checks, fix it before moving to a dependent task.

---

## 5. Required Work Loop for Every Implementation Task

Repeat this loop for each task that changes code:

1. **Implement one task only.** Keep the change small.
2. **Run the relevant existing check.** Use the actual command found in the repository.
3. **Inspect the diff.** Look for unrelated edits, unsafe code, type errors, and accessibility problems.
4. **Audit the AI-generated change.** Compare it with the acceptance checklist and record real findings in `AI_FAILURE_AUDIT.md`.
5. **Fix confirmed defects.** Do not make speculative changes without a reason.
6. **Run the check again.** Confirm the fix works and did not break earlier behavior.
7. **Commit the accepted task.** Use a clear message that describes the change.

If a check cannot run, record why. Never report a test as passing unless it actually passed.

### Suggested commit pattern

Use the repository's existing commit style if one exists. Otherwise, use clear messages such as:

- `docs: record data grid implementation plan`
- `feat: add generic data grid structure`
- `feat: add sorting and filtering`
- `feat: add pagination`
- `feat: add keyboard navigation and selection`
- `test: cover data grid edge cases`
- `fix: address verified accessibility issues`

These are examples, not commits to make during the planning stage.

---

## 6. Testing Checklist

### Functionality
- [ ] Correct headers and cell values are shown.
- [ ] Sorting works in ascending and descending order.
- [ ] Non-sortable columns do not sort.
- [ ] Filtering shows only matching records.
- [ ] Clearing the filter restores the records.
- [ ] Pagination works and its controls disable at the correct boundaries.
- [ ] Filtering from the last page does not leave an invalid page selected.
- [ ] Selecting a row calls `onRowSelect` with the correct record.
- [ ] The grid still works when `onRowSelect` is omitted.

### Edge cases
- [ ] Empty data.
- [ ] No filter matches.
- [ ] One row.
- [ ] Missing or undefined cell values.
- [ ] Empty column list, if allowed.
- [ ] First and last page.
- [ ] First and last keyboard position.
- [ ] Data changes while a row is focused or selected.

### Accessibility and layout
- [ ] The grid has an accessible name.
- [ ] Rows, headers, and cells have understandable semantics.
- [ ] Sorting and selection state are exposed accessibly.
- [ ] All controls work with a keyboard.
- [ ] Focus is always visible and can leave the grid.
- [ ] Normal text contrast is at least 4.5:1.
- [ ] The layout is usable at 375 px.
- [ ] Screen-reader announcements are useful and not unnecessarily repetitive.
- [ ] Lighthouse results are recorded if the tool can run in the project environment.

---

## 8. Final Acceptance and Remaining Limitations

The repository, behavior, and native-table decisions listed in Section 2 have
been confirmed. Automated checks and Lighthouse are available and run locally.
Screen-reader verification cannot be established by automated checks alone and
must be completed manually before claiming full WCAG 2.2 AA conformance.

The controlled defect-and-repair exercise in Task 8.2 was not performed because
the plan requires agreement on an intentional challenge defect before
introducing one.

### Verified implementation status — 2026-10-22

- Implemented filtering, stable sorting, pagination, row selection, keyboard
  navigation, empty states, header associations, responsive scrolling, and
  selection announcements.
- `npm test`: passed 42 tests (22 unit and 20 component tests).
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Lighthouse 13.5.0 / Headless Chrome 155 production preview at 375 px:
  Performance 100, Accessibility 100, Best Practices 100, SEO 100.
- Browser check at 375 px: no page-level horizontal overflow; the grid scrolls
  within its own keyboard-focusable region.
- Not verified: manual screen-reader behavior and a controlled challenge
  defect. These limitations are not represented as completed WCAG conformance.

### Final handover checklist

- [ ] All agreed features are implemented.
- [ ] All relevant tests and checks have real recorded results.
- [ ] No intentional challenge defect remains.
- [ ] `AI_FAILURE_AUDIT.md` records verified findings and fixes.
- [ ] Final diff contains only agreed changes.
- [ ] Known limitations and relevant commits are listed.
- [ ] The final work has been reviewed before delivery.

---
