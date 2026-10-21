
/**
 * Task 3.1 — Define lifecycle states.
 *
 * The state machine is intentionally independent of the DOM and UI.
 * It only validates and calculates state transitions.
 */

/**
 * @readonly
 * @enum {string}
 */
const LifecycleState = Object.freeze({
  IDLE: "IDLE",
  LOADING: "LOADING",
  SUCCESS: "SUCCESS",
  ERROR: "ERROR",
});

/**
 * @readonly
 * @enum {string}
 */
const LifecycleEvent = Object.freeze({
  LOAD: "LOAD",
  RESOLVE: "RESOLVE",
  REJECT: "REJECT",
  RETRY: "RETRY",
});

/**
 * Transition table:
 *
 * IDLE    + LOAD   -> LOADING
 * LOADING + RESOLVE -> SUCCESS
 * LOADING + REJECT  -> ERROR
 * ERROR   + RETRY   -> LOADING
 * SUCCESS + LOAD    -> LOADING
 *
 * Any transition not listed above is invalid.
 *
 * @param {string} currentState
 * @param {string} event
 * @returns {string} The next lifecycle state.
 * @throws {TypeError} If the state or event is unknown.
 * @throws {Error} If the transition is not allowed.
 */
function transitionState(currentState, event) {
  const validStates = Object.values(LifecycleState);
  const validEvents = Object.values(LifecycleEvent);

  if (!validStates.includes(currentState)) {
    throw new TypeError(`Unknown lifecycle state: ${currentState}`);
  }

  if (!validEvents.includes(event)) {
    throw new TypeError(`Unknown lifecycle event: ${event}`);
  }

  const transitions = {
    [`${LifecycleState.IDLE}:${LifecycleEvent.LOAD}`]:
      LifecycleState.LOADING,

    [`${LifecycleState.LOADING}:${LifecycleEvent.RESOLVE}`]:
      LifecycleState.SUCCESS,

    [`${LifecycleState.LOADING}:${LifecycleEvent.REJECT}`]:
      LifecycleState.ERROR,

    [`${LifecycleState.ERROR}:${LifecycleEvent.RETRY}`]:
      LifecycleState.LOADING,

    [`${LifecycleState.SUCCESS}:${LifecycleEvent.LOAD}`]:
      LifecycleState.LOADING,
  };

  const transitionKey = `${currentState}:${event}`;
  const nextState = transitions[transitionKey];

  if (!nextState) {
    throw new Error(
      `Invalid lifecycle transition: ${currentState} + ${event}`
    );
  }

  return nextState;
}

// Support Node.js unit tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LifecycleState,
    LifecycleEvent,
    transitionState,
  };
}

// Support classic browser scripts.
if (typeof window !== "undefined") {
  window.LifecycleStateMachine = {
    LifecycleState,
    LifecycleEvent,
    transitionState,
  };
}