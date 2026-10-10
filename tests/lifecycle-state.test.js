
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LifecycleState,
  LifecycleEvent,
  transitionState,
} = require("../js/lifecycle-state.js");

test("lifecycle states are defined correctly", () => {
  assert.deepEqual(Object.values(LifecycleState), [
    "IDLE",
    "LOADING",
    "SUCCESS",
    "ERROR",
  ]);
});

test("lifecycle events are defined correctly", () => {
  assert.deepEqual(Object.values(LifecycleEvent), [
    "LOAD",
    "RESOLVE",
    "REJECT",
    "RETRY",
  ]);
});

test("IDLE + LOAD transitions to LOADING", () => {
  assert.equal(
    transitionState(LifecycleState.IDLE, LifecycleEvent.LOAD),
    LifecycleState.LOADING
  );
});

test("LOADING + RESOLVE transitions to SUCCESS", () => {
  assert.equal(
    transitionState(LifecycleState.LOADING, LifecycleEvent.RESOLVE),
    LifecycleState.SUCCESS
  );
});

test("LOADING + REJECT transitions to ERROR", () => {
  assert.equal(
    transitionState(LifecycleState.LOADING, LifecycleEvent.REJECT),
    LifecycleState.ERROR
  );
});

test("ERROR + RETRY transitions to LOADING", () => {
  assert.equal(
    transitionState(LifecycleState.ERROR, LifecycleEvent.RETRY),
    LifecycleState.LOADING
  );
});

test("SUCCESS + LOAD transitions to LOADING", () => {
  assert.equal(
    transitionState(LifecycleState.SUCCESS, LifecycleEvent.LOAD),
    LifecycleState.LOADING
  );
});

test("invalid transitions throw an error", () => {
  const validStates = Object.values(LifecycleState);
  const validEvents = Object.values(LifecycleEvent);

  const allowedTransitions = new Set([
    "IDLE:LOAD",
    "LOADING:RESOLVE",
    "LOADING:REJECT",
    "ERROR:RETRY",
    "SUCCESS:LOAD",
  ]);

  for (const state of validStates) {
    for (const event of validEvents) {
      const key = `${state}:${event}`;

      if (!allowedTransitions.has(key)) {
        assert.throws(
          () => transitionState(state, event),
          {
            message: `Invalid lifecycle transition: ${state} + ${event}`,
          }
        );
      }
    }
  }
});

test("unknown states throw TypeError", () => {
  assert.throws(
    () => transitionState("UNKNOWN", LifecycleEvent.LOAD),
    TypeError
  );
});

test("unknown events throw TypeError", () => {
  assert.throws(
    () => transitionState(LifecycleState.IDLE, "UNKNOWN"),
    TypeError
  );
});

test("transitionState does not mutate the state or event enums", () => {
  const statesBefore = { ...LifecycleState };
  const eventsBefore = { ...LifecycleEvent };

  transitionState(LifecycleState.IDLE, LifecycleEvent.LOAD);

  assert.deepEqual({ ...LifecycleState }, statesBefore);
  assert.deepEqual({ ...LifecycleEvent }, eventsBefore);
});

test("state and event enums are frozen", () => {
  assert.equal(Object.isFrozen(LifecycleState), true);
  assert.equal(Object.isFrozen(LifecycleEvent), true);
});