/** T-08 browser adapter. The DOM is updated on task events, never per animation frame. */
import { AudioPlaybackEngine } from './audio-engine.mjs';
import { createAudioLoadWorker } from './audio-loader.mjs';
import { PlaybackCoordinator } from './playback-coordinator.mjs';
import { CanvasAudioVisualizer } from './canvas-visualizer.mjs';
import { QueueUIController } from './queue-ui-controller.mjs';

const element = id => document.getElementById(id);
const form = element('add-form');
const urlField = element('audio-url');
const addButton = element('add-button');
const playButton = element('play-button');
const skipButton = element('skip-button');
const cancelButton = element('cancel-button');
const cancelTarget = element('cancel-target');
const list = element('queue-list');
const empty = element('empty-state');
const message = element('message');
const playbackStatus = element('playback-status');
const announcement = element('announcement');
// Rendering after the source is actually created starts the visualizer reliably.
// The engine and queue implementations remain unchanged.
class BrowserAudioEngine extends AudioPlaybackEngine {
  async play(...args) {
    const result = await super.play(...args);
    if (!unmounted) render();
    return result;
  }
}
const engine = new BrowserAudioEngine();
let unmounted = false;
let visualizer = null;
let coordinator;
let ui;

function render() {
  if (unmounted || !ui) return;
  addButton.disabled = ui.busy;
  playButton.disabled = ui.busy || !ui.cancellable.length;
  skipButton.disabled = !ui.playing;
  const cancellable = ui.cancellable;
  cancelButton.disabled = !cancellable.length;
  cancelTarget.disabled = !cancellable.length;
  message.textContent = ui.message;
  const current = ui.playing;
  playbackStatus.textContent = current
    ? `Current track: ${current.id} — ${current.state}. ${current.url}`
    : ui.ordered.length ? 'No track currently playing.' : 'Idle. No active track.';
  empty.hidden = ui.ordered.length > 0;
  list.replaceChildren();
  for (const track of ui.ordered) {
    const li = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = `${track.id} — `;
    const state = document.createElement('span');
    state.className = 'track-state';
    state.textContent = track.state;
    const address = document.createElement('span');
    address.textContent = ` — ${track.url}`;
    li.append(heading, state, address);
    if (track.error) {
      const error = document.createElement('span');
      error.className = 'track-error';
      error.textContent = `Error (${track.error.category || 'unknown'}): ${track.error.message || 'Unknown error'}`;
      li.append(error);
    }
    list.append(li);
  }
  const previous = cancelTarget.value;
  cancelTarget.replaceChildren();
  for (const task of cancellable) {
    const option = document.createElement('option');
    option.value = task.id;
    option.textContent = `${task.id} (${task.state})`;
    cancelTarget.append(option);
  }
  if (cancellable.some(t => t.id === ui.selected)) cancelTarget.value = ui.selected;
  else if (cancellable.some(t => t.id === previous)) cancelTarget.value = previous;
  if (current && engine.current && !document.hidden) visualizer?.start();
  else visualizer?.stop();
}

coordinator = new PlaybackCoordinator(
  // Context becomes available after the first Add click unlocks the engine.
  (track, controls) => createAudioLoadWorker({ audioContext: engine.context })(track, controls),
  engine,
  { onEvent: event => ui?.event(event) }
);
ui = new QueueUIController(coordinator, {
  onChange: render,
  onAnnouncement: text => { if (!unmounted) announcement.textContent = text; },
});
visualizer = new CanvasAudioVisualizer(element('bars'), engine);

form.addEventListener('submit', async event => {
  event.preventDefault();
  const value = urlField.value;
  const result = await ui.add(value);
  if (result.ok && !unmounted) urlField.value = '';
});
playButton.addEventListener('click', () => { void ui.play(); });
skipButton.addEventListener('click', () => { ui.skip(); });
cancelTarget.addEventListener('change', () => ui.select(cancelTarget.value));
cancelButton.addEventListener('click', () => ui.cancelSelected());
const resize = () => visualizer?.resize();
const visible = () => { if (!document.hidden) render(); };
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', visible);
function unmount() {
  if (unmounted) return;
  unmounted = true;
  ui.dispose();
  visualizer.dispose();
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', visible);
  void coordinator.dispose();
  // The app owns the engine; a track or visualizer does not own its context.
  void engine.dispose();
}
window.addEventListener('pagehide', unmount, { once: true });
render();
