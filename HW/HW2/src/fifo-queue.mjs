/** T-02: Serialized loading/decoding scheduler. No network, audio or UI dependencies. */
const TERMINAL = new Set(['completed', 'cancelled', 'skipped', 'failed']);
const ALLOWED = {
  queued: new Set(['fetching', 'cancelled']),
  fetching: new Set(['decoding', 'cancelled', 'failed']),
  decoding: new Set(['ready', 'cancelled', 'failed']),
  ready: new Set(['playing', 'cancelled', 'failed']),
  playing: new Set(['completed', 'cancelled', 'skipped', 'failed']),
};

export class FIFOQueue {
  /**
   * `worker(track, { signal, transition })` performs fetch/decode work.
   * `onReady(track, result)` synchronously takes ownership of non-undefined results.
   */
  constructor(worker, { onEvent = () => {}, onReady } = {}) {
    if (
      typeof worker !== 'function' ||
      typeof onEvent !== 'function' ||
      (onReady !== undefined && typeof onReady !== 'function')
    ) {
      throw new TypeError('Expected worker, onEvent and optional onReady functions');
    }
    this.worker = worker;
    this.onEvent = onEvent;
    this.onReady = onReady;
    this.tasks = new Map();
    this.pending = [];
    this.sequence = 0;
    this.active = null;
    this.draining = false; // synchronous reservation, set BEFORE any async boundary
    this.disposed = false;
  }

  snapshot(id) {
    const task = this.tasks.get(id);
    if (!task) return null;
    return Object.freeze({ id: task.id, url: task.url, state: task.state,
      enqueueSequence: task.enqueueSequence, revision: task.revision });
  }

  _event(task, type, detail = {}) {
    try { this.onEvent(Object.freeze({ type, ...this.snapshot(task.id), ...detail })); }
    catch { /* observers must not poison the queue */ }
  }

  _transition(task, next, detail = {}) {
    if (!ALLOWED[task.state]?.has(next)) return false;
    task.state = next;
    task.revision += 1;
    this._event(task, TERMINAL.has(next) ? 'task:terminal' : 'task:state', detail);
    return true;
  }

  enqueue(track) {
    if (this.disposed) return { ok: false, code: 'disposed' };
    if (!track || typeof track.id !== 'string' || !track.id.trim() ||
        typeof track.url !== 'string' || !track.url.trim()) {
      return { ok: false, code: 'invalid_task' };
    }
    if (this.tasks.has(track.id)) return { ok: false, code: 'duplicate_id' };
    const task = { id: track.id, url: track.url, metadata: track.metadata,
      enqueueSequence: ++this.sequence, revision: 0, state: 'queued', controller: null };
    this.tasks.set(task.id, task);
    this.pending.push(task);
    this._event(task, 'task:accepted');
    this._schedule();
    return { ok: true, task: this.snapshot(task.id) };
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (!task) return { ok: false, code: 'not_found' };
    if (TERMINAL.has(task.state)) return { ok: false, code: 'already_terminal' };
    if (task.state === 'queued') this.pending = this.pending.filter(item => item !== task);
    const changed = this._transition(task, 'cancelled');
    if (!changed) return { ok: false, code: 'invalid_transition' };
    // Retain the active worker reservation until its promise actually settles.
    if (task.controller) task.controller.abort();
    return { ok: true };
  }

  /** T-05 will own skip/playback; never reinterpret it as cancellation here. */
  skip() { return { ok: false, code: 'nothing_playing' }; }

  _schedule() {
    if (this.draining || this.disposed || this.pending.length === 0) return;
    this.draining = true; // atomic before Promise/microtask scheduling
    void this._drain();
  }

  async _drain() {
    try {
      while (!this.disposed && this.pending.length) {
        const task = this.pending.shift();
        if (task.state !== 'queued') continue;
        const controller = new AbortController();
        task.controller = controller;
        this.active = task;
        this._transition(task, 'fetching');
        try {
          const result = await this.worker(
            Object.freeze({ id: task.id, url: task.url, metadata: task.metadata }),
            { signal: controller.signal, transition: state => {
              // A worker may report `decoding`; it may not finalize or play.
              return state === 'decoding' && this._transition(task, state);
            } }
          );
          if (!TERMINAL.has(task.state)) {
            // Worker's decoding stage is optional to report for simple T-02 mocks.
            if (task.state === 'fetching') this._transition(task, 'decoding');
            if (task.state === 'decoding') this._transition(task, 'ready');
            if (result !== undefined) {
              if (!this.onReady) {
                throw Object.assign(
                  new Error('Worker returned a result without an onReady consumer'),
                  { category: 'missing_consumer' }
                );
              }

              const acceptedTrack = Object.freeze({
                id: task.id,
                url: task.url,
                metadata: task.metadata,
              });
              let handoff;
              try {
                handoff = this.onReady(acceptedTrack, result);
              } catch (cause) {
                throw Object.assign(
                  new Error('Ready consumer rejected the worker result', { cause }),
                  { category: 'consumer_error' }
                );
              }
              if (handoff && typeof handoff.then === 'function') {
                void Promise.resolve(handoff).catch(() => {});
                throw Object.assign(
                  new TypeError('onReady must synchronously accept the worker result'),
                  { category: 'consumer_error' }
                );
              }
            }
          }
        } catch (error) {
          if (!TERMINAL.has(task.state)) {
            this._transition(task, 'failed', { error: { category: error?.category || 'worker_error', message: String(error?.message || error) } });
          }
        } finally {
          task.controller = null;
          this.active = null;
        }
      }
    } finally {
      this.draining = false;
      // Guard protects against tasks synchronously added during cleanup.
      if (!this.disposed && this.pending.length) this._schedule();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const task of this.tasks.values()) {
      if (!TERMINAL.has(task.state)) this.cancel(task.id);
    }
    this.pending.length = 0;
  }
}
