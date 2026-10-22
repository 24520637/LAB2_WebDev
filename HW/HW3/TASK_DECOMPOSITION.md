# TASK DECOMPOSITION — HW 3: High-Concurrency Flash-Sale E-Commerce Engine

## 0. Repository inspection and rules

**Inspected input:** `HW3.zip` contains only `HW3/PROJECT_RULE.md` (no application source, dependency manifest, tests, or existing WBS). `PROJECT_RULE.md` requires focused changes, existing-pattern reuse, explicit error handling, real verification, and no unapproved dependencies or commits. This file is the *plan only*. No application implementation, dependency installation, tests, commits, or audit experiment has been executed while producing it.

**Instructions for every future task:** Read `PROJECT_RULE.md` and this WBS first. Inspect the actual repository again before selecting paths, commands, frameworks, or packages. Make only that task's changes, run relevant checks, record actual outcomes, and stop. Suggested Conventional Commits below are **proposed messages**, not completed commits; create commits only if explicitly authorized in the future.

## 1. Objective

Build a beginner-understandable flash-sale demonstration that shows a zero-drift sale countdown, safe inventory reservation transitions with an expiry window, visible status/error feedback, and tested behavior under duplicate actions and near-simultaneous attempts. Distinguish explicitly between **frontend simulation** and **server-enforced atomic stock allocation**. Produce a separate `AI_FAILURE_AUDIT.md` describing at least three **real, reproduced AI-generated defects**, each with faulty code, actual test evidence, risk, and corrected code.

## 2. Scope and boundaries

**In scope (when implementation tasks are authorized later):** sale clock; sale status; configurable inventory quantities; request/reserve/expire/cancel/checkout workflows; idempotent repeated actions; state and edge-case tests; manual concurrency simulation; user-visible feedback; lifecycle cleanup; reproducible audit evidence; final verification.

**Out of scope unless explicitly approved:** actual payment processing; user identity/authentication; persistent orders; distributed databases; load-balancing; claims of guaranteed multi-user inventory correctness based only on browser state; external integrations; production deployment. A browser-only exercise cannot provide server-side atomic reservation guarantees.

## 3. Assumptions and decisions to verify

1. The repository currently has **no identifiable framework or build tooling**. File names below are *proposed logical modules*, not claims about existing files. Reconcile paths with future starter files before implementation.
2. Prefer the smallest solution supported by existing conventions. If the repository stays empty, agree on a minimal browser implementation and test approach **before installing anything**. Avoid unnecessary dependencies.
3. Default demo uses a single product, configurable nonnegative integer stock, and a configurable sale duration/reservation TTL. Do not fix product count, currency, or exact UI layout without requirements.
4. Countdown is based on **client wall clock** (`Date.now()`), suitable for demo consistency across frame throttling but not authoritative or immune to manual clock changes. For real sales, obtain server-authoritative time/deadlines and validate checkout on the server.
5. Reservation state is tracked **per reservation** while stock count is tracked **per product**. `SOLD_OUT` is a derived *product-level availability state*, not a replacement for an individual reservation's lifecycle.
6. `CHECKED_OUT` is terminal; a successful checkout permanently consumes reserved stock. Expired/cancelled reservations return stock exactly once. An explicit `CANCELLED` terminal outcome may be represented as metadata or an additional internal state even though the required named states are `AVAILABLE`, `RESERVED/LOCKED`, `EXPIRED`, `CHECKED_OUT`, and `SOLD_OUT`.
7. For an in-browser simulator, all reservation mutations must pass through one synchronous authoritative store/reducer; do not use stale UI snapshots for stock decrements. This reduces single-tab races but does **not** guarantee atomicity across tabs, clients, or servers.
8. If a backend is added by approval, reservation creation and checkout must have atomic conditional stock updates/transactions, reservation IDs, idempotency keys, and server-side expiry validation. No frontend-only claim may substitute for that verification.
9. No audit defect is presumed to exist. If fewer than three genuine AI-generated bugs can be reproduced, report the shortfall honestly and do not fabricate defects or evidence.

