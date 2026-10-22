# T-01–T-03 — FIFO Audio Queue Contract

**Status:** T-01 contract and T-02/T-03 queue and loader modules are implemented in
`src/` with executable Node tests. Playback, Web Audio graph, and UI remain
future tasks.

## 1. Responsibilities and inputs

- **Queue controller (T-02):** validates, deduplicates, sequences, transitions tasks, and emits one terminal outcome per task. It does not create audio nodes, draw frames, or own UI components.
- **Loader (T-03):** uses the queue-owned `AbortSignal` for fetch, checks HTTP status, reads response bytes, decodes audio, and returns typed fetch/decode failures.
- **Ready consumer:** the queue's synchronous `onReady(track, buffer)` callback takes ownership of each decoded result. The queue does not retain buffers in task snapshots or lifecycle events. The consumer releases the buffer when playback no longer needs it.
- **Playback controller (future T-04/T-05):** owns the current `AudioBufferSourceNode` and playback session; reports started, naturally ended, and manually interrupted events.
- **UI (future T-08):** provides explicit user actions; never writes queue state directly.

Proposed input record: `{ id: string, url: string, metadata?: object }`.
`id` must be nonempty, stable for the lifetime of the task, and assigned by the caller; `url` must be a nonempty string. `metadata` is opaque and must not affect FIFO ordering. Enqueue order is a monotonic sequence number assigned **when accepted**. Invalid inputs are rejected with a structured validation error and create no task.

## 2. Duplicate-ID rule and public actions

- `enqueue(track)`: if `id` has **ever been accepted during this queue instance's lifetime** (including already terminal tasks), return `duplicate_id` and do not mutate queue. This avoids late-event collisions. Two **different IDs may reference the same URL** and represent separate tasks. A new queue instance can reuse IDs.
- `cancel(id)`: for a queued task, remove it from pending order, finalize as `cancelled`, and never start fetch; for fetching, request fetch abort; for decoding, invalidate output; for ready, release queued buffer; for playing, stop playback and finalize as `cancelled`. Unknown IDs produce `not_found`; terminal IDs produce `already_terminal` (no second terminal event). **Cancel does not mean skip.**
- `skip()`: target **only the currently playing task**; stop its source, finalize it as `skipped`, and attempt the next task. If nothing is playing, return `nothing_playing` without cancelling a queued/loading task. A queued task may be cancelled only by `cancel(id)`.
- `fail(id, error)`: finalize the matching nonterminal task as `failed` once, report error category and proceed with the next valid task. Only the matching task fails; no failure poisons the queue. Ignore stale asynchronous callbacks after an earlier terminal transition.
- `completed` arises from a **natural playback end** only (not from skip/cancel/stop). `enqueue`, `cancel`, and `skip` yield explicit success/rejection results; failures never masquerade as success.

## 3. State machine

Nonterminal states: `queued`, `fetching`, `decoding`, `ready`, `playing`.
Terminal states (exactly one): `completed`, `cancelled`, `skipped`, `failed`.

| Current state | Valid next states | Trigger |
|---|---|---|
| (new) | `queued` | accepted enqueue |
| `queued` | `fetching`, `cancelled` | worker claims next; cancel(id) |
| `fetching` | `decoding`, `cancelled`, `failed` | fetch success; cancel; fetch/HTTP error |
| `decoding` | `ready`, `cancelled`, `failed` | decode resolves; cancel; decode error |
| `ready` | `playing`, `cancelled`, `failed` | playback begins; cancel; playback setup fails |
| `playing` | `completed`, `cancelled`, `skipped`, `failed` | natural end; cancel; skip; playback error |
| any terminal | none | terminal states are immutable |

No transition may return to `queued`, jump directly from `fetching` to `playing`, or turn `skipped` into `completed`. A task may enter `ready` and wait until the playback slot is free. No pause/resume semantics are specified by T-01.

## 4. Ordering and concurrency invariants

1. Accepted tasks receive strictly increasing `enqueueSequence`; the fetch/decode worker **claims** tasks in ascending sequence order (FIFO). Cancellation may remove tasks without reordering remaining tasks.
2. At most **one** task owns the active fetch/decode worker, including any non-abortable decoding still settling (`maxConcurrency = 1`). Repeated wake/drain signals must not start extra workers.
3. At most **one** task may be `playing`; playback starts in accepted FIFO order among nonterminal tasks. A decoded task waits in `ready` if playback is busy.
4. Each accepted task transitions to **at most one** terminal state; once it reaches a terminal state, exactly one terminal event is emitted. Tasks not yet finished may remain nonterminal. On orderly shutdown, all accepted nonterminal tasks must eventually be finalized (typically `cancelled`).
5. Terminal transition is atomic at the contract level (check state + set terminal + publish one terminal event). Late `onended`, late fetch errors, or decode resolutions with obsolete generation/session tokens cannot change outcome.
6. If active `decodeAudioData()` cannot be aborted, `cancel(id)` marks the task `cancelled` immediately for clients, but the **worker slot remains reserved** until the decoder settles. Discard the result and release references; only then process the next task. This avoids hidden overlapping decode work.
7. Failure or cancellation must not reorder the remaining tasks or permanently stall dispatch. Advancement can occur when the affected worker/playback slot is safely released.

