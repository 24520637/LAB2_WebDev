import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackCoordinator } from '../src/playback-coordinator.mjs';
import { AudioPlaybackEngine } from '../src/audio-engine.mjs';
import { CanvasAudioVisualizer } from '../src/canvas-visualizer.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Engine {
  constructor(){this.onEnded=()=>{};this.stops=0;this.plays=[];}
  async play(id,b){this.plays.push([id,b]);this.current={id};}
  stop(){this.stops++;this.current=null;}
  async unlock(){}
}
const add=(c,id)=>c.enqueue({id,url:`/${id}`});
test('unmount cancels queued tasks and prevents their worker from starting',async()=>{
 const gate=deferred(),seen=[],e=new Engine();
 const c=new PlaybackCoordinator(async t=>{seen.push(t.id);await gate.promise;return {};},e);
 add(c,'A');add(c,'B');await flush();await c.dispose();gate.resolve();await flush();
 assert.deepEqual(seen,['A']);assert.equal(c.snapshot('A').state,'cancelled');
 assert.equal(c.snapshot('B').state,'cancelled');assert.equal(e.plays.length,0);
});
test('fetching cancellation aborts owned AbortSignal and late work has no handoff',async()=>{
 const gate=deferred();let signal;const e=new Engine();
 const c=new PlaybackCoordinator(async (_,{signal:s})=>{signal=s;await gate.promise;return {};},e);
 add(c,'A');await flush();assert.equal(c.cancel('A').ok,true);assert.equal(signal.aborted,true);
 gate.resolve();await flush();assert.equal(c.buffers.size,0);assert.equal(e.plays.length,0);
 await c.dispose();
});
test('decoding cancellation retains worker slot until promise settles',async()=>{
 const gate=deferred(),seen=[],e=new Engine();
 const c=new PlaybackCoordinator(async (t,{transition})=>{seen.push(t.id);transition('decoding');if(t.id==='A') await gate.promise;return {id:t.id};},e);
 add(c,'A');add(c,'B');await flush();c.cancel('A');await flush();assert.deepEqual(seen,['A']);
 gate.resolve();await flush();assert.deepEqual(seen,['A','B']);assert.equal(c.buffers.has('A'),false);
 await c.dispose();
});
test('playing cleanup frees buffer, prevents ended callback, and restores borrowed handler',async()=>{
 const e=new Engine(), previous=e.onEnded;const c=new PlaybackCoordinator(async()=>({sample:true}),e);
 add(c,'A');await flush();assert.equal(c.buffers.has('A'),true);
 const stale=e.onEnded;await c.dispose();await c.dispose();
 assert.equal(e.stops,1);assert.equal(c.buffers.size,0);assert.equal(c.ready.length,0);
 assert.equal(e.onEnded,previous);stale({id:'A'});assert.equal(c.snapshot('A').state,'cancelled');
});
test('late resolved play after unmount does not stop another owner session',async()=>{
 const e=new Engine(),gate=deferred();e.play=async()=>gate.promise;
 const c=new PlaybackCoordinator(async()=>({}),e);add(c,'A');await flush();
 e.current={id:'other-owner'};await c.dispose();
 assert.equal(e.stops,0);
 gate.resolve();await flush();assert.equal(e.stops,0);
});
test('shared AudioContext is never closed; owned context closes exactly once',async()=>{
 const makeCtx=()=>({state:'running',destination:{},closeCalls:0,
  createAnalyser(){return {fftSize:256,get frequencyBinCount(){return 128;},connect(){},disconnect(){},getByteFrequencyData(){}};},
  createBufferSource(){return {buffer:null,connect(){},disconnect(){},start(){},stop(){}};},
  async close(){this.closeCalls++;this.state='closed';}});
 const shared=makeCtx(),borrowed=new AudioPlaybackEngine({audioContext:shared});await borrowed.unlock();await borrowed.dispose();await borrowed.dispose();assert.equal(shared.closeCalls,0);
 const ownedContext=makeCtx(),owned=new AudioPlaybackEngine({contextFactory:()=>ownedContext});await owned.unlock();
 await Promise.all([owned.dispose(),owned.dispose()]);assert.equal(ownedContext.closeCalls,1);
});
test('visualizer disposal cancels RAF, removes listener, clears references, and is repeatable',()=>{
 const callbacks=new Map(),cancelled=[],listeners=new Map();let seq=0;
 const documentRef={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 const canvas={width:200,height:100,clientWidth:200,clientHeight:100,getBoundingClientRect:()=>({width:200,height:100}),getContext:()=>({setTransform(){},clearRect(){},fillRect(){}})};
 const engine={current:{id:'A'},sampleFrequencyData:()=>new Uint8Array(128)};
 const v=new CanvasAudioVisualizer(canvas,engine,{documentRef,requestFrame:fn=>{callbacks.set(++seq,fn);return seq;},cancelFrame:id=>{cancelled.push(id);callbacks.delete(id);}});
 assert.equal(v.start(),true);const callback=callbacks.get(1);v.dispose();v.dispose();callback();
 assert.deepEqual(cancelled,[1]);assert.equal(callbacks.size,0);assert.equal(listeners.size,0);
 assert.equal(v.canvas,null);assert.equal(v.engine,null);assert.equal(v.running,false);
});
