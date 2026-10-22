# HW 2 — Concurrent FIFO Audio Visualizer Queue Engine

## Goal and boundaries

Build an ordered audio loading/decoding queue with controlled concurrency, Web Audio playback, an `AnalyserNode`-driven visualizer, safe cancellation and teardown, and accessible controls. **FIFO means task processing starts in enqueue order**; for the simplest deterministic design, use **one active load/decode task at a time** (`maxConcurrency = 1`). A separate playback controller must define whether a track can play while the next track is being prepared; default to **one playing track, sequential playback**. Never use `AudioBufferSourceNode` twice: create a fresh source for every playback.

**Proposed responsibilities (not confirmed file names):** queue/controller; fetch-and-decode service; playback/audio graph; Canvas visualizer; UI/component adapter; tests. Keep framework-specific code at the UI boundary. Reuse existing architecture and conventions if discovered. Proposed public states: `queued → fetching → decoding → ready → playing → completed`; terminal alternatives: `cancelled`, `skipped`, `failed`. `ready` may be transient if playback begins immediately. Track each task by stable ID and own cancellation token; define `skip` as stopping the current track and advancing, and `cancel(id)` as removing a queued task or aborting the matching active task.

## Ordered work breakdown

**T-00 — Inspect repository and record conventions**
- **Objective:** Ground the implementation plan in the real codebase.
- **Scope:** Inspect framework, project tree, package manifest/lockfile, entry points, audio code, lint/build/test scripts and existing tests. Confirm browser-only boundaries.
- **Dependencies:** None.
- **Files likely affected:** This document only (update verified paths/commands).
- **Acceptance:** Paths, scripts, conventions and reusable components are recorded; proposed additions explicitly identified; no application changes.
- **Verify:** Read repository tree, manifest and existing scripts; `git status --short` where Git is available. Do not assume `npm test` exists.

**T-01 — Define queue contract and state transitions**
- **Status:** Contract documented in **proposed new** `QUEUE_CONTRACT.md`; no runtime implementation or tests added.
- **Objective:** Make FIFO order, unique task identity, resource ownership, and lifecycle behavior unambiguous.
- **Scope:** Accepted IDs remain reserved for a queue instance lifetime; duplicate IDs reject without a second task; different IDs may share URLs. States: `queued`, `fetching`, `decoding`, `ready`, `playing`; terminal: `completed`, `cancelled`, `skipped`, `failed`. See complete transition table, events, cleanup ownership, and 15 contract verification scenarios in `QUEUE_CONTRACT.md`.
- **Dependencies:** T-00; only two documentation files were present in supplied archive, so existing framework, source and test conventions remain unverified.
- **Files affected:** `TASK_DECOMPOSITION.md` (this T-01 entry), **new design document** `QUEUE_CONTRACT.md` (proposed addition). No application files/types/tests altered.
- **Acceptance:** At most one fetch/decode worker, including while cancelled decode is still settling; at most one playing track; accepted tasks claimed FIFO; exactly one terminal outcome per finalized task; cancel(id) produces `cancelled` in any nonterminal phase, while skip() only targets a playing task and produces `skipped`; errors terminate only their matching tasks and do not stall the rest; late callbacks are ignored.
- **Verification:** Contract scenarios C01–C15 specify expected duplicate-ID, FIFO, cancellation, skip, failure, race and disposal behavior. Not runnable against application code because no implementation/test setup was supplied. Tests deferred to T-02+.

**T-02 — Implement serialized FIFO controller**
- **Objective:** Enqueue and drain tasks in order without race conditions.
- **Scope:** Queue storage, worker loop, stable IDs, single-flight drain guard, dispatch of lifecycle events, automatic continuation after success/failure/cancellation.
- **Dependencies:** T-01.
- **Files likely affected:** **Proposed** queue module, queue unit tests; adapt to existing paths.
- **Acceptance:** A/B/C are started in order; synchronous repeated enqueue/drain calls never create two workers; queue recovers after rejection; no task is processed twice.
- **Verify:** **Proposed tests:** deferred promises, simultaneous enqueues, worker-count assertions, failure then success.

