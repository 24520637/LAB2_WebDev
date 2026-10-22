/** T-06 Canvas frequency visualizer; no queue or playback ownership.
 * Call start() when playback begins; stop() when playback ends or on unmount.
 * Uses AudioPlaybackEngine.sampleFrequencyData(), whose analyser reuses its Uint8Array.
 */
export class CanvasAudioVisualizer {
  constructor(canvas, engine, {
    requestFrame = callback => globalThis.requestAnimationFrame(callback),
    cancelFrame = id => globalThis.cancelAnimationFrame(id),
    documentRef = globalThis.document,
    devicePixelRatio = () => globalThis.devicePixelRatio || 1,
  } = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('Expected a canvas');
    if (!engine || typeof engine.sampleFrequencyData !== 'function') throw new TypeError('Expected audio engine');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D context unavailable');
    this.engine = engine;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.documentRef = documentRef;
    this.getDpr = devicePixelRatio;
    this.running = false;
    this.disposed = false;
    this.frameId = null;
    this.generation = 0;
    this._visibilityChanged = () => {
      if (this.documentRef?.hidden) this.stop();
      // Explicit start() required when playback is resumed while visible.
    };
    this.documentRef?.addEventListener?.('visibilitychange', this._visibilityChanged);
    this.resize();
  }

  resize() {
    if (this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width || this.canvas.clientWidth || 1);
    const height = Math.max(1, bounds.height || this.canvas.clientHeight || 1);
    const dpr = Math.max(1, this.getDpr());
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;
    if (!this.running) this._clear();
  }

  _clear() { this.ctx.clearRect(0, 0, this.width, this.height); }

  _draw(data) {
    this._clear();
    if (!data?.length) return;
    const step = this.width / data.length;
    this.ctx.fillStyle = '#397fba';
    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * this.height;
      this.ctx.fillRect(i * step, this.height - barHeight, Math.max(0.5, step - 1), barHeight);
    }
  }

  start() {
    if (this.disposed) throw new Error('Visualizer disposed');
    if (this.running || this.documentRef?.hidden || !this.engine.current) return false;
    this.running = true;
    const token = ++this.generation;
    const tick = () => {
      this.frameId = null;
      if (!this.running || this.disposed || token !== this.generation) return;
      if (this.documentRef?.hidden || !this.engine.current) { this.stop(); return; }
      this._draw(this.engine.sampleFrequencyData());
      if (this.running && token === this.generation && this.engine.current && !this.documentRef?.hidden) {
        this.frameId = this.requestFrame(tick);
      } else this.stop();
    };
    this.frameId = this.requestFrame(tick);
    return true;
  }

  stop() {
    const wasRunning = this.running;
    this.running = false;
    ++this.generation;
    if (this.frameId !== null) {
      this.cancelFrame(this.frameId);
      this.frameId = null;
    }
    this._clear();
    return wasRunning;
  }

  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.documentRef?.removeEventListener?.('visibilitychange', this._visibilityChanged);
    this.engine = null;
    this.canvas = null;
    this.ctx = null;
    this.documentRef = null;
    this._visibilityChanged = null;
  }
}
