import { AudioPlaybackEngine } from './audio-engine.mjs';

const playButton = document.querySelector('#play');
const stopButton = document.querySelector('#stop');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const contextState = document.querySelector('#context-state');
const analyserInfo = document.querySelector('#analyser-info');
const sampleOutput = document.querySelector('#sample');

if (
  !playButton ||
  !stopButton ||
  !status ||
  !error ||
  !contextState ||
  !analyserInfo ||
  !sampleOutput
) {
  throw new Error('T-04 smoke test page is missing required controls.');
}

const toneFrequency = 440;
const toneDurationSeconds = 2;
let animationFrame = 0;
let engine;

engine = new AudioPlaybackEngine({
  onEnded: ({ id }) => {
    if (id !== 't04-tone') return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    stopButton.disabled = true;
    playButton.disabled = false;
    status.textContent = 'Playback finished naturally.';
    updateEngineDetails();
  },
});

function createToneWav() {
  const sampleRate = 44100;
  const sampleCount = sampleRate * toneDurationSeconds;
  const bytes = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(bytes);

  function writeAscii(offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeAscii(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleRate;
    const fadeIn = Math.min(progress / 0.03, 1);
    const fadeOut = Math.min((toneDurationSeconds - progress) / 0.08, 1);
    const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
    const value = Math.sin((2 * Math.PI * toneFrequency * index) / sampleRate);
    view.setInt16(44 + index * 2, value * envelope * 0.35 * 32767, true);
  }

  return bytes;
}

function updateEngineDetails() {
  contextState.textContent = engine.context?.state ?? 'Not created';
  analyserInfo.textContent = engine.analyser
    ? `${engine.analyser.fftSize} / ${engine.analyser.frequencyBinCount}`
    : 'Not initialized';
}

function sampleUntilFinished() {
  const data = engine.sampleFrequencyData();
  if (!data) {
    sampleOutput.textContent = 'Analyser is not initialized.';
    return;
  }

  let peakBin = 0;
  let peakValue = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] > peakValue) {
      peakValue = data[index];
      peakBin = index;
    }
  }

  const sampleRate = engine.context.sampleRate;
  const peakFrequency = (peakBin * sampleRate) / engine.analyser.fftSize;
  const binWidth = sampleRate / engine.analyser.fftSize;
  sampleOutput.textContent =
    `Peak ${peakValue}/255 at approximately ${peakFrequency.toFixed(0)} Hz ` +
    `(bin width ${binWidth.toFixed(0)} Hz; test tone ${toneFrequency} Hz)`;

  if (engine.current) {
    animationFrame = requestAnimationFrame(sampleUntilFinished);
  } else {
    animationFrame = 0;
  }
}

playButton.addEventListener('click', async () => {
  playButton.disabled = true;
  stopButton.disabled = true;
  error.textContent = '';
  status.textContent = 'Unlocking audio and decoding the generated fixture…';

  try {
    const context = await engine.unlock();
    updateEngineDetails();

    const buffer = await context.decodeAudioData(createToneWav());
    await engine.play('t04-tone', buffer);

    status.textContent = 'Playing the 440 Hz test tone. Listen for the tone.';
    stopButton.disabled = false;
    sampleUntilFinished();
  } catch (cause) {
    status.textContent = 'Playback could not start.';
    error.textContent =
      cause instanceof Error ? cause.message : String(cause);
    playButton.disabled = false;
    stopButton.disabled = true;
    updateEngineDetails();
  }
});

stopButton.addEventListener('click', () => {
  if (!engine.stop()) return;

  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  stopButton.disabled = true;
  playButton.disabled = false;
  status.textContent = 'Playback stopped.';
  updateEngineDetails();
});

window.addEventListener('pagehide', () => {
  cancelAnimationFrame(animationFrame);
  void engine.dispose();
});
