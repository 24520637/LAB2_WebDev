import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioPlaybackEngine } from '../src/audio-engine.mjs';
import { createAudioLoadWorker } from '../src/audio-loader.mjs';
import { CanvasAudioVisualizer } from '../src/canvas-visualizer.mjs';
import { PlaybackCoordinator } from '../src/playback-coordinator.mjs';
import { QueueUIController } from '../src/queue-ui-controller.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await tick();
  }
  assert.fail(message);
}

function deferred() {
  let resolve;
  const promise = new Promise(res => { resolve = res; });
  return { promise, resolve };
}

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.destination = {};
    this.sources = [];
    this.analyser = {
      fftSize: 0,
      get frequencyBinCount() { return this.fftSize / 2; },
      connect() {},
      disconnect() {},
      getByteFrequencyData(data) { data.fill(80); },
    };
  }

  createAnalyser() { return this.analyser; }

  async decodeAudioData(bytes) {
    const url = new TextDecoder().decode(bytes);
    if (url.endsWith('/invalid.wav')) throw new Error('Corrupt audio');
    return { url };
  }

  createBufferSource() {
    const source = {
      buffer: null,
      onended: null,
      starts: 0,
      stops: 0,
      connect() {},
      disconnect() {},
      start() { this.starts += 1; },
      stop() { this.stops += 1; this.onended?.(); },
      end() { this.onended?.(); },
    };
    this.sources.push(source);
    return source;
  }
}

function createPipeline({ fetchImpl } = {}) {
  const audioContext = new FakeAudioContext();
  let visualizer;

  class BrowserAudioEngine extends AudioPlaybackEngine {
    async play(...args) {
      const result = await super.play(...args);
      visualizer?.start();
      return result;
    }
  }

  const engine = new BrowserAudioEngine({ audioContext });
  const frames = new Map();
  const cancelledFrames = [];
  const listeners = new Map();
  let nextFrame = 0;
  const contextCalls = { clear: 0, bars: 0 };
  const canvasContext = {
    setTransform() {},
    clearRect() { contextCalls.clear += 1; },
    fillRect() { contextCalls.bars += 1; },
  };
  const canvas = {
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ width: 240, height: 120 }),
    getContext: () => canvasContext,
  };
  const documentRef = {
    hidden: false,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  visualizer = new CanvasAudioVisualizer(canvas, engine, {
    requestFrame: callback => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelFrame: id => {
      cancelledFrames.push(id);
      frames.delete(id);
    },
    documentRef,
    devicePixelRatio: () => 2,
  });

  const requested = [];
  let ui;
  const coordinator = new PlaybackCoordinator(
    (track, controls) => createAudioLoadWorker({
      audioContext: engine.context,
      fetchImpl: async (url, options) => {
        requested.push({ url, signal: options.signal });
        return fetchImpl
          ? fetchImpl(url, options)
          : {
              ok: true,
              status: 200,
              arrayBuffer: async () => new TextEncoder().encode(url).buffer,
            };
      },
    })(track, controls),
    engine,
    { onEvent: event => ui?.event(event) },
  );
  ui = new QueueUIController(coordinator, {
    onChange: () => {
      if (engine.current) visualizer.start();
      else visualizer.stop();
    },
  });

  return {
    audioContext,
    canvas,
    cancelledFrames,
    contextCalls,
    coordinator,
    documentRef,
    engine,
    frames,
    listeners,
    requested,
    ui,
    visualizer,
  };
}

async function addTrack(ui, url) {
  const result = await ui.add(url);
  assert.equal(result.ok, true);
  return result.task.id;
}

