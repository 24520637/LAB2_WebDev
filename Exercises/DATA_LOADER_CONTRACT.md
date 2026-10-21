# Tasks 3.3 & 3.4 — Async Data Loader Contract

## Task 3.3: implement_async_data_loader

### Objective

Implement an asynchronous data-loading workflow that integrates
with the lifecycle finite state machine.

### Requirements

- Transition to LOADING before starting a request.
- Await the asynchronous data operation.
- Transition to SUCCESS when the current request succeeds.
- Keep fetched data separate from lifecycle state.
- Transition to ERROR when the current request fails.
- Store a safe, human-readable error message.
- Notify the UI when the state changes.

### Lifecycle transitions

| Current state | Event | Next state |
|---|---|---|
| IDLE | LOAD | LOADING |
| LOADING | RESOLVE | SUCCESS |
| LOADING | REJECT | ERROR |
| ERROR | RETRY | LOADING |
| SUCCESS | LOAD | LOADING |

## Task 3.4: prevent_stale_async_responses

### Objective

Prevent outdated asynchronous requests from overwriting the
state or data produced by a newer request.

### Request ID policy

1. Increment the request ID whenever loadData() starts.
2. Capture the ID belonging to that request.
3. Compare the captured ID with the latest request ID after
   the asynchronous operation completes.
4. Ignore a successful result if its ID is stale.
5. Ignore a failure if its ID is stale.
6. Only the latest request may commit data or an error state.

### Expected behavior

- A newer successful request cannot be overwritten by an older result.
- An older failure cannot replace a newer successful state.
- An older success cannot replace a newer error state.
- Request IDs increase monotonically.
- Request identity is separate from the four lifecycle states.

### Security and implementation constraints

- Do not use innerHTML, outerHTML, or document.write().
- Do not expose raw backend exception details to the UI.
- Keep lifecycle state separate from returned data and error messages.
- The UI should render safely using DOM APIs or textContent.

## Run tests

From the exercise3 directory:

```bash
node --test tests/lifecycle-state.test.js tests/load-data.test.js