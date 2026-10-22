/** T-08: UI-facing state and actions. No DOM, audio ownership, or RAF work. */
const ACTIVE = new Set(['queued', 'fetching', 'decoding', 'ready', 'playing']);
export function validateAudioURL(value) {
  try {
    const url = new URL(String(value).trim());
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export class QueueUIController {
  constructor(coordinator, { onChange = () => {}, onAnnouncement = () => {} } = {}) {
    this.coordinator = coordinator;
    this.onChange = onChange;
    this.onAnnouncement = onAnnouncement;
    this.tasks = new Map();
    this.selected = '';
    this.nextId = 1;
    this.busy = false;
    this.disposed = false;
    this.message = 'No tracks yet. Enter an audio URL to begin.';
  }
  get ordered() { return [...this.tasks.values()].sort((a, b) => a.enqueueSequence - b.enqueueSequence); }
  get cancellable() { return this.ordered.filter(t => ACTIVE.has(t.state)); }
  get playing() { return this.ordered.find(t => t.state === 'playing') || null; }
  _changed(announcement) {
    if (this.disposed) return;
    this.onChange();
    if (announcement) this.onAnnouncement(announcement);
  }
  event(event) {
    if (this.disposed) return;
    const previous = this.tasks.get(event.id);
    const item = { id: event.id, url: event.url, state: event.state,
      enqueueSequence: event.enqueueSequence, error: event.error ?? previous?.error ?? null };
    this.tasks.set(item.id, item);
    if (!this.selected && ACTIVE.has(item.state)) this.selected = item.id;
    if (this.selected && !this.cancellable.some(t => t.id === this.selected)) {
      this.selected = this.cancellable[0]?.id ?? '';
    }
    const important = item.state === 'playing' || ['failed', 'completed', 'cancelled', 'skipped'].includes(item.state);
    const text = item.state === 'failed'
      ? `${item.id} failed: ${item.error?.message || 'Unknown audio error'}`
      : `${item.id}: ${item.state}`;
    if (important) this.message = text;
    this._changed(important ? text : null);
  }
  select(id) {
    if (this.disposed) return;
    if (this.cancellable.some(t => t.id === id)) this.selected = id;
    this._changed();
  }
  async add(rawURL) {
    if (this.disposed) return { ok: false, code: 'disposed' };
    if (this.busy) return { ok: false, code: 'busy' };
    const url = validateAudioURL(rawURL);
    if (!url) {
      this.message = 'Enter a valid http:// or https:// audio URL without credentials.';
      this._changed(this.message);
      return { ok: false, code: 'invalid_url' };
    }
    this.busy = true;
    this.message = 'Preparing audio…';
    this._changed();
    try {
      // Within the originating click gesture, create/resume Web Audio before loading.
      await this.coordinator.unlock();
      if (this.disposed) return { ok: false, code: 'disposed' };
      const result = this.coordinator.enqueue({ id: `track-${this.nextId}`, url });
      if (result.ok) {
        this.nextId++;
        this.message = `${result.task.id} added to queue`;
        this._changed(this.message);
      } else {
        this.message = `Could not add track (${result.code}).`;
        this._changed(this.message);
      }
      return result;
    } catch (error) {
      if (this.disposed) return { ok: false, code: 'disposed' };
      this.message = `Audio unavailable: ${String(error?.message || error)}`;
      this._changed(this.message);
      return { ok: false, code: 'unlock_failed' };
    } finally {
      this.busy = false;
      this._changed();
    }
  }
  async play() {
    if (this.disposed || this.busy) return { ok: false, code: this.disposed ? 'disposed' : 'busy' };
    this.busy = true;
    this._changed();
    try {
      await this.coordinator.unlock();
      if (this.disposed) return { ok: false, code: 'disposed' };
      this.message = this.playing ? `${this.playing.id}: playing` : 'Audio enabled; waiting for a ready track.';
      this._changed(this.message);
      return { ok: true };
    } catch (error) {
      if (this.disposed) return { ok: false, code: 'disposed' };
      this.message = `Cannot enable playback: ${String(error?.message || error)}`;
      this._changed(this.message);
      return { ok: false, code: 'unlock_failed' };
    } finally {
      this.busy = false;
      this._changed();
    }
  }
  skip() {
    if (this.disposed || !this.playing) return { ok: false, code: 'nothing_playing' };
    return this.coordinator.skip();
  }
  cancelSelected() {
    if (this.disposed || !this.cancellable.some(t => t.id === this.selected)) return { ok: false, code: 'nothing_selected' };
    return this.coordinator.cancel(this.selected);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.tasks.clear();
    this.onChange = () => {};
    this.onAnnouncement = () => {};
  }
}
