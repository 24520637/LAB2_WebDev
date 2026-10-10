"use strict";

/**
 * Exercise 3 — Tasks 3.3, 3.4, and 3.5.
 * Async data loader with duplicate-request deduplication and cleanup.
 *
 * Lifecycle states remain IDLE, LOADING, SUCCESS, or ERROR.
 * Request IDs, AbortController, and disposal are coordination metadata.
 */

const lifecycleModule =
  typeof require === "function"
    ? require("./lifecycle-state.js")
    : (globalThis.LifecycleStateMachine || {});

const {
  LifecycleState,
  LifecycleEvent,
  transitionState
} = lifecycleModule;

const DEFAULT_ERROR_MESSAGE =
  "Unable to load data. Please try again.";

const CANCELLED_ERROR_MESSAGE =
  "The request was cancelled. Please try again.";

function createDataLoader({ fetchData, onChange = () => {} }) {
  if (typeof fetchData !== "function") {
    throw new TypeError(
      "createDataLoader requires a fetchData function"
    );
  }

  if (typeof onChange !== "function") {
    throw new TypeError("onChange must be a function");
  }

  let state = LifecycleState.IDLE;
  let data = null;
  let error = null;
  let latestRequestId = 0;
  let inFlightPromise = null;
  let activeController = null;
  let disposed = false;

  function getSnapshot() {
    return Object.freeze({
      state,
      data,
      error,
      requestId: latestRequestId
    });
  }

  function notify() {
    if (!disposed) {
      onChange(getSnapshot());
    }
  }

  function transition(event) {
    state = transitionState(state, event);
  }

  /**
   * Start a request or return the existing Promise
   * when a request is already loading.
   *
   * Duplicate calls are deduplicated.
   */
  function loadData() {
    if (disposed) {
      return Promise.resolve({
        status: "disposed",
        requestId: latestRequestId
      });
    }

    // TASK 3.5:
    // Reuse the current Promise instead of starting
    // another request while LOADING.
    if (
      state === LifecycleState.LOADING &&
      inFlightPromise
    ) {
      return inFlightPromise;
    }

    const requestId = ++latestRequestId;

    activeController = new AbortController();

    if (
      state === LifecycleState.IDLE ||
      state === LifecycleState.SUCCESS
    ) {
      transition(LifecycleEvent.LOAD);
    } else if (state === LifecycleState.ERROR) {
      transition(LifecycleEvent.RETRY);
    }

    error = null;
    notify();

    const controller = activeController;

    const requestPromise = Promise.resolve()
      .then(() => fetchData(controller.signal))
      .then(result => {
        // Ignore results from obsolete requests
        // or a disposed component.
        if (
          disposed ||
          requestId !== latestRequestId
        ) {
          return {
            status: "stale",
            requestId
          };
        }

        data = result;
        error = null;

        transition(LifecycleEvent.RESOLVE);
        notify();

        return {
          status: "success",
          requestId,
          data: result
        };
      })
      .catch(() => {
        // A stale failure must not replace the
        // current request's UI state.
        if (
          disposed ||
          requestId !== latestRequestId
        ) {
          return {
            status: "stale",
            requestId
          };
        }

        error = DEFAULT_ERROR_MESSAGE;

        transition(LifecycleEvent.REJECT);
        notify();

        return {
          status: "error",
          requestId,
          error
        };
      })
      .finally(() => {
        // Clear references only for the latest request.
        if (requestId === latestRequestId) {
          inFlightPromise = null;
          activeController = null;
        }
      });

    inFlightPromise = requestPromise;

    return requestPromise;
  }

  /**
   * Call when the owning component unmounts
   * or is replaced.
   *
   * Abort the active request and invalidate its ID.
   * Late results cannot update data, error, or UI.
   */
  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;

    // Invalidate any request still in progress.
    latestRequestId += 1;

    if (activeController) {
      activeController.abort();
    }

    activeController = null;
    inFlightPromise = null;
  }

  return Object.freeze({
    loadData,
    getSnapshot,
    dispose
  });
}

const loadDataAPI = Object.freeze({
  createDataLoader,
  DEFAULT_ERROR_MESSAGE,
  CANCELLED_ERROR_MESSAGE
});

if (
  typeof module !== "undefined" &&
  module.exports
) {
  module.exports = loadDataAPI;
}

if (typeof window !== "undefined") {
  window.AsyncDataLoader = loadDataAPI;
}