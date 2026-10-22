# HW2 AI Failure Audit

## T-03 — Cancellable fetch/decode and buffer handoff

- **Finding:** The audio loader returned the decoded buffer, but the queue
  awaited the worker, marked the task `ready`, and discarded the result
  (`void result` in `src/fifo-queue.mjs`). The isolated loader tests passed,
  but the decoded buffer was not made available to a playback/ready consumer.

- **Original prompt that led to the issue:**
  > Implement only T-03 from TASK DECOMPOSITION.md. follow PROJECT_RULE.md
  >
  > Create the audio loading service that fetches a URL with AbortController,
  > checks response.ok, reads arrayBuffer(), and decodes audio with
  > AudioContext.decodeAudioData().
  >
  > Handle HTTP errors, network failures, AbortError, and decoding failures
  > distinctly. Connect cancellation to the T-02 queue contract.
  >
  > IMPORTANT EDGE CASE: decodeAudioData() does not accept an AbortSignal and
  > may finish after cancellation. Never pretend that aborting fetch cancels a
  > decode already in progress. Use task identity/generation validity checks to
  > discard stale results and ensure a cancelled result cannot be played.
  >
  > Respect maxConcurrency = 1 for the complete load/decode lifecycle. Do not
  > start the next decode early merely because the current task was cancelled
  > while decoding; follow the approved serialization contract until the
  > pending decode settles.
  >
  > Test successful decoding, HTTP failure, network failure, abort, corrupt
  > audio, and late decode completion using the existing test setup.

### How the issue was detected

- Traced the decoded value through `src/audio-loader.mjs` and
  `src/fifo-queue.mjs`. The loader returned the decoded buffer, but the queue
  discarded it after awaiting the worker.
- The loader-only success test did not verify delivery to a consumer. Added
  queue/loader integration coverage using a mock buffer to verify the correct
  task and exact buffer object are handed off once, and that queue snapshots and
  lifecycle events do not retain the buffer.
- Ran `node --test tests/*.test.mjs`, including deferred-promise cancellation
  coverage to ensure late decode results are not handed off and do not overlap
  the next decode.

### Fix

- Added a synchronous `onReady(track, buffer)` callback to `FIFOQueue`. Once a
  worker returns a value, the queue transitions the task to `ready` and passes
  ownership of the buffer to the consumer. The queue does not store the buffer
  in snapshots or lifecycle events.
- If a worker returns a value without a consumer, the task fails explicitly
  with the `missing_consumer` category instead of silently losing the buffer.
- If the consumer throws or returns a Promise, the task fails with the
  `consumer_error` category. The queue continues processing subsequent tasks.
- If a task is cancelled while decoding, the loader discards the late result;
  `onReady` is not called for that task.
- The consumer is responsible for retaining and releasing the buffer after
  playback. Playback-time buffer release remains part of T-04/T-05.

- **Verification:** `node --test tests/*.test.mjs` — 18 tests passed.
- **Status:** The queue-to-consumer handoff is implemented and tested.
  End-to-end buffer release after playback remains unverified until T-04/T-05.
