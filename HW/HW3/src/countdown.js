/**
 * Wall-clock countdown with one requestAnimationFrame loop for display updates.
 * Callbacks receive { remainingMs, display, targetTime }; zero duration completes
 * synchronously after one final update. stop() cancels without completing.
 */
export class CountdownClock {
  constructor({
    now = () => Date.now(),
    requestFrame = callback => globalThis.requestAnimationFrame(callback),
    cancelFrame = id => globalThis.cancelAnimationFrame(id),
    documentRef = globalThis.document,
  } = {}) {
    if (typeof now !== 'function' ||
        typeof requestFrame !== 'function' ||
        typeof cancelFrame !== 'function') {
      throw new TypeError('now, requestFrame and cancelFrame must be functions');
    }

    this.now = now;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.documentRef = documentRef;
    this.session = null;
    this.frame = null;
    this.disposed = false;
    this.visibilityHandler = () => this._refreshOnVisibilityChange();
    this.documentRef?.addEventListener?.('visibilitychange', this.visibilityHandler);
  }

  get running() {
    return this.session !== null && !this.disposed;
  }

  /** Start or replace a countdown. The returned target is fixed for this run. */
  start(durationMs, { onUpdate = () => {}, onComplete = () => {} } = {}) {
    if (this.disposed) throw new Error('CountdownClock is disposed');
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError('durationMs must be a finite non-negative number');
    }
    if (typeof onUpdate !== 'function' || typeof onComplete !== 'function') {
      throw new TypeError('onUpdate and onComplete must be functions');
    }

    this.stop();
    const startedAt = this.now();
    const targetTime = startedAt + durationMs;
    if (!Number.isFinite(targetTime)) throw new RangeError('Countdown target time must be finite');

    const session = Object.freeze({
      targetTime,
      onUpdate,
      onComplete,
    });
    this.session = session;
    this._update(session, durationMs === 0 ? 0 : undefined);
    return targetTime;
  }

  /** Stop the current countdown without invoking its completion callback. */
  stop() {
    const wasRunning = this.running;
    this.session = null;
    this._cancelPendingFrame();
    return wasRunning;
  }

  /** Stop the countdown and remove the visibility listener; safe to repeat. */
  dispose() {
    if (this.disposed) return false;
    this.stop();
    this.disposed = true;
    this.documentRef?.removeEventListener?.('visibilitychange', this.visibilityHandler);
    this.documentRef = null;
    this.visibilityHandler = null;
    return true;
  }

  _refreshOnVisibilityChange() {
    const session = this.session;
    if (!session || this.disposed) return;
    this._cancelPendingFrame();
    this._update(session);
  }

  _update(session, initialRemainingMs) {
    if (this.session !== session || this.disposed) return;

    let update;
    try {
      const remainingMs = initialRemainingMs ?? Math.max(0, session.targetTime - this.now());
      update = Object.freeze({
        remainingMs,
        display: formatRemainingTime(remainingMs),
        targetTime: session.targetTime,
      });
    } catch (error) {
      if (this.session === session) this.stop();
      throw error;
    }

    try {
      session.onUpdate(update);
    } catch (error) {
      if (this.session === session) this.stop();
      throw error;
    }

    if (this.session !== session || this.disposed) return;
    if (update.remainingMs === 0) {
      this.session = null;
      this._cancelPendingFrame();
      session.onComplete(update);
      return;
    }

    this._scheduleFrame(session);
  }

  _scheduleFrame(session) {
    if (this.frame || this.session !== session || this.disposed) return;

    const frame = { id: null };
    this.frame = frame;
    try {
      const id = this.requestFrame(() => {
        if (this.frame !== frame) return;
        this.frame = null;
        this._update(session);
      });
      if (this.frame === frame) frame.id = id;
    } catch (error) {
      if (this.frame === frame) this.frame = null;
      if (this.session === session) this.stop();
      throw error;
    }
  }

  _cancelPendingFrame() {
    const frame = this.frame;
    this.frame = null;
    if (frame && frame.id !== null) this.cancelFrame(frame.id);
  }
}

/** Format as HH:MM:SS, rounding positive milliseconds up to the next second. */
export function formatRemainingTime(remainingMs) {
  if (typeof remainingMs !== 'number' || !Number.isFinite(remainingMs) || remainingMs < 0) {
    throw new RangeError('remainingMs must be a finite non-negative number');
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}
