import test from 'node:test';
import assert from 'node:assert/strict';
import { FIFOQueue } from '../src/fifo-queue.mjs';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); };

test('rapid A,B,C enqueue is FIFO, single-flight, no overlap', async () => {
  const gates = [deferred(), deferred(), deferred()];
  const starts = []; let active = 0, maximum = 0;
  const q = new FIFOQueue(async track => {
    starts.push(track.id); active++; maximum = Math.max(maximum, active);
    try { await gates[starts.length-1].promise; } finally { active--; }
  });
  for (const id of ['A','B','C']) assert.equal(q.enqueue({id,url:`/${id}`}).ok,true);
  await tick(); assert.deepEqual(starts,['A']); assert.equal(maximum,1);
  gates[0].resolve(); await tick(); assert.deepEqual(starts,['A','B']);
  gates[1].resolve(); await tick(); assert.deepEqual(starts,['A','B','C']);
  gates[2].resolve(); await tick();
  assert.equal(maximum,1);
  for (const id of ['A','B','C']) assert.equal(q.snapshot(id).state,'ready');
});

test('failure continues to following task without overlap', async () => {
  const first = deferred(); const starts=[]; const terminal=[]; let active=0,max=0;
  const q = new FIFOQueue(async track => {
    starts.push(track.id); active++; max=Math.max(max,active);
    try { if (track.id==='A') await first.promise; } finally { active--; }
  }, {onEvent:e=>{if(e.type==='task:terminal') terminal.push(e.id);}});
  for (const id of ['A','B','C']) q.enqueue({id,url:`/${id}`});
  await tick(); first.reject(new Error('decode broke')); await tick();
  assert.deepEqual(starts,['A','B','C']); assert.equal(max,1);
  assert.equal(q.snapshot('A').state,'failed'); assert.equal(q.snapshot('B').state,'ready');
  assert.equal(q.snapshot('C').state,'ready'); assert.deepEqual(terminal,['A']);
});

test('duplicate IDs rejected including after ready; same URL different IDs allowed', async () => {
  const q = new FIFOQueue(async () => {});
  assert.equal(q.enqueue({id:'A',url:'/song'}).ok,true);
  assert.equal(q.enqueue({id:'A',url:'/song'}).code,'duplicate_id');
  assert.equal(q.enqueue({id:'B',url:'/song'}).ok,true);
  await tick(); assert.equal(q.enqueue({id:'A',url:'/song'}).code,'duplicate_id');
});

test('cancel queued B removes it without disturbing A,C', async () => {
  const first=deferred(), starts=[]; const q = new FIFOQueue(async t => {starts.push(t.id);if(t.id==='A')await first.promise;});
  for (const id of ['A','B','C']) q.enqueue({id,url:`/${id}`});
  assert.equal(q.cancel('B').ok,true); await tick(); first.resolve(); await tick();
  assert.deepEqual(starts,['A','C']); assert.equal(q.snapshot('B').state,'cancelled');
  assert.equal(q.cancel('B').code,'already_terminal');
});

test('cancel active task finalizes once but holds worker slot until promise settles', async () => {
  const first=deferred(), starts=[], ends=[];
  const q = new FIFOQueue(async (_, {signal}) => { starts.push(_.id); if(_.id==='A'){ await first.promise; assert.equal(signal.aborted,true); } },
    {onEvent:e=>{if(e.type==='task:terminal')ends.push(e.id+':'+e.state);}});
  q.enqueue({id:'A',url:'/A'});q.enqueue({id:'B',url:'/B'});
  await tick(); assert.equal(q.cancel('A').ok,true); await tick();
  assert.deepEqual(starts,['A']); assert.deepEqual(ends,['A:cancelled']);
  first.resolve();await tick();assert.deepEqual(starts,['A','B']);
  assert.deepEqual(ends,['A:cancelled']);
});

test('enqueue during worker completion still drains, dispose cancels pending', async () => {
  const starts=[];let q;
  q=new FIFOQueue(async t => { starts.push(t.id); if(t.id==='A') q.enqueue({id:'B',url:'/B'}); });
  q.enqueue({id:'A',url:'/A'});await tick();assert.deepEqual(starts,['A','B']);
  assert.equal(q.skip().code,'nothing_playing');
  const gate=deferred(), q2=new FIFOQueue(async ()=>gate.promise);
  q2.enqueue({id:'C',url:'/C'});q2.enqueue({id:'D',url:'/D'});
  await tick(); q2.dispose();assert.equal(q2.snapshot('C').state,'cancelled');
  assert.equal(q2.snapshot('D').state,'cancelled');gate.resolve();await tick();
});

test('worker result is handed to its consumer once without retaining it in queue events', async () => {
  const buffer = { duration: 4 };
  const received = [];
  const events = [];
  const q = new FIFOQueue(
    async () => buffer,
    {
      onEvent: event => events.push(event),
      onReady: (track, result) => received.push({ id: track.id, result }),
    }
  );

  q.enqueue({ id: 'A', url: '/A' });
  await tick();

  assert.deepEqual(received, [{ id: 'A', result: buffer }]);
  assert.equal(q.snapshot('A').state, 'ready');
  assert.equal(Object.hasOwn(q.snapshot('A'), 'buffer'), false);
  assert.equal(events.some(event => Object.values(event).includes(buffer)), false);
});

test('a missing or throwing result consumer fails only that task and queue continues', async () => {
  const buffer = { duration: 4 };
  const noConsumerEvents = [];
  const noConsumerQueue = new FIFOQueue(
    async task => task.id === 'A' ? buffer : undefined,
    { onEvent: event => noConsumerEvents.push(event) }
  );

  noConsumerQueue.enqueue({ id: 'A', url: '/A' });
  noConsumerQueue.enqueue({ id: 'B', url: '/B' });
  await tick();

  assert.equal(noConsumerQueue.snapshot('A').state, 'failed');
  assert.equal(
    noConsumerEvents.find(event => event.type === 'task:terminal')?.error.category,
    'missing_consumer'
  );
  assert.equal(noConsumerQueue.snapshot('B').state, 'ready');

  const delivered = [];
  const events = [];
  const queue = new FIFOQueue(
    async task => task.id === 'A' ? buffer : { duration: 2 },
    {
      onEvent: event => events.push(event),
      onReady: track => {
        if (track.id === 'A') throw new Error('consumer rejected buffer');
        delivered.push(track.id);
      },
    }
  );

  queue.enqueue({ id: 'A', url: '/A' });
  queue.enqueue({ id: 'B', url: '/B' });
  await tick();

  assert.equal(queue.snapshot('A').state, 'failed');
  assert.equal(
    events.find(event => event.id === 'A' && event.type === 'task:terminal').error.category,
    'consumer_error'
  );
  assert.equal(queue.snapshot('B').state, 'ready');
  assert.deepEqual(delivered, ['B']);
});