**T-03 — Add cancellable fetch and decode**
- **Status:** Loader and queue-to-consumer buffer handoff implemented and covered by unit/integration tests.
- **Objective:** Return an `AudioBuffer` for each successfully loaded task.
- **Scope:** `fetch(url, { signal })`, HTTP `ok` check, `arrayBuffer()`, `AudioContext.decodeAudioData()`; distinguish fetch, HTTP, abort and decode errors. Since decode cannot reliably be aborted, use generation/token validity checks and discard late results after cancellation.
- **Dependencies:** T-02.
- **Files affected:** `src/audio-loader.mjs`, `src/fifo-queue.mjs`, `tests/audio-loader.test.mjs`, `tests/fifo-queue.test.mjs`.
- **Acceptance:** Valid audio resolves to `AudioBuffer`; fetch abort cancels promptly; failed HTTP/decode marks only its task failed; late decode never starts cancelled playback; buffers are released when no longer needed.
- **Verify:** `node --test tests/*.test.mjs` from `HW/HW2`; tests cover mocked fetch response, abort, HTTP 404, network rejection, decode failure, late decode completion, serialized worker behavior, and decoded-buffer handoff. Playback-time release remains covered by T-04/T-05.

**T-04 — Build Web Audio playback graph**
- **Status:** `src/audio-engine.mjs` and mocked engine tests exist. A browser
  smoke-test page is available at `t04-audio-smoke.html`; it generates and
  decodes a short 440 Hz WAV fixture in memory and plays it through the real
  Web Audio graph after a user gesture. Browser smoke verification on
  2026-10-22 confirmed the context entered `running`, FFT was 256 with 128
  bins, the analyser returned non-zero energy within one bin of 440 Hz,
  natural `onended` updated the UI, and Stop reset the UI. Listening remains
  a manual check because the automated browser output cannot be physically
  heard or verified here.
- **Objective:** Play decoded buffers and provide frequency samples.
- **Scope:** Create/reuse an `AudioContext` after permitted user interaction; connect `AudioBufferSourceNode → AnalyserNode → destination`; set `fftSize` to **256 or 512** (choose 256 initially), create `Uint8Array(analyser.frequencyBinCount)`, call `getByteFrequencyData()`. Handle suspended context and autoplay rules.
- **Dependencies:** T-03.
- **Files likely affected:** **Proposed** audio engine, engine tests.
- **Acceptance:** A fresh source is created per play; audible output is routed correctly; array length matches `frequencyBinCount`; `ended` fires once logically; playback failure does not strand queue.
- **Verify:** `node --test tests/audio-engine.test.mjs` for mocked graph tests.
  For a real-browser check, run `npm run dev:hw2-smoke` from the repository
  root and open
  `t04-audio-smoke.html`; activate “Unlock audio and play test tone”, verify
  the context is running, confirm the live analyser peak is non-zero within
  one 256-point FFT bin of 440 Hz, listen for the tone, and verify natural
  completion or Stop returns the UI to idle. The generated fixture is
  synthesized locally in memory; no audio file or external asset is required.

**T-05 — Handle completion, skip and cancellation**
- **Objective:** Make rapid controls deterministic and safe.
- **Scope:** Support cancel queued (remove, never fetch); cancel fetching (abort); cancel decoding (invalidate late result); skip playing (stop and disconnect source, advance once); guard `onended`/`stop()` double completion with one-shot finalization and session IDs. Define sequential autoplay after unlock.
- **Dependencies:** T-02–T-04.
- **Files likely affected:** **Proposed** queue and playback controllers, interaction tests.
- **Acceptance:** Cancelled items never play; skip advances exactly once; rapid skip/play/cancel causes no stale playback or out-of-order transition; abort and playback stop are idempotent.
- **Verify:** **Proposed tests:** cancel queued vs active in each phase, repeated skip, skip at natural end, cancel immediately after enqueue, stale callbacks.

**T-06 — Render 60-FPS-target visualizer**
- **Objective:** Draw frequency bars without frame-by-frame component re-rendering.
- **Scope:** Canvas preferred (or existing SVG approach); drive via `requestAnimationFrame`, call `getByteFrequencyData()` each frame, keep mutable audio data/context in refs or instance fields, scale for device pixel ratio, handle resize, stop when idle/hidden/unmounted. Treat 60 FPS as a performance target, not a guaranteed measured result.
- **Dependencies:** T-04.
- **Files likely affected:** Existing UI component if present; otherwise **proposed** visualizer component/module and tests.
- **Acceptance:** Animation tracks audible signal; one active animation loop; no per-frame React state updates if using React; stopped/empty state is stable; resize remains sharp.
- **Verify:** **Proposed tests:** mocked RAF start/cancel, frame sampling and resize; **manual:** browser performance recording at target display refresh rate.

