import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackCoordinator } from '../src/playback-coordinator.mjs';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
class FakeEngine {
  constructor() { this.plays=[]; this.stops=0; this.onEnded=()=>{}; }
  async play(id, buffer) { this.plays.push({id,buffer}); }
  stop() { this.stops++; return true; }
  end(id) { this.onEnded({id}); }
}
const add = (c, ...ids) => ids.forEach(id => assert.equal(c.enqueue({id,url:`/${id}`}).ok,true));

test('A/B/C handoff plays FIFO and each natural completion is terminal once', async () => {
  const engine=new FakeEngine(), events=[];
  const c=new PlaybackCoordinator(async t=>({id:t.id}),engine,{onEvent:e=>events.push(e)});
  add(c,'A','B','C'); await tick();
  assert.deepEqual(engine.plays.map(p=>p.id),['A']);
  engine.end('A'); await tick(); engine.end('B'); await tick(); engine.end('C'); await tick();
  assert.deepEqual(engine.plays.map(p=>p.id),['A','B','C']);
  assert.deepEqual(['A','B','C'].map(id=>c.snapshot(id).state),['completed','completed','completed']);
  assert.equal(events.filter(e=>e.type==='task:terminal').length,3);
});

test('rapid repeated skip and stale ended cannot mutate newer track', async () => {
  const engine=new FakeEngine(), events=[];
  const c=new PlaybackCoordinator(async t=>({id:t.id}),engine,{onEvent:e=>events.push(e)});
  add(c,'A','B'); await tick();
  assert.equal(c.skip().ok,true);
  assert.equal(c.skip().code,'nothing_playing');
  await tick(); assert.deepEqual(engine.plays.map(p=>p.id),['A','B']);
  engine.end('A'); assert.equal(c.snapshot('B').state,'playing');
  engine.end('B'); engine.end('A');
  assert.equal(c.snapshot('A').state,'skipped'); assert.equal(c.snapshot('B').state,'completed');
  assert.deepEqual(events.filter(e=>e.type==='task:terminal').map(e=>e.id+':'+e.state),['A:skipped','B:completed']);
});

test('skip at natural end resolves to exactly one outcome', async () => {
  for(const first of ['end','skip']) {
    const e=new FakeEngine(), c=new PlaybackCoordinator(async t=>({id:t.id}),e), terminals=[];
    c.queue.onEvent=ev=>{if(ev.type==='task:terminal')terminals.push(ev.state);};
    add(c,'A','B'); await tick();
    if(first==='end') {e.end('A'); c.skip();} else {c.skip();e.end('A');}
    await tick(); assert.equal(terminals.length,1); assert.equal(c.snapshot('B').state,'playing');
  }
});

test('immediate queued cancellation never invokes its worker', async () => {
  const e=new FakeEngine(), seen=[];
  const c=new PlaybackCoordinator(async t=>{seen.push(t.id);return {id:t.id};},e);
  add(c,'A','B'); assert.equal(c.cancel('B').ok,true);
  await tick(); assert.deepEqual(seen,['A']); assert.equal(c.snapshot('B').state,'cancelled');
  assert.equal(c.cancel('B').code,'already_terminal');
});

test('fetch cancellation aborts signal and continues safely', async () => {
  const gate=deferred(), e=new FakeEngine(), seen=[], signals=[];
  const c=new PlaybackCoordinator(async (t,{signal})=>{seen.push(t.id);signals.push(signal); if(t.id==='A') await gate.promise;return {id:t.id};},e);
  add(c,'A','B'); await tick(); assert.equal(c.cancel('A').ok,true);
  assert.equal(signals[0].aborted,true); await tick(); assert.deepEqual(seen,['A']);
  gate.resolve(); await tick();assert.deepEqual(seen,['A','B']);
  assert.deepEqual(e.plays.map(p=>p.id),['B']);
});

test('cancel while decoding discards late buffer and reserves decode slot', async () => {
  const gate=deferred(),e=new FakeEngine(),starts=[], live=[];
  const c=new PlaybackCoordinator(async (t,{signal,transition})=>{
    starts.push(t.id); live.push(signal);
    transition('decoding'); if(t.id==='A')await gate.promise;
    return {id:t.id};
  },e);
  add(c,'A','B');await tick();assert.equal(c.snapshot('A').state,'decoding');
  assert.equal(c.cancel('A').ok,true); await tick();assert.deepEqual(starts,['A']);
  gate.resolve();await tick();assert.deepEqual(starts,['A','B']);
  assert.deepEqual(e.plays.map(p=>p.id),['B']);assert.equal(c.buffers.has('A'),false);
});

test('cancel playing stops source and is not classified as skipped',async()=>{
  const e=new FakeEngine(),c=new PlaybackCoordinator(async t=>({id:t.id}),e);
  add(c,'A','B');await tick(); assert.equal(c.cancel('A').ok,true);
  assert.equal(c.cancel('A').code,'already_terminal');await tick();
  assert.equal(c.snapshot('A').state,'cancelled');assert.equal(c.snapshot('B').state,'playing');
  assert.equal(e.stops,1);e.end('A');assert.equal(c.snapshot('B').state,'playing');
});

test('pending play resolution after skip cannot stop newer track',async()=>{
  const gate=deferred();const e=new FakeEngine();e.play=async function(id,buffer){this.plays.push({id,buffer});if(id==='A')await gate.promise;};
  const c=new PlaybackCoordinator(async t=>({id:t.id}),e);add(c,'A','B');await tick();
  assert.equal(c.skip().ok,true);await tick();assert.deepEqual(e.plays.map(p=>p.id),['A']);
  gate.resolve();await tick();assert.deepEqual(e.plays.map(p=>p.id),['A','B']);
  assert.equal(c.snapshot('B').state,'playing');
});

test('playback start error fails task and advances',async()=>{
  const e=new FakeEngine();e.play=async function(id,b){this.plays.push({id,buffer:b});if(id==='A')throw Error('start failed');};
  const c=new PlaybackCoordinator(async t=>({id:t.id}),e);add(c,'A','B');await tick();
  assert.equal(c.snapshot('A').state,'failed');assert.equal(c.snapshot('B').state,'playing');
});

test('ready buffer waits for user-gesture unlock before playback', async () => {
  const e=new FakeEngine();e.unlocked=false;
  e.unlock=async()=>{e.unlocked=true;};
  const c=new PlaybackCoordinator(async t=>({id:t.id}),e);
  add(c,'A');await tick();assert.equal(c.snapshot('A').state,'ready');
  assert.equal(e.plays.length,0);
  await c.unlock();await tick();assert.equal(c.snapshot('A').state,'playing');
  assert.deepEqual(e.plays.map(p=>p.id),['A']);
});