## 4. Proposed architecture and file plan (conditional)

The **only existing repository file** is `PROJECT_RULE.md`. Future file names are examples to adapt to the confirmed toolchain:

| Logical responsibility | Proposed path if minimal vanilla JS is approved | Public contract / notes |
|---|---|---|
| Entry point and semantic UI | `index.html` | Sale timer, stock, status, actions, messages |
| Styling | `styles.css` | Responsive UI and visible keyboard focus |
| Sale clock | `src/countdown.js` | `start(targetTime, onUpdate, onComplete)` and `stop()`; no duplicated loops |
| Inventory domain/store | `src/inventory.js` | Pure transition rules and one mutation entry point |
| Reservation expiry coordinator | `src/reservations.js` | Create/expire/cancel/checkout with IDs and deadline checks |
| UI wiring | `src/main.js` | DOM events, validation, render, cleanup |
| Timer tests | `tests/countdown.test.js` | Fake clock/frames where supported |
| Inventory/concurrency tests | `tests/inventory.test.js` | Transition table, duplicates, racing calls |
| Lifecycle/UI tests | `tests/lifecycle.test.js` | Teardown, tab visibility, controls and messages |
| Reproduced AI error evidence | `AI_FAILURE_AUDIT.md` | At least three genuine defects, not placeholders represented as facts |

**No files in this proposed plan are created by this WBS.** If an existing codebase or tests appear later, reuse their conventions and revise paths before editing.

## 5. Domain rules and testable invariants

### 5.1 Countdown contract

- On a **new sale start only**, set `targetTime = Date.now() + durationMs`. Never recompute `targetTime` each render or resume.
- Each update derives `remaining = Math.max(0, targetTime - Date.now())`; displayed time is formatted from `remaining`, not from frame counts or recursive decrementing.
- Use **one** `requestAnimationFrame` loop while displayed/active; cache and cancel its ID on completion and teardown. `requestAnimationFrame` controls *paint updates*, not elapsed time.
- On `visibilitychange`, refresh against `Date.now()` as soon as possible; avoid multiple active loops. Background-frame throttling must not extend the deadline. If `remaining === 0`, stop rendering loop and fire completion exactly once.
- Reject invalid `durationMs` (negative, nonfinite, or wrong type); define whether `0` completes immediately. Ensure restart has intentional semantics and cancels the old loop/listener first.
- Test fake-time jumps, inactive-tab return, frame gaps, zero duration, repeated start/stop, and disposal. Clock changes/system sleep affect wall-clock timestamps; document this limitation.

### 5.2 Reservation contract

| Current condition | Event | Allowed result | Stock effect |
|---|---|---|---|
| Product has stock; no active reservation | Reserve(valid quantity, unique ID) | `AVAILABLE` → `RESERVED/LOCKED` | Available decreases by quantity once |
| Product has zero available stock | Reserve | Product `SOLD_OUT`, request rejected | None |
| `RESERVED/LOCKED`, before expiry | Checkout | `CHECKED_OUT` | Reserved decreases; sold increases, no second available decrement |
| `RESERVED/LOCKED`, at/after expiry | Expire / late checkout | `EXPIRED`; checkout rejected | Reserved decreases; available increases once |
| `RESERVED/LOCKED`, before expiry | Cancel | Cancelled terminal outcome | Reserved decreases; available increases once |
| `EXPIRED` / `CHECKED_OUT` / cancelled | Repeat terminal action | No-op or explicit idempotent result | None |
| Duplicate reserve request key | Reserve again | Return original result or consistent rejection | Never allocate twice |

