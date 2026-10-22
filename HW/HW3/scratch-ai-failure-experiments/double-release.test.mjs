import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepeatedReleaseCandidate } from './candidates.mjs';

test('candidate repeated terminal actions must preserve stock conservation', () => {
  const candidate = createRepeatedReleaseCandidate(1);
  candidate.reserve();
  candidate.expire();
  candidate.cancel();

  const state = candidate.snapshot();
  assert.equal(
    state.available,
    1,
    `expected available=1 after repeated terminal action, got ${state.available}`,
  );
  assert.equal(
    state.available + state.reserved,
    1,
    `expected conserved stock=1, got available=${state.available}, reserved=${state.reserved}`,
  );
  assert.ok(state.available >= 0);
  assert.ok(state.reserved >= 0);
});
