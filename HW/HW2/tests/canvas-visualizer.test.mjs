import test from 'node:test';
import assert from 'node:assert/strict';
import { CanvasAudioVisualizer } from '../src/canvas-visualizer.mjs';

function fixture() {
  const frames = new Map(); let next = 0; const cancelled = [];
  const calls = { bars: [], clear: 0, transforms: [] };
  const ctx = { setTransform: (...a) => calls.transforms.push(a), clearRect: () => calls.clear++, fillRect: (...a) => calls.bars.push(a), fillStyle: '' };
  const canvas = { width: 0, height: 0, getContext: type => type === '2d' ? ctx : null, getBoundingClientRect: () => ({ width: 200, height: 80 }) };
  const listeners = new Map(); const doc = { hidden: false, addEventListener: (k, f) => listeners.set(k, f), removeEventListener: k => listeners.delete(k) };
  const engine = { current: { id: 'A' }, sampleFrequencyDataCalls: 0, sampleFrequencyData() { this.sampleFrequencyDataCalls++; return new Uint8Array([255, 128, 0, 64]); } };
  const visualizer = new CanvasAudioVisualizer(canvas, engine, {
    requestFrame: cb => { const id = ++next; frames.set(id, cb); return id; },
    cancelFrame: id => { cancelled.push(id); frames.delete(id); },
    documentRef: doc, devicePixelRatio: () => 2,
  });
  function frame() { const [id, cb] = frames.entries().next().value; frames.delete(id); cb(); }
  return { visualizer, frames, cancelled, calls, canvas, doc, listeners, engine, frame };
}

test('resize uses DPR with CSS-scale transform', () => {
  const f = fixture(); assert.equal(f.canvas.width, 400); assert.equal(f.canvas.height, 160);
  assert.deepEqual(f.calls.transforms.at(-1), [2, 0, 0, 2, 0, 0]);
  f.visualizer.dispose();
});
test('single RAF loop samples and draws bars without extra scheduling', () => {
  const f = fixture(); assert.equal(f.visualizer.start(), true); assert.equal(f.visualizer.start(), false);
  assert.equal(f.frames.size, 1); f.frame(); assert.equal(f.engine.sampleFrequencyDataCalls, 1);
  assert.equal(f.calls.bars.length, 4); assert.equal(f.frames.size, 1);
  f.visualizer.dispose();
});
test('stopping cancels RAF and repeated stop is safe', () => {
  const f = fixture(); f.visualizer.start(); assert.equal(f.visualizer.stop(), true);
  assert.equal(f.visualizer.stop(), false); assert.equal(f.frames.size, 0);
  assert.equal(f.cancelled.length, 1); f.visualizer.dispose();
});
test('natural playback end stops RAF without scheduling replacement', () => {
  const f = fixture(); f.visualizer.start(); f.engine.current = null; f.frame();
  assert.equal(f.frames.size, 0); assert.equal(f.visualizer.running, false);
  assert.equal(f.engine.sampleFrequencyDataCalls, 0); f.visualizer.dispose();
});
test('hidden document stops and does not restart until explicitly started', () => {
  const f = fixture(); f.visualizer.start(); f.doc.hidden = true;
  f.listeners.get('visibilitychange')(); assert.equal(f.frames.size, 0);
  assert.equal(f.visualizer.start(), false); f.doc.hidden = false;
  assert.equal(f.visualizer.start(), true); f.visualizer.dispose();
});
test('dispose unregisters listener and blocks future RAF, stale callback safe', () => {
  const f = fixture(); f.visualizer.start(); const callback = [...f.frames.values()][0];
  f.visualizer.dispose(); assert.equal(f.listeners.size, 0); assert.equal(f.frames.size, 0);
  callback(); assert.equal(f.frames.size, 0);
  assert.throws(() => f.visualizer.start(), /disposed/);
});
test('start while idle does not create unconditional frame loop', () => {
  const f = fixture(); f.engine.current = null; assert.equal(f.visualizer.start(), false);
  assert.equal(f.frames.size, 0); f.visualizer.dispose();
});
