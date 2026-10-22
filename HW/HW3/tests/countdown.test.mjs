import test from 'node:test';
import assert from 'node:assert/strict';
import { CountdownClock, formatRemainingTime } from '../src/countdown.js';

function fixture(initialTime = 1_000) {
  let currentTime = initialTime;
  let nextFrameId = 0;
  const frames = new Map();
  const cancelled = [];
  const listeners = new Map();
  const documentRef = {
    hidden: false,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  const clock = new CountdownClock({
    now: () => currentTime,
    requestFrame: callback => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    },
    cancelFrame: id => {
      cancelled.push(id);
      frames.delete(id);
    },
    documentRef,
  });

  return {
    clock,
    frames,
    cancelled,
    listeners,
    documentRef,
    setTime: value => { currentTime = value; },
    frame() {
      const [id, callback] = frames.entries().next().value ?? [];
      assert.notEqual(id, undefined, 'expected a pending frame');
      frames.delete(id);
      callback();
    },
  };
}

test('derives every update from one fixed wall-clock target', () => {
  const f = fixture();
  const updates = [];
  const completed = [];
  const target = f.clock.start(5_000, {
    onUpdate: update => updates.push(update),
    onComplete: update => completed.push(update),
  });

  assert.equal(target, 6_000);
  assert.equal(f.clock.running, true);
  assert.equal(f.frames.size, 1);
  assert.deepEqual(updates.map(update => [update.remainingMs, update.display]), [
    [5_000, '00:00:05'],
  ]);

  f.setTime(2_500);
  f.frame();
  assert.equal(f.clock.running, true);
  assert.equal(f.clock.session.targetTime, target);
  assert.deepEqual(updates.map(update => [update.remainingMs, update.display]), [
    [5_000, '00:00:05'],
    [3_500, '00:00:04'],
  ]);

  f.setTime(6_000);
  f.frame();
  assert.equal(f.clock.running, false);
  assert.equal(f.frames.size, 0);
  assert.equal(completed.length, 1);
  assert.deepEqual([completed[0].remainingMs, completed[0].display], [0, '00:00:00']);
});

test('a delayed frame past the deadline clamps at zero and completes only once', () => {
  const f = fixture(10_000);
  const updates = [];
  let completions = 0;
  f.clock.start(2_000, {
    onUpdate: update => updates.push(update),
    onComplete: update => {
      completions += 1;
      assert.equal(update.targetTime, 12_000);
    },
  });
  const staleFrame = f.frames.get(1);

  f.setTime(25_000);
  f.frame();
  staleFrame();

  assert.deepEqual(updates.map(update => update.remainingMs), [2_000, 0]);
  assert.ok(updates.every(update => update.remainingMs >= 0));
  assert.equal(completions, 1);
  assert.equal(f.clock.running, false);
  assert.equal(f.frames.size, 0);
});

test('a single frame after a 60-second pause catches up to the fixed deadline', () => {
  const f = fixture(10_000);
  const updates = [];
  let completions = 0;
  f.clock.start(60_000, {
    onUpdate: update => updates.push(update.remainingMs),
    onComplete: () => { completions += 1; },
  });

  f.setTime(70_000);
  f.frame();

  assert.deepEqual(updates, [60_000, 0]);
  assert.equal(completions, 1);
  assert.equal(f.clock.running, false);
  assert.equal(f.frames.size, 0);
});

test('visibility refresh catches up to wall time and does not duplicate frames', () => {
  const f = fixture();
  const updates = [];
  let completions = 0;
  f.clock.start(10_000, {
    onUpdate: update => updates.push(update.remainingMs),
    onComplete: () => { completions += 1; },
  });

  assert.equal(f.frames.size, 1);
  f.setTime(4_000);
  f.listeners.get('visibilitychange')();
  assert.deepEqual(updates, [10_000, 7_000]);
  assert.equal(f.frames.size, 1);
  assert.deepEqual(f.cancelled, [1]);

  f.setTime(11_000);
  f.listeners.get('visibilitychange')();
  assert.deepEqual(updates, [10_000, 7_000, 0]);
  assert.equal(completions, 1);
  assert.equal(f.frames.size, 0);
  f.listeners.get('visibilitychange')();
  assert.equal(completions, 1);
});

test('zero duration updates and completes synchronously without scheduling RAF', () => {
  const f = fixture(8_000);
  const updates = [];
  const completions = [];

  const target = f.clock.start(0, {
    onUpdate: update => updates.push(update),
    onComplete: update => completions.push(update),
  });

  assert.equal(target, 8_000);
  assert.equal(f.clock.running, false);
  assert.equal(f.frames.size, 0);
  assert.deepEqual(updates.map(update => update.display), ['00:00:00']);
  assert.equal(completions.length, 1);
  assert.equal(completions[0].remainingMs, 0);
});

test('restart replaces the previous run and leaves exactly one update loop', () => {
  const f = fixture();
  const oldUpdates = [];
  const oldCompletions = [];
  const newUpdates = [];

  f.clock.start(10_000, {
    onUpdate: update => oldUpdates.push(update),
    onComplete: () => oldCompletions.push(true),
  });
  f.setTime(2_000);
  const target = f.clock.start(3_000, { onUpdate: update => newUpdates.push(update) });

  assert.equal(target, 5_000);
  assert.deepEqual(oldUpdates.map(update => update.remainingMs), [10_000]);
  assert.deepEqual(oldCompletions, []);
  assert.deepEqual(newUpdates.map(update => update.remainingMs), [3_000]);
  assert.deepEqual(f.cancelled, [1]);
  assert.equal(f.frames.size, 1);

  f.setTime(5_000);
  f.frame();
  assert.deepEqual(newUpdates.map(update => update.remainingMs), [3_000, 0]);
  assert.equal(oldUpdates.length, 1);
});

test('stop and dispose cancel pending work, remove listener and are idempotent', () => {
  const f = fixture();
  let completions = 0;
  f.clock.start(5_000, { onComplete: () => { completions += 1; } });
  const staleFrame = f.frames.get(1);

  assert.equal(f.clock.stop(), true);
  assert.equal(f.clock.stop(), false);
  assert.equal(f.frames.size, 0);
  assert.deepEqual(f.cancelled, [1]);
  staleFrame();
  assert.equal(completions, 0);

  f.clock.start(5_000);
  assert.equal(f.clock.dispose(), true);
  assert.equal(f.clock.dispose(), false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.clock.running, false);
  assert.throws(() => f.clock.start(1), /disposed/);
});

test('validates durations, callbacks and formatter input', () => {
  const f = fixture();
  for (const duration of [-1, Infinity, NaN, '1000', null]) {
    assert.throws(() => f.clock.start(duration), RangeError);
  }
  assert.throws(() => f.clock.start(1, { onUpdate: null }), TypeError);
  assert.throws(() => new CountdownClock({ now: 1 }), TypeError);
  assert.throws(() => formatRemainingTime(-1), RangeError);
  assert.throws(() => formatRemainingTime(Infinity), RangeError);
  assert.deepEqual(
    [0, 1, 60_000, 3_600_000, 90_061_000].map(formatRemainingTime),
    ['00:00:00', '00:00:01', '00:01:00', '01:00:00', '25:01:01'],
  );
});

test('callback failure stops the clock and does not leave a frame behind', () => {
  const f = fixture();
  const failure = new Error('render failed');

  assert.throws(() => f.clock.start(1_000, {
    onUpdate: () => { throw failure; },
  }), error => error === failure);
  assert.equal(f.clock.running, false);
  assert.equal(f.frames.size, 0);
});