**T-07 — Ensure cleanup and bounded ownership**
- **Objective:** Avoid leaked fetches, audio nodes, listeners, frames and retained buffers.
- **Scope:** On track finish/skip/cancel and UI unmount: abort owned fetch, invalidate pending decode, stop source if active (catch already-stopped), disconnect nodes, cancel RAF, unregister listeners, clear task/buffer references. Define who owns shared `AudioContext` so shared contexts are not accidentally closed.
- **Dependencies:** T-05–T-06.
- **Files likely affected:** **Proposed** audio engine, queue, visualizer and UI adapter; lifecycle tests.
- **Acceptance:** Cleanup is idempotent; no post-unmount callbacks update UI or play audio; no live source or RAF remains; inactive tasks do not retain buffers; no double-disconnect side effects.
- **Verify:** **Proposed tests:** unmount while queued/fetching/decoding/playing, repeated cleanup, spies on abort/stop/disconnect/cancelAnimationFrame; manually inspect browser heap and event listeners.

**T-08 — Add usable controls, status and error feedback**
- **Objective:** Expose predictable accessible queue interactions.
- **Scope:** Track enqueue/play/skip/cancel controls, disabled states, ordered queue display, loading/decoding/playing/error messages; semantic `<button>` elements, keyboard activation and visible focus; label visualizer and provide text status instead of relying on bars alone; non-disruptive `aria-live` updates.
- **Dependencies:** T-05–T-07.
- **Files likely affected:** Existing UI files if found; otherwise **proposed** UI component/style and UI tests.
- **Acceptance:** Full keyboard flow, meaningful status without audio/graphics, no duplicate actions during rapid clicks, useful error message and recovery path.
- **Verify:** **Proposed tests:** UI events, disabled/aria states, keyboard actions; **manual:** keyboard-only and screen-reader smoke test.

**T-09 — Integrate and test full lifecycle**
- **Objective:** Verify the complete enqueue → fetch → decode → play → visualize → finish chain.
- **Scope:** Wire modules into framework entry point; test successful sequences and failures; use short, permitted test fixtures; check repeat navigation/unmount and browser visibility changes.
- **Dependencies:** T-01–T-08.
- **Files likely affected:** Existing entry/component paths, **proposed** integration/e2e tests and fixture files (only if needed).
- **Acceptance:** A/B/C play in order; recover from fetch/decode failure; duplicate enqueue policy holds; queued vs active cancellation differs correctly; rapid skip/play safe; unmount stops owned work; no unhandled rejection or persistent animation.
- **Verify:** **Proposed integration scenarios:** success, network error, HTTP error, corrupt audio, delayed decode, repeated enqueue, 20 rapid control actions, unmount at each state. Run only **actual repository** test/build/lint scripts discovered in T-00; record commands and results.

## Testing strategy and evidence

Use deterministic unit tests with deferred promises for ordering/races and fakes for Web Audio, fetch, RAF and `AbortController`; supplement with real-browser smoke tests because autoplay policy, decoding, sound output and frame pacing cannot be fully verified with mocks. Log task ID/state transitions (without retaining large binary payloads). Before completion, record actual commands, pass/fail results, browser/version, short performance trace, and any unverified claims. No test runner or CLI command beyond repository inspection is assumed.

## Risks and decisions to review

| Risk | Mitigation / decision |
|---|---|
| Browser autoplay blocks AudioContext | Require user gesture; `resume()` before play; show unlock UI |
| `decodeAudioData()` not cancellable | Mark task stale; ignore/release decoded result; do not start next decode until chosen serialization contract permits |
| Cancel/skip races with `onended` | Single terminal transition per task, generation guard and idempotent finalizer |
| Fetch CORS, large or malicious files | Show clear error; consider size/time limits subject to repository requirements |
| Long audio / buffer memory | Release `AudioBuffer` references and avoid unbounded prefetch/cache |
| 60 FPS variability | Draw only when active, avoid UI state on frames; measure actual FPS rather than promise 60 |
| Unknown framework and scripts | T-00 blocks path-specific work; no invented repository claims |

## Suggested Git commit checkpoints (not executed)

1. After T-00/T-01: `docs: define fifo audio engine contracts`
2. After T-02/T-03: `feat: add serialized audio load queue`
3. After T-04/T-05: `feat: add playback and cancellation lifecycle`
4. After T-06/T-07: `feat: add visualizer and resource cleanup`
5. After T-08/T-09: `test: verify audio queue integration and accessibility`
