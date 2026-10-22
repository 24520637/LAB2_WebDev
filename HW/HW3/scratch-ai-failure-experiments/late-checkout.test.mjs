import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimeoutOnlyCheckoutCandidate } from './candidates.mjs';

test('candidate checkout must reject now >= expiresAt before timeout delivery', () => {
  let wallClock = 1_000;
  let delayedExpiry;
  const candidate = createTimeoutOnlyCheckoutCandidate({
    initialStock: 1,
    expiresAt: 1_050,
    scheduleExpiry: callback => { delayedExpiry = callback; },
  });
  wallClock = 1_050;

  const result = candidate.checkout();
  const snapshot = candidate.snapshot();
  assert.equal(
    result.ok,
    false,
    `expected checkout rejection at ${wallClock}, got ok=${result.ok}, status=${snapshot.status}`,
  );
  assert.equal(snapshot.available + snapshot.reserved + snapshot.sold, 1);
  assert.equal(typeof delayedExpiry, 'function');
});