## 5. Events and ownership

Proposed observable events: `task:accepted`, `task:state`, `task:terminal`, and `queue:idle`. Every task event includes `id`, `enqueueSequence`, `state`, and a monotonically increasing per-task `revision` (or equivalent session/generation token). `task:terminal` also includes exactly one of `completed | cancelled | skipped | failed`; errors have safe category/detail, without binary audio data. Emitting `queue:idle` does not terminate tasks.

| Resource | Owner | Required release boundary |
|---|---|---|
| accepted IDs, state records, ordering | queue instance | queue disposal; retain lightweight terminal ID tombstones while instance lives |
| fetch `AbortController` | loader for active task | abort on cancel/dispose; release after fetch settles |
| non-abortable decode + stale token | loader/worker | reject stale completion; worker frees slot after settle |
| decoded `AudioBuffer` | loader until synchronous `onReady` handoff; then consumer | release when playback no longer needs it |
| `AudioBufferSourceNode` / event handlers | playback controller | stop/disconnect and remove handlers on finish/skip/cancel/dispose |
| shared `AudioContext`, analyser, RAF loop | later audio/visualizer owners | explicit owner-only cleanup, not queue controller |

After unmount/disposal, cancel all remaining tasks, invalidate callbacks, remove subscriptions, and prevent playback or UI notifications from stale work; avoid retaining `AudioBuffer`s in terminal records. Exact APIs and resource-release implementation are deferred to T-02–T-07.

## 6. Contract-level verification cases

| ID | Scenario | Expected invariant |
|---|---|---|
| C01 | enqueue A, B, C synchronously | accepted sequence A,B,C; processing claim order A,B,C |
| C01a | worker returns buffer with consumer configured | consumer receives matching task and buffer exactly once; snapshots/events do not retain the buffer |
| C01b | worker returns buffer without consumer | task fails explicitly with `missing_consumer`; following task still runs |
| C01c | consumer throws while accepting buffer | only that task fails with `consumer_error`; following task still runs |
| C01d | consumer returns a Promise | async handoff is rejected; handoff callbacks must synchronously accept ownership |
| C02 | enqueue A twice before start | second rejected `duplicate_id`; one task A |
| C03 | enqueue A after A completed | rejected `duplicate_id` in same queue instance |
| C04 | same URL with IDs A and B | both accepted and distinct, ordered A then B |
| C05 | cancel queued B in A,B,C | B becomes `cancelled` without fetch; A then C |
| C06 | cancel A during fetch | abort requested; one `cancelled` outcome; proceed safely |
| C07 | cancel A during decode; decoder settles late | one `cancelled`; late result discarded; next decode not overlapping |
| C08 | skip with A playing and B queued | A `skipped`, B progresses; no `completed` for A |
| C09 | cancel A while playing | A `cancelled` (not `skipped`); next proceeds |
| C10 | skip while no track playing | `nothing_playing`; queue unchanged |
| C11 | A fetch fails; B queued | A `failed`, B eventually begins |
| C12 | A decode fails; B queued | A `failed`, B eventually begins |
| C13 | A `onended` races with skip/cancel | precisely one terminal outcome, one advancement |
| C14 | simultaneous drain triggers | worker count never exceeds one |
| C15 | unmount during each active phase | all nonterminal tasks cancelled; no stale callbacks cause playback |

**Verification status:** T-02 and T-03 scenarios are covered by `tests/fifo-queue.test.mjs` and `tests/audio-loader.test.mjs`. Run them with `node --test tests/*.test.mjs` from `HW/HW2`. Playback-dependent ownership/release scenarios remain for T-04/T-05.

## 7. Deferred decisions and scope boundaries

- This contract deliberately fixes serialized fetch/decode and sequential playback. Prefetching, parallel decode, priority queueing, retry policy, and pause/resume are **out of scope** without a reviewed contract revision.
- **Open:** browser unlock/UI presentation and exact error codes/types depend on actual framework and existing conventions; confirm when a full checkout is provided.
- **Open:** whether UI should call `skip` during buffering is intentionally specified as no-op; any alternative must be reviewed before T-05.
- **Open:** retention policy for terminal task metadata should avoid indefinite memory growth in long-lived queue instances; keep IDs only as needed for deduplication or add an explicit reset/new-instance boundary later.