**Validation:** quantity is a positive integer; sufficient available stock exists; reservation ID and request key are stable and unique as appropriate; expiry timestamp is computed once; checkout validates `Date.now() < expiresAt` at action time, not just after an expiry timer callback. Equality (`now === expiresAt`) is expired. Expiry timers are hints: lazy expiry during actions prevents late checkouts if timers were throttled. Product invariant: `initialStock = available + reserved + sold` (assuming no restock); all values remain nonnegative integers. `SOLD_OUT` may revert if an active reservation expires/cancels and stock returns. No customer checkout may succeed twice for the same reservation.

**Concurrency boundary:** Same-tab synchronous serialized actions and idempotency can be tested locally. Multiple tabs/processes require shared authoritative storage and atomic conditional writes or a transaction; browser local storage/events alone do not establish this. Real server atomic guarantees are **design requirements only**, unless an approved backend actually exists and is tested.

## 6. Work breakdown structure (execute in order; one task per bounded change)

Each task has an independently verifiable output. Dependencies refer to the listed task IDs. Suggested commit subjects are **not** evidence that commits exist.

### T-01 — Confirm baseline and runnable plan
- **Depends on:** None.
- **Action:** Re-read rules; inspect current tree; identify entry points, framework, available commands, test runner and browser support. Choose paths based on observed files; document missing tooling. Do not add dependencies by default.
- **Deliverable:** Updated architecture/path decision and short baseline verification log in the authorized documentation location.
- **Acceptance:** Every selected file path exists or is explicitly marked new; no unsupported framework assumptions; no unrelated edits.
- **Test:** List files; inspect available manifest/commands; run existing no-change checks only if present, recording exact command/result.
- **Suggested commit:** `docs: define flash sale architecture and baseline`

### T-02 — Create sale shell and accessible states
- **Depends on:** T-01.
- **Action:** Implement minimal semantic sale shell with product, timer, available/reserved/sold counts, actions, initial/loading/empty/error feedback; use semantic buttons and a restrained live region.
- **Deliverable:** Renderable user interface with stable element identities.
- **Acceptance:** Correct zero/empty display; controls labeled and keyboard focus visible; no fake successful reservation; no console exception on initial render.
- **Test:** Open actual entry point; Tab/Shift+Tab and Enter/Space through controls; inspect empty/error state.
- **Suggested commit:** `feat(ui): scaffold accessible flash sale interface`

### T-03 — Implement wall-clock countdown engine
- **Depends on:** T-01.
- **Action:** Build standalone clock as in §5.1 with one immutable target per start, derived remaining time, single RAF loop, callback-once completion, `stop()` and `dispose()`.
- **Deliverable:** Timer module with documented inputs/outputs.
- **Acceptance:** No interval-decrement drift, negative display, duplicate completion, or orphan RAF.
- **Test:** Manually invoke with short duration; compare remaining against wall time; stop/restart twice and observe a single update stream.
- **Suggested commit:** `feat(timer): add wall clock countdown engine`

### T-04 — Add deterministic countdown tests
- **Depends on:** T-03.
- **Action:** Use existing test facilities if available; otherwise agree on minimal reproducible manual harness without new packages. Stub `Date.now` and RAF where possible.
- **Deliverable:** Timer test cases and captured run output.
- **Acceptance:** Assert initial time, 1+ second frame pause, long tab gap, exact zero, invalid duration, restart, completion once and cancel on stop.
- **Test:** Run test command recorded from T-01; save actual pass/fail output. If automated tooling absent, mark automated coverage unavailable and document manual steps.
- **Suggested commit:** `test(timer): cover drift and completion boundaries`

### T-05 — Implement pure inventory transition rules
- **Depends on:** T-01.
- **Action:** Define stock/reservation types and a single transition function for available, reserved/locked, expired, checked out, derived sold out, plus cancellation outcome. Enforce §5.2 invariants and validation; avoid DOM/timers in core rules.
- **Deliverable:** Testable domain module and transition table reflected in code comments/tests.
- **Acceptance:** Invalid quantity rejected; stock never negative; no oversell in one serialized store; only valid transitions accepted; product `SOLD_OUT` derived consistently.
- **Test:** Execute reserve/checkout/cancel/expire sequence with stock 1 and stock 0; verify conservation after every mutation.
- **Suggested commit:** `feat(inventory): define reservation state transitions`