test('integrates FIFO loading, decoding, sequential playback, UI state and visualizer', async () => {
  const pipeline = createPipeline();
  const { audioContext, coordinator, contextCalls, engine, frames, ui, visualizer } = pipeline;
  const firstId = await addTrack(ui, 'https://audio.example/first.wav');
  const secondId = await addTrack(ui, 'https://audio.example/second.wav');

  await waitFor(() => ui.playing?.id === firstId, 'first track did not start');
  assert.equal(audioContext.sources.length, 1);
  assert.equal(audioContext.sources[0].buffer.url, 'https://audio.example/first.wav');
  assert.equal(visualizer.running, true);
  assert.equal(frames.size, 1);

  const [frameId, frame] = frames.entries().next().value;
  frames.delete(frameId);
  frame();
  assert.equal(contextCalls.bars, audioContext.analyser.frequencyBinCount);
  assert.equal(frames.size, 1);

  audioContext.sources[0].end();
  await waitFor(() => ui.playing?.id === secondId, 'second track did not start after first ended');
  assert.equal(ui.tasks.get(firstId).state, 'completed');
  assert.equal(coordinator.buffers.has(firstId), false);
  assert.equal(audioContext.sources.length, 2);
  assert.notEqual(audioContext.sources[0], audioContext.sources[1]);

  audioContext.sources[1].end();
  await waitFor(() => ui.tasks.get(secondId).state === 'completed', 'second track did not complete');
  assert.equal(coordinator.buffers.size, 0);
  assert.equal(visualizer.running, false);
  assert.equal(frames.size, 0);

  ui.dispose();
  visualizer.dispose();
  await coordinator.dispose();
  await engine.dispose();
});

test('integrates queued and active-fetch cancellation, rejects late work, then recovers', async () => {
  const heldFetch = deferred();
  const pipeline = createPipeline({
    fetchImpl: async (url, { signal }) => {
      if (url.endsWith('/held.wav')) return heldFetch.promise;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode(url).buffer,
      };
    },
  });
  const { coordinator, requested, ui, audioContext } = pipeline;
  const activeId = await addTrack(ui, 'https://audio.example/held.wav');
  await waitFor(() => requested.length === 1, 'active fetch did not start');
  const queuedId = await addTrack(ui, 'https://audio.example/queued.wav');
  ui.select(queuedId);
  assert.equal(ui.cancelSelected().ok, true);
  assert.equal(ui.tasks.get(queuedId).state, 'cancelled');
  assert.deepEqual(requested.map(item => item.url), ['https://audio.example/held.wav']);

  const activeSignal = requested[0].signal;
  ui.select(activeId);
  assert.equal(ui.cancelSelected().ok, true);
  assert.equal(activeSignal.aborted, true);

  const nextId = await addTrack(ui, 'https://audio.example/next.wav');
  heldFetch.resolve({
    ok: true,
    status: 200,
    arrayBuffer: async () => new TextEncoder().encode('https://audio.example/held.wav').buffer,
  });
  await waitFor(() => ui.playing?.id === nextId, 'queue did not recover after active cancellation');

  assert.deepEqual(requested.map(item => item.url), [
    'https://audio.example/held.wav',
    'https://audio.example/next.wav',
  ]);
  assert.equal(ui.tasks.get(activeId).state, 'cancelled');
  assert.equal(coordinator.buffers.has(activeId), false);
  assert.equal(audioContext.sources.length, 1);
  audioContext.sources[0].end();
  await waitFor(() => ui.tasks.get(nextId).state === 'completed', 'recovery track did not complete');

  ui.dispose();
  pipeline.visualizer.dispose();
  await coordinator.dispose();
  await pipeline.engine.dispose();
});

test('integrates decode failure feedback and continues to the following track', async () => {
  const pipeline = createPipeline();
  const { audioContext, coordinator, ui } = pipeline;
  const failedId = await addTrack(ui, 'https://audio.example/invalid.wav');
  const nextId = await addTrack(ui, 'https://audio.example/recovery.wav');

  await waitFor(() => ui.playing?.id === nextId, 'queue did not continue after decode failure');
  assert.equal(ui.tasks.get(failedId).state, 'failed');
  assert.equal(ui.tasks.get(failedId).error.category, 'decode');
  assert.match(ui.message, new RegExp(nextId));
  assert.equal(coordinator.buffers.has(failedId), false);

  audioContext.sources[0].end();
  await waitFor(() => ui.tasks.get(nextId).state === 'completed', 'recovery track did not complete');
  ui.dispose();
  pipeline.visualizer.dispose();
  await coordinator.dispose();
  await pipeline.engine.dispose();
});
