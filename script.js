const MIN_BPM = 30;
const MAX_BPM = 240;

const bpmDisplay = document.querySelector('#bpmDisplay');
const bpmRange = document.querySelector('#bpmRange');
const bpmInput = document.querySelector('#bpmInput');
const minutesInput = document.querySelector('#minutesInput');
const infiniteToggle = document.querySelector('#infiniteToggle');
const timeLeft = document.querySelector('#timeLeft');
const statusText = document.querySelector('#statusText');
const progressBar = document.querySelector('#progressBar');
const beatPulse = document.querySelector('#beatPulse');
const startButton = document.querySelector('#startButton');
const stopButton = document.querySelector('#stopButton');
const tapButton = document.querySelector('#tapButton');
const presetButtons = document.querySelectorAll('[data-bpm]');

let audioContext;
let beatTimerId;
let countdownTimerId;
let isRunning = false;
let startedAt = 0;
let durationMs = 0;
let tapTimes = [];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBpm() {
  return clamp(Number(bpmInput.value) || 120, MIN_BPM, MAX_BPM);
}

function getDurationMs() {
  const minutes = clamp(Number(minutesInput.value) || 1, 1, 240);
  return minutes * 60 * 1000;
}

function setBpm(value) {
  const bpm = clamp(Number(value) || 120, MIN_BPM, MAX_BPM);
  bpmInput.value = bpm;
  bpmRange.value = bpm;
  bpmDisplay.textContent = bpm;

  if (isRunning) {
    scheduleBeatLoop();
  }
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateIdleTime() {
  if (infiniteToggle.checked) {
    timeLeft.textContent = '∞';
    progressBar.style.width = '0%';
    return;
  }

  timeLeft.textContent = formatTime(getDurationMs());
  progressBar.style.width = '0%';
}

function setStatus(text, mode = '') {
  statusText.textContent = text;
  statusText.className = `status ${mode}`.trim();
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

function playClick() {
  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.45, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.06);

  beatPulse.classList.add('active');
  window.setTimeout(() => beatPulse.classList.remove('active'), 90);
}

function scheduleBeatLoop() {
  window.clearInterval(beatTimerId);

  const intervalMs = 60000 / getBpm();
  playClick();
  beatTimerId = window.setInterval(playClick, intervalMs);
}

function updateCountdown() {
  if (infiniteToggle.checked) {
    timeLeft.textContent = '∞';
    progressBar.style.width = '100%';
    return;
  }

  const elapsed = Date.now() - startedAt;
  const remaining = durationMs - elapsed;
  const progress = clamp((elapsed / durationMs) * 100, 0, 100);

  timeLeft.textContent = formatTime(remaining);
  progressBar.style.width = `${progress}%`;

  if (remaining <= 0) {
    stopTimer('Done', 'finished');
  }
}

async function startTimer() {
  if (isRunning) {
    return;
  }

  const context = getAudioContext();

  if (context.state === 'suspended') {
    await context.resume();
  }

  isRunning = true;
  startedAt = Date.now();
  durationMs = getDurationMs();

  setStatus('Running', 'running');
  scheduleBeatLoop();
  updateCountdown();
  countdownTimerId = window.setInterval(updateCountdown, 200);
}

function stopTimer(status = 'Stopped', mode = '') {
  isRunning = false;
  window.clearInterval(beatTimerId);
  window.clearInterval(countdownTimerId);
  setStatus(status, mode);

  if (status !== 'Done') {
    updateIdleTime();
  } else {
    timeLeft.textContent = '00:00';
    progressBar.style.width = '100%';
  }
}

function handleTapBpm() {
  const now = Date.now();
  tapTimes = tapTimes.filter((tapTime) => now - tapTime < 4000);
  tapTimes.push(now);

  if (tapTimes.length < 2) {
    setStatus('Keep tapping');
    return;
  }

  const intervals = [];

  for (let index = 1; index < tapTimes.length; index += 1) {
    intervals.push(tapTimes[index] - tapTimes[index - 1]);
  }

  const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const detectedBpm = Math.round(60000 / averageInterval);

  setBpm(detectedBpm);
  setStatus(`Tap: ${getBpm()} BPM`);
}

bpmRange.addEventListener('input', (event) => setBpm(event.target.value));
bpmInput.addEventListener('input', (event) => setBpm(event.target.value));
minutesInput.addEventListener('input', updateIdleTime);
infiniteToggle.addEventListener('change', updateIdleTime);
startButton.addEventListener('click', startTimer);
stopButton.addEventListener('click', () => stopTimer());
tapButton.addEventListener('click', handleTapBpm);

presetButtons.forEach((button) => {
  button.addEventListener('click', () => setBpm(button.dataset.bpm));
});

updateIdleTime();