### T-06 — Implement reservation expiry and rollback coordinator
- **Depends on:** T-05.
- **Action:** Allocate unique reservation ID/request key and `expiresAt` once. Integrate lazy expiry at action time and scheduled expiry for UI freshness. Release inventory once only; distinguish checkout commit from reserve.
- **Deliverable:** Reservation coordinator with create, expire, cancel and checkout APIs.
- **Acceptance:** Late checkout rejected even if expiry callback has not executed; double expiry/cancel never refunds twice; checkout never decrements stock twice.
- **Test:** Hold reservation beyond TTL, call checkout before firing scheduled callback; retry cancel, expire, checkout in permutations; confirm counts.
- **Suggested commit:** `feat(reservations): enforce expiry and rollback`

### T-07 — Implement duplicate-action and contention protections
- **Depends on:** T-06.
- **Action:** Route actions through one authoritative mutation path. Make repeated request keys idempotent; define conflict behavior for checkout-versus-expire and two buyers requesting the last item. Keep server guarantee disclaimer explicit.
- **Deliverable:** Concurrency-safe *single-store simulation* behavior and documented limitations.
- **Acceptance:** At most one reservation for stock 1; duplicate checkout never creates extra sale; cancelled/expired stock returned once; no claim of cross-client atomicity.
- **Test:** Fire same-store operations back-to-back and with `Promise.all`/interleaved scheduling; test identical and distinct keys. Clearly label this simulation, not distributed load testing.
- **Suggested commit:** `fix(inventory): guard duplicate and competing actions`

### T-08 — Add inventory state-transition tests
- **Depends on:** T-05, T-06, T-07.
- **Action:** Build table-driven positive and rejected-transition tests, including exact expiry boundary, negative/noninteger quantities, duplicated keys, repeated terminal operations and stock invariants.
- **Deliverable:** Reproducible domain test suite or clearly marked manual equivalent.
- **Acceptance:** Every transition in §5.2 exercised; assertions inspect actual state and counts rather than just UI labels.
- **Test:** Run tests with fake clock and record evidence; explicitly flag skipped/unavailable tests.
- **Suggested commit:** `test(inventory): validate transition invariants`

### T-09 — Add contention/concurrency scenario tests
- **Depends on:** T-07, T-08.
- **Action:** Simulate simultaneous demand for final stock, overlapping reservation/cancel/checkout/expiry, repeated requests, and delayed callbacks. If real backend later approved, add server concurrent-request and atomic-commit tests separately.
- **Deliverable:** Deterministic concurrency test scenarios with expected winner/loser semantics.
- **Acceptance:** All outcomes preserve stock conservation and one-winner-for-last-item; no double checkout or double rollback. Results explicitly scoped to single-store simulator.
- **Test:** Run repeated batches, assert invariants after each operation and final counts; capture run count, failures and environment. Never label `Promise.all` alone as proof of server atomicity.
- **Suggested commit:** `test(concurrency): exercise stock contention and races`

### T-10 — Connect UI to sale and reservation lifecycle
- **Depends on:** T-02, T-03, T-06, T-07.
- **Action:** Wire countdown, reserve, checkout and cancel controls; derive disabled conditions from live state; show reservation TTL, stock, completion, success and recoverable errors.
- **Deliverable:** End-to-end interactive single-client demo.
- **Acceptance:** Buttons cannot cause duplicate allocation; expired checkout visibly rejected; sold-out and recovered stock displayed correctly; keyboard users receive concise status text.
- **Test:** Visit real entry point, reserve last unit, try duplicate action, wait for expiry, reserve again, checkout, then retry checkout; inspect messages and state.
- **Suggested commit:** `feat(ui): integrate sale and reservation controls`

