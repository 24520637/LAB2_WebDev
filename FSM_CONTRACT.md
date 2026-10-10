
# Exercise 3 — Tasks 3.1 & 3.2: Lifecycle FSM Contract

## Lifecycle state type

The only permitted lifecycle states are `IDLE | LOADING | SUCCESS | ERROR`. The initial state is `IDLE`. Fetched data and error details are not lifecycle states and must be stored separately.

## Event contract

The supported events are `LOAD | RESOLVE | REJECT | RETRY`.

| Current state | Event | Next state | Contract |
|---|---|---|---|
| `IDLE` | `LOAD` | `LOADING` | Start a load attempt |
| `LOADING` | `RESOLVE` | `SUCCESS` | Current load succeeded |
| `LOADING` | `REJECT` | `ERROR` | Current load failed |
| `ERROR` | `RETRY` | `LOADING` | Start a retry attempt |
| `SUCCESS` | `LOAD` | `LOADING` | Refresh the data |

All other pairs are invalid. In particular, a second `LOAD` while already `LOADING` is rejected; request deduplication/supersession policy belongs to the async-loader task (3.5), not this pure transition function. Stale responses must be filtered by request identity before dispatching `RESOLVE` or `REJECT` (Task 3.4).

## Invalid-transition behavior

- Unknown state or event: throw `TypeError`.
- Known state/event pair that is not allowed: throw `Error`.
- The function does not mutate data, errors, DOM, or external state.
- Callers are responsible for catching/recovering from invalid transitions; invalid events must not silently change the state.

## UI contract by state

- `IDLE`: initial/neutral view.
- `LOADING`: loading skeleton and accessible loading status.
- `SUCCESS`: current successful data view (or an empty-data message).
- `ERROR`: human-readable error and a keyboard-accessible `Retry Connection` button.

## Test command

From the `exercise3` directory, run:

```sh
node --test tests/lifecycle-state.test.js
```