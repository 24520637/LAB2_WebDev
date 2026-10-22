/** T-05: Bridge serialized load/ready handoff to one sequential playback session.
 * No UI, visualizer or fetch implementation. Call engine.unlock() from a user gesture.
 */
import { FIFOQueue } from './fifo-queue.mjs';

export class PlaybackCoordinator {
  constructor(worker, engine, { onEvent = () => {} } = {}) {
    if (!engine || typeof engine.play !== 'function' || typeof engine.stop !== 'function') {
      throw new TypeError('Expected an audio playback engine');
    }
    this.engine = engine;
    this.buffers = new Map();
    this.ready = [];
    this.current = null;
    this.generation = 0;
    this.disposed = false;
    this.queue = new FIFOQueue(worker, {
      onEvent,
      onReady: (track, buffer) => {
        if (this.disposed || this.queue.snapshot(track.id)?.state !== 'ready') return;
        this.buffers.set(track.id, buffer);
        this.ready.push(track.id);
        this._pump();
      },
    });
    // The engine is borrowed: the coordinator must not dispose or close its context.
    this.previousOnEnded = this.engine.onEnded;
    this.endedHandler = ({ id }) => this._naturalEnd(id);
    this.engine.onEnded = this.endedHandler;
  }

  /** Invoke from a real click/key gesture; ready tracks wait until unlocked. */
  async unlock() {
    if (this.disposed) throw new Error('Playback coordinator disposed');
    await this.engine.unlock();
    if (!this.disposed) this._pump();
  }

  enqueue(track) { return this.queue.enqueue(track); }
  snapshot(id) { return this.queue.snapshot(id); }

  cancel(id) {
    const result = this.queue.cancel(id);
    if (!result.ok) return result;
    this._drop(id);
    if (this.current?.id === id) this._endCurrent('cancelled');
    else this._pump();
    return result;
  }

  skip() {
    if (!this.current || this.queue.snapshot(this.current.id)?.state !== 'playing') {
      return { ok: false, code: 'nothing_playing' };
    }
    const result = this.queue.skip();
    if (result.ok) this._endCurrent('skipped');
    return result;
  }

  _drop(id) {
    this.buffers.delete(id);
    this.ready = this.ready.filter(entry => entry !== id);
  }

  _endCurrent(reason) {
    const session = this.current;
    if (!session || session.ended) return;
    session.ended = true;
    this._drop(session.id);
    // Keep this session reserved while play() is pending (e.g. context.resume()).
    // Otherwise stopping an older play() could stop the next track's source.
    if (session.started) {
      this.engine.stop();
      if (this.current === session) this.current = null;
      queueMicrotask(() => { if (!this.disposed) this._pump(); });
    }
  }

  _naturalEnd(id) {
    const session = this.current;
    if (!session || session.ended || !session.started || session.id !== id ||
        session.generation !== this.generation ||
        this.queue.snapshot(id)?.state !== 'playing') return;
    session.ended = true;
    this.queue.finishPlayback(id, 'completed');
    this._drop(id);
    this.current = null;
    queueMicrotask(() => this._pump());
  }

  _pump() {
    if (this.disposed || this.current || this.engine.unlocked === false) return;
    while (this.ready.length) {
      const id = this.ready.shift();
      const buffer = this.buffers.get(id);
      if (!buffer || this.queue.snapshot(id)?.state !== 'ready') {
        this.buffers.delete(id);
        continue;
      }
      const start = this.queue.beginPlayback(id);
      if (!start.ok) continue;
      const session = { id, generation: ++this.generation, started: false, ended: false };
      this.current = session; // reserved before the asynchronous play call
      void this._start(session, buffer);
      break;
    }
  }

  async _start(session, buffer) {
    try {
      await this.engine.play(session.id, buffer);
      session.started = true;
      if (session.ended || this.disposed || this.current !== session ||
          session.generation !== this.generation ||
          this.queue.snapshot(session.id)?.state !== 'playing') {
        // A late start after disposal must not stop another owner's playback.
        if (!this.disposed || this.engine.current?.id === session.id) this.engine.stop();
        if (this.current === session) this.current = null;
        this._pump();
      }
    } catch (error) {
      if (!session.ended && this.current === session &&
          this.queue.snapshot(session.id)?.state === 'playing') {
        this.queue.finishPlayback(session.id, 'failed', {
          error: { category: 'playback', message: String(error?.message || error) },
        });
      }
      this._drop(session.id);
      if (this.current === session) this.current = null;
      this._pump();
    }
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.queue.dispose();
    if (this.current) {
      const session = this.current;
      session.ended = true;
      if (this.engine.current?.id === session.id) this.engine.stop();
      this.current = null;
    }
    this.buffers.clear();
    this.ready.length = 0;
    // Restore only our handler; never clobber a newer consumer's listener.
    if (this.engine.onEnded === this.endedHandler) this.engine.onEnded = this.previousOnEnded;
    this.previousOnEnded = null;
    this.endedHandler = null;
  }
}
