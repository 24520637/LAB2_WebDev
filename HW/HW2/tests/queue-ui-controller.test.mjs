import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueUIController, validateAudioURL } from '../src/queue-ui-controller.mjs';

function setup({ unlockError = null, holdUnlock = null } = {}) {
  const announcements = [];
  let renders = 0;
  const calls = { enqueue: [], cancel: [], skip: 0, unlock: 0 };
  const coordinator = {
    async unlock() { calls.unlock++; if (holdUnlock) await holdUnlock; if (unlockError) throw unlockError; },
    enqueue(task) { calls.enqueue.push(task); return { ok: true, task: { ...task } }; },
    cancel(id) { calls.cancel.push(id); return { ok: true }; },
    skip() { calls.skip++; return { ok: true }; },
  };
  const ui = new QueueUIController(coordinator, {
    onChange: () => renders++, onAnnouncement: text => announcements.push(text),
  });
  function event(id, state, seq = 1, extra = {}) {
    ui.event({ id, url: `https://example.com/${id}.mp3`, state,
      enqueueSequence: seq, ...extra });
  }
  return { ui, calls, event, announcements, get renders() { return renders; } };
}

test('rejects malformed, dangerous-scheme and credential-bearing URLs without enqueue', async () => {
  const { ui, calls, announcements } = setup();
  for (const value of ['', 'not a url', 'file:///x', 'javascript:alert(1)', 'https://a:b@example.com/a.mp3']) {
    assert.equal(validateAudioURL(value), null);
    assert.equal((await ui.add(value)).code, 'invalid_url');
  }
  assert.equal(calls.enqueue.length, 0);
  assert.match(announcements.at(-1), /valid http/);
});

test('adds track after unlock; rapid duplicates cannot enqueue twice while pending', async () => {
  let release;
  const pending = new Promise(r => { release = r; });
  const { ui, calls } = setup({ holdUnlock: pending });
  const first = ui.add('https://example.com/song.mp3');
  assert.equal(ui.busy, true);
  assert.equal((await ui.add('https://example.com/song.mp3')).code, 'busy');
  release();
  assert.equal((await first).ok, true);
  assert.equal(calls.enqueue.length, 1);
  assert.equal(calls.enqueue[0].id, 'track-1');
  assert.equal(ui.busy, false);
});

test('queue stays ordered and exposes fetching decoding playing failure and error text', () => {
  const { ui, event, announcements } = setup();
  event('track-2', 'queued', 2);
  event('track-1', 'fetching', 1);
  event('track-2', 'decoding', 2);
  event('track-1', 'playing', 1);
  assert.deepEqual(ui.ordered.map(t => t.id), ['track-1', 'track-2']);
  assert.equal(ui.playing.id, 'track-1');
  event('track-1', 'failed', 1, { error: { category: 'decode', message: 'Invalid media' } });
  assert.match(ui.message, /Invalid media/);
  assert.ok(announcements.some(text => /failed/.test(text)));
  assert.equal(ui.playing, null);
});

test('cancel targets selected eligible task and skip only current playing task', () => {
  const { ui, event, calls } = setup();
  event('a', 'queued', 1);
  event('b', 'playing', 2);
  ui.select('a');
  assert.equal(ui.cancelSelected().ok, true);
  assert.deepEqual(calls.cancel, ['a']);
  assert.equal(ui.skip().ok, true);
  assert.equal(calls.skip, 1);
  event('b', 'skipped', 2);
  assert.equal(ui.skip().code, 'nothing_playing');
  assert.equal(calls.skip, 1);
  event('a', 'cancelled', 1);
  assert.equal(ui.cancelSelected().code, 'nothing_selected');
});

test('audio unlock failure is announced and retry succeeds after failure', async () => {
  let fail = true;
  const coordinator = {
    async unlock() { if (fail) throw Error('Autoplay blocked'); },
    enqueue(track) { return { ok: true, task: track }; },
  };
  const messages = [];
  const ui = new QueueUIController(coordinator, { onAnnouncement: m => messages.push(m) });
  assert.equal((await ui.add('https://example.com/a.mp3')).code, 'unlock_failed');
  assert.match(messages.at(-1), /Autoplay blocked/);
  assert.equal(ui.busy, false);
  fail = false;
  assert.equal((await ui.add('https://example.com/a.mp3')).ok, true);
});

test('dispose blocks late async callbacks and UI updates', async () => {
  let resume;
  const promise = new Promise(resolve => { resume = resolve; });
  const { ui, event, calls, renders } = setup({ holdUnlock: promise });
  const pending = ui.add('https://example.com/a.mp3');
  const before = renders;
  ui.dispose();
  resume();
  assert.equal((await pending).code, 'disposed');
  event('other', 'playing');
  assert.equal(calls.enqueue.length, 0);
  assert.equal(ui.ordered.length, 0);
  assert.equal(ui.cancelSelected().code, 'nothing_selected');
  assert.equal(ui.skip().code, 'nothing_playing');
  assert.equal(renders, before);
});

test('static browser markup provides semantic controls and live/status alternatives', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  for (const id of ['add-button', 'play-button', 'skip-button', 'cancel-button', 'cancel-target', 'queue-list', 'empty-state', 'playback-status']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /type="submit"/);
  assert.match(css, /:focus-visible/);
});
