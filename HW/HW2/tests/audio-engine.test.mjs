import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioPlaybackEngine } from '../src/audio-engine.mjs';

function fakeContext({ state = 'running', failStart = false, failResume = false } = {}) {
  const sources = [];
  const analyser = { fftSize: 0, connections: [], disconnected: false,
    get frequencyBinCount() { return this.fftSize / 2; },
    connect(node) { this.connections.push(node); },
    disconnect() { this.disconnected = true; },
    getByteFrequencyData(data) { data.fill(73); } };
  const context = { state, destination: {}, sources, analyser, resumeCalls: 0, closeCalls: 0,
    async resume() { this.resumeCalls++; if (failResume) throw new Error('resume denied'); this.state = 'running'; },
    async close() { this.closeCalls++; this.state = 'closed'; },
    createAnalyser() { return analyser; },
    createBufferSource() {
      const source = { buffer: null, onended: null, connections: [], disconnected: false, starts: 0, stops: 0,
        connect(node) { this.connections.push(node); },
        disconnect() { this.disconnected = true; },
        start() { this.starts++; if (failStart) throw new Error('start failed'); },
        stop() { this.stops++; this.onended?.(); },
        end() { this.onended?.(); } };
      sources.push(source);
      return source;
    } };
  return context;
}

test('unlock initializes graph once with 256 fft and 128 bins', async () => {
  const ctx = fakeContext({ state: 'suspended' });
  const engine = new AudioPlaybackEngine({ audioContext: ctx });
  await engine.unlock(); await engine.unlock();
  assert.equal(ctx.resumeCalls, 1);
  assert.equal(ctx.analyser.fftSize, 256);
  assert.deepEqual(ctx.analyser.connections, [ctx.destination]);
  assert.equal(engine.sampleFrequencyData().length, 128);
  assert.equal(engine.sampleFrequencyData()[0], 73);
  await engine.dispose(); assert.equal(ctx.closeCalls, 0);
});

test('play requires unlock and creates fresh sources routed through analyser', async () => {
  const ctx = fakeContext(); const ended = [];
  const engine = new AudioPlaybackEngine({ audioContext: ctx, onEnded: event => ended.push(event.id) });
  await assert.rejects(engine.play('A', {}), /unlock/);
  await engine.unlock();
  await engine.play('A', {});
  assert.deepEqual(ctx.sources[0].connections, [ctx.analyser]);
  assert.equal(ctx.sources[0].starts, 1);
  await assert.rejects(engine.play('B', {}), /already playing/);
  const old = ctx.sources[0]; const callback = old.onended;
  old.end(); callback?.();
  assert.deepEqual(ended, ['A']);
  await engine.play('B', {});
  assert.notEqual(ctx.sources[0], ctx.sources[1]);
  ctx.sources[1].end();
  assert.deepEqual(ended, ['A', 'B']);
  await engine.dispose();
});

test('stop prevents natural completion event and is idempotent', async () => {
  const ctx = fakeContext(); let count = 0;
  const engine = new AudioPlaybackEngine({ audioContext: ctx, onEnded: () => count++ });
  await engine.unlock(); await engine.play('A', {});
  const stale = ctx.sources[0].onended;
  assert.equal(engine.stop(), true); assert.equal(engine.stop(), false);
  stale(); assert.equal(count, 0); assert.equal(ctx.sources[0].stops, 1);
  await engine.dispose();
});

test('start failure disconnects and frees playback slot', async () => {
  const ctx = fakeContext({ failStart: true });
  const engine = new AudioPlaybackEngine({ audioContext: ctx });
  await engine.unlock();
  await assert.rejects(engine.play('A', {}), /start failed/);
  assert.equal(engine.current, null);
  assert.equal(ctx.sources[0].disconnected, true);
  await engine.dispose();
});

test('resume failure does not create a source or mark playback active', async () => {
  const ctx = fakeContext({ state: 'suspended', failResume: true });
  const engine = new AudioPlaybackEngine({ audioContext: ctx });
  await assert.rejects(engine.unlock(), /resume denied/);
  assert.equal(ctx.sources.length, 0);
  assert.equal(engine.current, null);
  await engine.dispose();
});

test('engine-owned AudioContext closes on disposal; borrowed one stays open', async () => {
  const ctx = fakeContext();
  const engine = new AudioPlaybackEngine({ contextFactory: () => ctx });
  await engine.unlock(); await engine.play('A', {});
  await engine.dispose(); await engine.dispose();
  assert.equal(ctx.closeCalls, 1);
  assert.equal(ctx.sources[0].disconnected, true);
  assert.equal(ctx.analyser.disconnected, true);
  assert.equal(engine.sampleFrequencyData(), null);
});

test('concurrent play after suspended context resumes reserves only one slot', async () => {
  const ctx = fakeContext(); const engine = new AudioPlaybackEngine({ audioContext: ctx });
  await engine.unlock(); ctx.state = 'suspended';
  let release; const pendingResume = new Promise(resolve => { release = () => { ctx.state = 'running'; resolve(); }; });
  ctx.resume = () => pendingResume;
  const a = engine.play('A', {});
  const b = engine.play('B', {});
  release();
  const results = await Promise.allSettled([a, b]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.filter(x => x.status === 'rejected').length, 1);
  assert.equal(ctx.sources.length, 1);
  await engine.dispose();
});
