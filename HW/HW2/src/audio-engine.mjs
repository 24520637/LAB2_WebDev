/** T-04: Web Audio playback + analyser. Queue lifecycle transitions belong to T-05. */
export class AudioPlaybackEngine {
  constructor({ audioContext, contextFactory, onEnded = () => {} } = {}) {
    if (audioContext && contextFactory) throw new TypeError('Provide an audioContext or contextFactory');
    if (audioContext && typeof audioContext.createBufferSource !== 'function') throw new TypeError('Invalid AudioContext');
    if (contextFactory !== undefined && typeof contextFactory !== 'function') throw new TypeError('Invalid contextFactory');
    if (typeof onEnded !== 'function') throw new TypeError('onEnded must be a function');
    this.context = audioContext ?? null;
    this.contextFactory = contextFactory ?? (() => new globalThis.AudioContext());
    this.ownsContext = !audioContext;
    this.onEnded = onEnded;
    this.analyser = null;
    this.frequencyData = null;
    this.current = null;
    this.unlocked = false;
    this.disposed = false;
  }

  /** Call directly from a click/key user gesture; do not call automatically on page load. */
  async unlock() {
    if (this.disposed) throw new Error('Playback engine disposed');
    if (!this.context) this.context = this.contextFactory();
    if (this.context.state === 'closed') throw new Error('AudioContext is closed');
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.disposed || this.context.state !== 'running') throw new Error('AudioContext is not running');
    if (!this.analyser) {
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(this.context.destination);
      this.analyser = analyser;
      this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
    }
    this.unlocked = true;
    return this.context;
  }

  /** Requires previous unlock(); a playback owner provides only ready, decoded buffers. */
  async play(id, buffer) {
    if (this.disposed) throw new Error('Playback engine disposed');
    if (!this.unlocked || !this.context || !this.analyser) throw new Error('Call unlock() from a user gesture first');
    if (this.current) throw new Error('A track is already playing');
    if (typeof id !== 'string' || !id.trim() || !buffer) throw new TypeError('Expected task ID and AudioBuffer');
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.disposed || this.context.state !== 'running') throw new Error('AudioContext is not running');
    // Recheck after awaiting resume: two simultaneous play calls must not overlap.
    if (this.current) throw new Error('A track is already playing');
    const source = this.context.createBufferSource();
    const session = { id, source, finished: false };
    try {
      source.buffer = buffer;
      source.connect(this.analyser);
      source.onended = () => this._finish(session, 'ended');
      // Reserve synchronously before start() invokes any user code.
      this.current = session;
      source.start(0);
      return { id };
    } catch (error) {
      this._finish(session, 'start_failed');
      throw error;
    }
  }

  _finish(session, reason) {
    if (session.finished) return;
    session.finished = true;
    session.source.onended = null;
    try { session.source.disconnect(); } catch { /* already disconnected */ }
    session.source.buffer = null;
    if (this.current === session) this.current = null;
    if (reason === 'ended') {
      try { this.onEnded({ id: session.id }); } catch { /* consumer cannot poison engine */ }
    }
  }

  /** Stops audio only. T-05 decides whether queue outcome is skipped or cancelled. */
  stop() {
    const session = this.current;
    if (!session || session.finished) return false;
    this._finish(session, 'stopped');
    try { session.source.stop(0); } catch { /* source may have already ended */ }
    return true;
  }

  /** Samples into a reused typed array; caller must copy if retaining a snapshot. */
  sampleFrequencyData() {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { /* already disconnected */ }
      this.analyser = null;
    }
    this.frequencyData = null;
    this.unlocked = false;
    if (this.ownsContext && this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
  }
}
