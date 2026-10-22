/** T-03: fetch/decode adapter. Playback, audio-context creation and caching are out of scope. */
export class AudioLoadError extends Error {
  constructor(category, message, { cause, status } = {}) {
    super(message, { cause });
    this.name = 'AudioLoadError';
    this.category = category;
    if (status !== undefined) this.status = status;
  }
}

const aborted = () => new AudioLoadError('aborted', 'Audio load cancelled');

/**
 * Returns a T-02-compatible worker. The queue owns AbortController and serialization.
 * Cancellation during decode only invalidates the result: decode must settle before
 * the worker promise settles and the queue can claim the next task.
 */
export function createAudioLoadWorker({ audioContext, fetchImpl = globalThis.fetch } = {}) {
  if (!audioContext || typeof audioContext.decodeAudioData !== 'function') {
    throw new TypeError('audioContext.decodeAudioData must be a function');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  return async function audioLoadWorker(track, { signal, transition }) {
    if (!track || typeof track.url !== 'string' || !signal || typeof transition !== 'function') {
      throw new TypeError('Expected track, AbortSignal and transition callback');
    }
    // The signal is specific to one queue claim (task identity/generation).
    // Once aborted, that generation can never produce an accepted buffer.
    let invalid = signal.aborted;
    const invalidate = () => { invalid = true; };
    signal.addEventListener('abort', invalidate, { once: true });
    const ensureCurrent = () => { if (invalid || signal.aborted) throw aborted(); };
    try {
      ensureCurrent();
      let response;
      try {
        response = await fetchImpl(track.url, { signal });
      } catch (cause) {
        if (signal.aborted || cause?.name === 'AbortError') throw aborted();
        throw new AudioLoadError('network', 'Could not fetch audio', { cause });
      }
      ensureCurrent();
      if (!response?.ok) {
        throw new AudioLoadError('http', `Audio request failed (HTTP ${response?.status ?? 'unknown'})`, { status: response?.status });
      }
      let bytes;
      try { bytes = await response.arrayBuffer(); }
      catch (cause) {
        if (signal.aborted || cause?.name === 'AbortError') throw aborted();
        throw new AudioLoadError('network', 'Could not read audio response', { cause });
      }
      ensureCurrent();
      // Only enter decoding after bytes have been read and the claim is still valid.
      if (!transition('decoding')) throw aborted();
      let buffer;
      try { buffer = await audioContext.decodeAudioData(bytes); }
      catch (cause) {
        if (signal.aborted) throw aborted();
        throw new AudioLoadError('decode', 'Audio decoding failed', { cause });
      }
      // decodeAudioData cannot accept AbortSignal. Do not release the queue
      // worker while its promise is pending; discard stale output on settlement.
      ensureCurrent();
      return buffer;
    } finally {
      signal.removeEventListener('abort', invalidate);
    }
  };
}