### T-11 — Handle visibility and lifecycle cleanup
- **Depends on:** T-03, T-06, T-10.
- **Action:** Subscribe/unsubscribe `visibilitychange`; recompute timer and expiry using current wall time on tab return. Cancel pending RAF and timeout IDs, remove listeners and prevent state updates after teardown/reinitialization.
- **Deliverable:** Explicit initialization/disposal ownership and cleanup cases.
- **Acceptance:** Backgrounding does not extend sale or reservation; completed sale finishes once; no duplicate handlers after remount/reinitialize; no orphan scheduled work.
- **Test:** Switch tabs during sale and reservation expiry; inspect on return; initialize/dispose repeatedly and count callback invocations using supported instrumentation.
- **Suggested commit:** `fix(lifecycle): handle tab restore and cleanup`

### T-12 — Test UI keyboard, errors and lifecycle
- **Depends on:** T-10, T-11.
- **Action:** Add available UI/lifecycle tests for disabled actions, keyboard focus and activation, error display, tab resumption, cleanup and recovery after expiry.
- **Deliverable:** UI test cases plus manual accessibility checklist for unsupported automation.
- **Acceptance:** Zero uncaught errors for planned inputs; keyboard can complete supported flows; live text conveys status without reliance on animation; no repeated announcements per frame.
- **Test:** Run real entry point in a browser and any existing test command; record browser, command, screenshots/logs and failures.
- **Suggested commit:** `test(ui): cover accessibility and lifecycle edges`

### T-13 — Intentional AI failure experiment A (NON-PRODUCTION)
- **Depends on:** T-04, T-08.
- **Action:** In an isolated scratch branch/copy only, trial an explicitly AI-generated timer variant that *might* demonstrate decrement-per-frame or restart drift. Do not invent a failure: only document one if reproduced against actual timer tests. Revert experiment before production work resumes.
- **Deliverable:** Candidate defect, exact faulty snippet and test outcome (or documented non-reproduction).
- **Acceptance:** Production baseline remains unchanged; defect is attributed to the actual AI-produced snippet; reproduction command and expected/actual observations recorded.
- **Test:** Compare 60-second elapsed-time jump/RAF pause behavior against approved implementation; capture timestamped output.
- **Suggested commit:** `test(audit): reproduce ai timer failure` (only if genuine, authorized and isolated)

### T-14 — Intentional AI failure experiment B/C (NON-PRODUCTION)
- **Depends on:** T-08, T-09.
- **Action:** In isolated branches/copies, test AI-generated candidate bugs (e.g., repeated expiration double-credit, checkout-after-expiry acceptance, stale-read overselling). These are **hypotheses**, not reported findings. Gather at least two additional **distinct actually reproduced** defects if they occur; restore correct behavior after each.
- **Deliverable:** Reproduction records and verified fixes or honest non-reproduction notes.
- **Acceptance:** No intentionally faulty code left in production; each actual defect has fault/fix diff, risk, observed output and rerun proving fix.
- **Test:** Execute targeted transition/contending-action tests on faulty and corrected versions with exact same inputs and documented environment.
- **Suggested commit:** `test(audit): reproduce ai inventory failures` (only if genuine and authorized)

### T-15 — Write `AI_FAILURE_AUDIT.md` with authentic evidence
- **Depends on:** T-13, T-14 (and additional experiments if needed to reach three proven defects).
- **Action:** Create audit **only after actual runs**. Include at least three different AI-generated defects (when genuinely found), not three hypothetical examples. Keep risky snippets labeled as faulty and separated from production. Do not alter evidence or claim nonexistent screenshots, commits, or logs.
- **Deliverable:** `AI_FAILURE_AUDIT.md` containing for **each defect**: ID/title; AI generation context; source file/line or commit; exact faulty code; risk and invariant violated; exact reproduction command/steps and environment; actual failing assertion/log/screenshot path with date; corrected code/diff; actual retest result; prevention lesson.
- **Acceptance:** >=3 demonstrably reproduced AI defects with traceable evidence, otherwise audit clearly marked incomplete (not a false pass). Corrected snippets agree with production, and all linked evidence files exist.
- **Test:** Independently replay each reproduction and fix validation. Check paths, screenshots and logs against the filesystem; report discrepancies.
- **Suggested commit:** `docs(audit): record verified ai generated defects`

