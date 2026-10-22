import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecrementPerFrameTimer } from './candidates.mjs';

test('candidate timer must catch up after a 60-second pause with one callback', () => {
  let wallClock = 10_000;
  const callbacks = [];
  const candidate = createDecrementPerFrameTimer({
    now: () => wallClock,
    requestFrame: callback => callbacks.push(callback),
  });

  candidate.start(60_000);
  wallClock += 60_000;
  callbacks.shift()();

  const actualRemaining = candidate.remaining();
  assert.equal(actualRemaining, 0, `expected deadline-based remaining=0, got ${actualRemaining}`);
});
