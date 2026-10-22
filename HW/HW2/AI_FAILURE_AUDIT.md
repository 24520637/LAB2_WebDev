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

## T-07 — Ensure cleanup and bounded ownership

- **Finding:** Cleanup did not consistently respect resource ownership. In
  particular, `PlaybackCoordinator.dispose()` could call `engine.stop()` while
  its `engine.play()` call was still pending. Since the coordinator borrows the
  engine, this could stop playback belonging to another owner. The audit also
  found that the coordinator discarded the engine's previous `onEnded`
  callback, a late `_start()` completion could stop another owner's source,
  and the visualizer retained canvas/context references after disposal.

- **Original prompt that led to the issue:**
  > Implement only T-07 from TASK DECOMPOSITION.md.
  >
  > Audit and implement resource ownership and cleanup across the queue, loader, playback engine, and visualizer.
  >
  > On completion, skip, cancellation, or UI unmount where applicable:
  > - Abort fetches owned by the task.
  > - Invalidate pending decode results.
  > - Stop active source nodes safely and disconnect owned audio nodes.
  > - Remove event listeners and cancel outstanding animation frames.
  > - Clear references to finished/cancelled task buffers when no longer needed.
  > - Prevent callbacks after unmount from updating UI or starting playback.
  > - Make cleanup idempotent.
  >
  > IMPORTANT: Do not close a shared AudioContext merely because one track ends or a visualizer unmounts. Define who owns the context and close it only when its owning engine is permanently disposed and no consumer still needs it.
  >
  > Add lifecycle tests for cleanup during queued, fetching, decoding, playing, and unmounted states. If tests reveal retained resources or unsafe cleanup, document the actual defect and fix in AI_FAILURE_AUDIT.md. Stop after T-07.

### How the issue was detected

- Traced the playback lifecycle from `_pump()` in
  `src/playback-coordinator.mjs`: it reserves `this.current` before
  `_start()` awaits `engine.play()`. Then traced `dispose()`, which previously
  stopped the borrowed engine based on that logical reservation without
  verifying that the engine's active source belonged to this coordinator.
- Added a deferred-play regression test that assigns a different active
  session to the shared engine before disposal. The test checks that neither
  disposal nor the pending `play()` settling stops that other session.
- Reviewed cleanup behavior for the ended handler, queued/fetching/decoding
  tasks, ready buffers, audio sources, visualizer RAF, visibility listener,
  and retained visualizer references.

### Fix

- `PlaybackCoordinator.dispose()` now stops playback only when
  `engine.current?.id` matches the coordinator's session ID. Late `_start()`
  completion uses the same ownership guard after disposal.
- The coordinator saves and conditionally restores the prior `engine.onEnded`
  handler, and ignores late callbacks after disposal.
- `CanvasAudioVisualizer.dispose()` cancels its RAF, removes its visibility
  listener, and clears references to the canvas, rendering context, document,
  and callback.
- `AudioPlaybackEngine.dispose()` shares one in-flight disposal Promise,
  disconnects owned nodes, and closes only an AudioContext created by that
  engine. The coordinator does not dispose the borrowed engine.
- **Prompt to fix the issue:** `Fix the T-07 shared-engine ownership bug in PlaybackCoordinator.dispose(). The coordinator reserves this.current before awaiting engine.play(), so dispose must not call engine.stop() merely because a logical session exists. Stop only if engine.current?.id matches the session ID owned by this coordinator. Keep disposal idempotent, preserve other owners' playback, and add a deferred-play regression test where another owner is active when dispose runs and when the pending play settles. Run the focused cleanup test and the full HW2 test suite.`

- **Ownership contract:** The queue owns per-task fetch AbortControllers and
  serialization through decode settlement; the loader unregisters its abort
  listener. The coordinator owns its queue and retained ready buffers, not the
  passed-in engine. The engine owns source/analyser nodes and closes an
  AudioContext only if it created it. The visualizer owns its RAF and
  visibility listener, not the AudioContext.

- **Verification:** `node --test tests/*.test.mjs` — 49 tests passed,
  including 7 cleanup tests. `node --check` and `git diff --check` passed.
  Browser heap measurement was not performed; lifecycle/unmount behavior is
  covered with test doubles because there is no application UI yet.
- **Status:** The shared-engine stop bug has a regression test and is fixed.
  The original T-07 implementation prompt is recorded above.