### T-16 — Final verification and handoff
- **Depends on:** T-04, T-08, T-09, T-12, T-15.
- **Action:** Inspect diff for scope, run actually available tests/build/lint, manually verify real app, check cleanup and console, verify audit authenticity and commit history if commits were authorized.
- **Deliverable:** Final verification report in the approved doc or handoff message: commands, environment, pass/fail/skip, observed bugs, audit count, commit hashes (if any), remaining limitations.
- **Acceptance:** No unsupported claim of performance or distributed safety; no accidental extra files or packages; at least **8 distinct meaningful atomic Conventional Commits** if committing was authorized and required by grading. Each commit changes one coherent concern and passes its relevant check; do not manufacture commits or hashes.
- **Test:** Re-run full test suite once; browser flows for last-item reservation, expiry, cancellation, sold out, tab switching, timer completion; `git status` and `git log --oneline` only when Git repository exists; capture actual outputs.
- **Suggested commit:** `docs: record final verification and limitations`

## 7. Suggested atomic commit progression (planned, not executed)

At least eight **real** atomic commits should eventually be made **only with explicit permission** and a Git repository. Prefer this coherent progression (additional test/audit commits are listed above):

1. `docs: define flash sale architecture and baseline` — T-01
2. `feat(ui): scaffold accessible flash sale interface` — T-02
3. `feat(timer): add wall clock countdown engine` — T-03
4. `test(timer): cover drift and completion boundaries` — T-04
5. `feat(inventory): define reservation state transitions` — T-05
6. `feat(reservations): enforce expiry and rollback` — T-06
7. `fix(inventory): guard duplicate and competing actions` — T-07
8. `test(inventory): validate transition invariants` — T-08
9. `test(concurrency): exercise stock contention and races` — T-09
10. `feat(ui): integrate sale and reservation controls` — T-10
11. `fix(lifecycle): handle tab restore and cleanup` — T-11
12. `test(ui): cover accessibility and lifecycle edges` — T-12
13. `docs(audit): record verified ai generated defects` — T-15 (only when supported by authentic evidence)
14. `docs: record final verification and limitations` — T-16

Do not split commits artificially, commit knowingly broken production code, or state that any of these commit messages have been applied. Isolated experiments should not contaminate mainline history.

## 8. Definition of done / evidence checklist

- [ ] Actual repository conventions and test commands identified.
- [ ] Countdown target set once; remaining based on current wall clock; completion once.
- [ ] Timer tests include pause/frame gaps, tab switch, completion and cleanup.
- [ ] Reservation validation, expiry, cancel, checkout, sold-out recovery and idempotency work.
- [ ] Stock conservation and nonnegative counts asserted after every transition.
- [ ] Duplicate and contention scenarios tested; frontend/backend concurrency scope clearly labeled.
- [ ] UI supports keyboard controls, visible errors, disabled conditions and textual status.
- [ ] No lingering RAF/timers/listeners after teardown.
- [ ] `AI_FAILURE_AUDIT.md` contains at least three **real** reproduced AI defects with faulty/corrected code and evidence, or the shortfall is truthfully reported.
- [ ] At least eight meaningful atomic Conventional Commits **verified from Git**, if explicitly authorized.
- [ ] All actual pass/fail/skip results and limits recorded without fabrication.

**Stop point for the current request:** Only this `TASK_DECOMPOSITION.md` is authored. No task above is started and no application code, test, audit file, package or Git history is changed.
