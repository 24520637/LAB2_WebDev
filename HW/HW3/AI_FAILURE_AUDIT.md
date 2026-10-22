# AI Failure Audit — T-13 through T-15

## AI-FX-01 - Decrement-per-frame countdown drifts after a pause

- **Generation context:** T-13 asked to investigate “whether a naive
  decrement-per-callback timer drifts when callbacks are delayed” and compare
  a long wall-clock jump with only a few callbacks.
- **Faulty source:** [`candidates.mjs`](./scratch-ai-failure-experiments/candidates.mjs#L1)
  (`createDecrementPerFrameTimer`, lines 1–20).
- **Exact faulty snippet:**

  ```js
  start(durationMs) {
    remainingMs = durationMs;
    frameCallback = () => {
      remainingMs -= 1_000;
      if (remainingMs > 0) requestFrame(frameCallback);
    };
    requestFrame(frameCallback);
  },
  ```

- **Risk / invariant violated:** Elapsed time is inferred from callback count.
  When the browser pauses or throttles animation callbacks, the displayed
  countdown lags actual wall time and can show an open sale after its deadline.
- **Reproduction:** [`timer-drift.test.mjs`](./scratch-ai-failure-experiments/timer-drift.test.mjs#L1)
  starts a 60,000 ms timer at 10,000, advances the controlled clock to 70,000,
  and invokes only one queued callback.
- **Command:** `node --test HW\HW3\scratch-ai-failure-experiments\timer-drift.test.mjs`
- **Actual result:** Exit code 1; 1 test, 0 passed, 1 failed. The assertion
  reported `expected deadline-based remaining=0, got 59000` (`59000 !== 0`).
  Full captured output:
  [`timer-drift.failure.log`](./scratch-ai-failure-experiments/timer-drift.failure.log).
- **Approved correction:** [`countdown.js`](./src/countdown.js#L45) fixes one
  target at start; [`countdown.js`](./src/countdown.js#L90) derives each update
  from `Math.max(0, session.targetTime - this.now())`. The regression
  [`countdown.test.mjs`](./tests/countdown.test.mjs#L105) runs the same 60-second
  jump with one frame and verifies zero, one completion, and no pending frame.
- **Retest:** `node --test HW\HW3\tests\countdown.test.mjs HW\HW3\tests\reservations.test.mjs`
  passed **21/21**, 0 failed, 0 skipped. Captured output:
  [`approved-regressions.pass.log`](./scratch-ai-failure-experiments/approved-regressions.pass.log).
- **Prevention:** Derive displayed time from an immutable deadline and the
  current wall clock; callbacks may schedule updates but must not define elapsed
  time.

## AI-FX-02 - Repeated terminal action releases stock twice

- **Generation context:** T-14 asked to test an AI-generated candidate for
  “repeated expiration double-credit” and to assert stock conservation.
- **Faulty source:** [`candidates.mjs`](./scratch-ai-failure-experiments/candidates.mjs#L25)
  (`createRepeatedReleaseCandidate`, lines 25–47).
- **Exact faulty snippet:**

  ```js
  expire() {
    state.available += reservation.quantity;
    state.reserved -= reservation.quantity;
    reservation.status = 'EXPIRED';
  },
  cancel() {
    state.available += reservation.quantity;
    state.reserved -= reservation.quantity;
    reservation.status = 'CANCELLED';
  },
  ```

- **Risk / invariant violated:** Both actions release without checking that the
  reservation is still active. Repeating a terminal action over-credits
  available stock; a second release can permit overselling.
- **Reproduction:** [`double-release.test.mjs`](./scratch-ai-failure-experiments/double-release.test.mjs#L1)
  performs `reserve → expire → cancel` with initial stock 1 and checks the
  resulting available count and nonnegative/conservation invariants.
- **Command:** `node --test HW\HW3\scratch-ai-failure-experiments\double-release.test.mjs`
- **Actual result:** Exit code 1; 1 test, 0 passed, 1 failed. The assertion
  reported `expected available=1 after repeated terminal action, got 2`
  (`2 !== 1`). Full captured output:
  [`double-release.failure.log`](./scratch-ai-failure-experiments/double-release.failure.log).
- **Approved correction:** [`inventory.js`](./src/inventory.js#L66) returns
  without mutation when a reservation is not `ACTIVE_RESERVATION`; its single
  transition then changes the reservation state and releases stock once
  ([`inventory.js`](./src/inventory.js#L84)). Regression
  [`reservations.test.mjs`](./tests/reservations.test.mjs#L80) checks expiry,
  repeated expiry, cancel, and another expiry, asserting conservation and
  counts after every action.
- **Retest:** The focused approved timer/reservation run passed **21/21**, 0
  failed, 0 skipped; see
  [`approved-regressions.pass.log`](./scratch-ai-failure-experiments/approved-regressions.pass.log).
- **Prevention:** Make terminal transition and stock mutation one synchronous
  operation, and accept release only from an active reservation.

## AI-FX-03 - Checkout accepts a reservation at its deadline

- **Generation context:** T-14 asked to test an AI-generated candidate for
  “checkout-after-expiry acceptance” when the timeout callback is delayed.
- **Faulty source:** [`candidates.mjs`](./scratch-ai-failure-experiments/candidates.mjs#L50)
  (`createTimeoutOnlyCheckoutCandidate`, lines 50–78).
- **Exact faulty snippet:**

  ```js
  checkout() {
    if (reservation.status !== 'RESERVED') return { ok: false };
    reservation.status = 'CHECKED_OUT';
    state.reserved -= reservation.quantity;
    state.sold += reservation.quantity;
    return { ok: true };
  },
  ```

- **Risk / invariant violated:** Checkout checks only the status that is still
  `RESERVED` until the timeout runs. At `now === expiresAt`, delayed timeout
  delivery therefore allows a sale after the reservation deadline.
- **Reproduction:** [`late-checkout.test.mjs`](./scratch-ai-failure-experiments/late-checkout.test.mjs#L1)
  reserves stock with `expiresAt = 1050`, advances the clock from 1000 to
  exactly 1050, and calls checkout before executing the saved timeout callback.
- **Command:** `node --test HW\HW3\scratch-ai-failure-experiments\late-checkout.test.mjs`
- **Actual result:** Exit code 1; 1 test, 0 passed, 1 failed. The assertion
  reported `expected checkout rejection at 1050, got ok=true, status=CHECKED_OUT`
  (`true !== false`). Full captured output:
  [`late-checkout.failure.log`](./scratch-ai-failure-experiments/late-checkout.failure.log).
- **Approved correction:** [`reservations.js`](./src/reservations.js#L163)
  checks expiry inside the synchronous checkout action before calling the
  inventory mutation. [`reservations.js`](./src/reservations.js#L224) treats
  equality as expired (`currentTime < expiresAt` is the only non-expired case)
  and reconciles expiry/release before returning failure. The existing
  [`reservations.test.mjs`](./tests/reservations.test.mjs#L63) exercises the
  exact boundary before the scheduled callback fires.
- **Retest:** The focused approved timer/reservation run passed **21/21**, 0
  failed, 0 skipped; see
  [`approved-regressions.pass.log`](./scratch-ai-failure-experiments/approved-regressions.pass.log).
- **Prevention:** Validate the deadline at action time in the same synchronous
  mutation path. A timeout is only a freshness/UI mechanism, never the
  authority for whether checkout is allowed.

## Scope and evidence limitations

- Candidate failures are reproducible deterministic simulations. They are
  evidence about these isolated candidate implementations only; they do not
  indicate that the approved production implementation has these defects.
- Production code was not changed for these findings because the approved
  implementation already satisfies the reproduced cases. Only focused
  regression tests were added.
- The inventory store remains a single-browser, single-store simulation.
  Neither these tests nor JavaScript `Promise.all` establish cross-tab,
  cross-browser, server-side, or distributed atomicity.
- The checkout shown by the app is demonstrative; no payment is processed.