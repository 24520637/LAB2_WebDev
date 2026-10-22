import test from 'node:test';
import assert from 'node:assert/strict';
import { FIFOQueue } from '../src/fifo-queue.mjs';
import { createAudioLoadWorker, AudioLoadError } from '../src/audio-loader.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;});return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const good = (bytes = new ArrayBuffer(4)) => ({ok:true, status:200, arrayBuffer:async()=>bytes});
const setup = (fetchImpl, decodeAudioData = async()=>({buffer:true})) => {
  const events=[],ready=[];
  const queue=new FIFOQueue(createAudioLoadWorker({audioContext:{decodeAudioData},fetchImpl}), {
    onEvent:e=>events.push(e),
    onReady:(track,buffer)=>ready.push({track,buffer}),
  });
  return {queue,events,ready};
};
const enqueue = (queue, id) => assert.equal(queue.enqueue({id,url:`/${id}`}).ok,true);
const failure = (events,id) => events.find(e=>e.id===id && e.type==='task:terminal')?.error?.category;

test('success: sends AbortSignal, byte data to decoder and reaches ready', async()=>{
  const bytes=new ArrayBuffer(8), decoded={duration:1}; let received,signal;
  const {queue,events,ready}=setup(async(_url, opts)=>{signal=opts.signal;return good(bytes);},async input=>{received=input;return decoded;});
  enqueue(queue,'A');await tick();
  assert.equal(received,bytes);assert.equal(signal instanceof AbortSignal,true);
  assert.equal(queue.snapshot('A').state,'ready');
  assert.deepEqual(ready,[{track:{id:'A',url:'/A',metadata:undefined},buffer:decoded}]);
  assert.deepEqual(events.filter(e=>e.id==='A'&&e.type==='task:state').map(e=>e.state),['fetching','decoding','ready']);
});

test('HTTP non-ok is categorized and FIFO resumes', async()=>{
  const {queue,events}=setup(async url=>url==='/A'?{ok:false,status:404}:good());
  enqueue(queue,'A');enqueue(queue,'B');await tick();
  assert.equal(failure(events,'A'),'http');assert.equal(queue.snapshot('B').state,'ready');
});

test('network rejection is distinct and FIFO resumes',async()=>{
  const {queue,events}=setup(async url=>{if(url==='/A')throw Error('offline');return good();});
  enqueue(queue,'A');enqueue(queue,'B');await tick();
  assert.equal(failure(events,'A'),'network');assert.equal(queue.snapshot('B').state,'ready');
});

test('fetch AbortError without user cancel is distinct',async()=>{
  const {queue,events}=setup(async()=>{throw Object.assign(new Error('aborted'),{name:'AbortError'});});
  enqueue(queue,'A');await tick();assert.equal(failure(events,'A'),'aborted');
});

test('cancel in fetch aborts signal, finalizes once and proceeds',async()=>{
  const gate=deferred(),seen=[];
  const {queue,events}=setup(async(url,{signal})=>{seen.push({url,signal});if(url==='/A')return gate.promise;return good();});
  enqueue(queue,'A');enqueue(queue,'B');await tick();queue.cancel('A');
  assert.equal(seen[0].signal.aborted,true);
  assert.equal(queue.snapshot('A').state,'cancelled');
  assert.deepEqual(seen.map(x=>x.url),['/A']);
  gate.reject(Object.assign(new Error('abort'),{name:'AbortError'}));await tick();
  assert.equal(queue.snapshot('B').state,'ready');
  assert.equal(events.filter(e=>e.id==='A'&&e.type==='task:terminal').length,1);
});

test('arrayBuffer read failure has network category',async()=>{
  const {queue,events}=setup(async()=>({ok:true,status:200,arrayBuffer:async()=>{throw Error('stream broke');}}));
  enqueue(queue,'A');await tick();assert.equal(failure(events,'A'),'network');
});

test('corrupt audio decode error is distinct; subsequent tasks continue',async()=>{
  const {queue,events}=setup(async url=>good(new ArrayBuffer(url==='/A'?4:8)),async bytes=>{if(bytes.byteLength===4)throw Error('invalid audio');return {duration:1};});
  enqueue(queue,'A');enqueue(queue,'B');await tick();
  assert.equal(failure(events,'A'),'decode');assert.equal(queue.snapshot('B').state,'ready');
});

test('late decode after cancellation is discarded, with no overlapping decodes or buffer handoff',async()=>{
  const first=deferred(),started=[],delivered=[];let running=0,max=0;
  const worker=createAudioLoadWorker({fetchImpl:async url=>good(new TextEncoder().encode(url).buffer),
    audioContext:{decodeAudioData:async bytes=>{
      const name=new TextDecoder().decode(bytes);started.push(name);running++;max=Math.max(max,running);
      try { if(name==='/A')return await first.promise;return {id:name}; }
      finally {running--; }
    }}});
  const events=[];
  const queue=new FIFOQueue(worker,{
    onEvent:e=>events.push(e),
    onReady:(track,buffer)=>delivered.push({id:track.id,buffer}),
  });
  enqueue(queue,'A');enqueue(queue,'B');await tick();
  assert.deepEqual(started,['/A']);assert.equal(queue.snapshot('A').state,'decoding');
  queue.cancel('A');await tick();assert.deepEqual(started,['/A']);
  first.resolve({id:'/A'});await tick();
  assert.deepEqual(started,['/A','/B']);assert.equal(max,1);
  assert.deepEqual(delivered.map(x=>x.id),['B']);
  assert.deepEqual(delivered[0].buffer,{id:'/B'});
  assert.equal(queue.snapshot('A').state,'cancelled');assert.equal(queue.snapshot('B').state,'ready');
  assert.equal(events.filter(e=>e.id==='A'&&e.type==='task:terminal').length,1);
});

test('cancel between fetch completion and decode prevents decoder invocation',async()=>{
  let decodeCalls=0;const gate=deferred();const {queue}=setup(async()=>({ok:true,arrayBuffer:()=>gate.promise}),async()=>{decodeCalls++;});
  enqueue(queue,'A');await tick();queue.cancel('A');gate.resolve(new ArrayBuffer(4));await tick();
  assert.equal(decodeCalls,0);assert.equal(queue.snapshot('A').state,'cancelled');
});

test('worker direct result is AudioBuffer-shaped and cancelled decode rejects as aborted',async()=>{
  const gate=deferred(),controller=new AbortController(),transitions=[];
  const buffer={duration:5};
  const worker=createAudioLoadWorker({fetchImpl:async()=>good(),audioContext:{decodeAudioData:()=>gate.promise}});
  const pending=worker({id:'X',url:'/X'},{signal:controller.signal,transition:s=>{transitions.push(s);return true;}});
  await tick();controller.abort();gate.resolve(buffer);
  await assert.rejects(pending,error=>error instanceof AudioLoadError && error.category==='aborted');
  assert.deepEqual(transitions,['decoding']);
  const fresh=createAudioLoadWorker({fetchImpl:async()=>good(),audioContext:{decodeAudioData:async()=>buffer}});
  assert.equal(await fresh({id:'Y',url:'/Y'},{signal:new AbortController().signal,transition:()=>true}),buffer);
});
