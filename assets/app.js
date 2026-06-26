import {
  centsToNeedleDegrees,
  detectPitchAutoCorrelate,
  frequencyToNote,
  getRms,
  isTuned,
} from "./tuner-core.js";

const app = document.querySelector("#tunerApp");
const startButton = document.querySelector("#startButton");
const a4Input = document.querySelector("#a4Input");
const needle = document.querySelector("#needle");
const vuMeter = document.querySelector(".vu-meter");
const scale = document.querySelector(".scale");
const noteName = document.querySelector("#noteName");
const noteOctave = document.querySelector("#noteOctave");
const frequencyValue = document.querySelector("#frequencyValue");
const targetValue = document.querySelector("#targetValue");
const centsValue = document.querySelector("#centsValue");
const statusText = document.querySelector("#statusText");
const levelFill = document.querySelector("#levelFill");

let audioContext = null;
let analyser = null;
let stream = null;
let animationFrame = null;
let timeBuffer = null;
let lastFrequency = null;
let lastDetectedAt = 0;

function buildScale() {
  for (let cents = -50; cents <= 50; cents += 5) {
    const tick = document.createElement("span");
    tick.className = "tick";
    if (cents % 10 === 0) {
      tick.classList.add("major");
    }
    if (cents === 0) {
      tick.classList.add("center");
    }
    tick.style.setProperty("--angle", `${centsToNeedleDegrees(cents)}deg`);
    scale.appendChild(tick);
  }
}

function getA4() {
  const value = Number.parseFloat(a4Input.value);
  if (!Number.isFinite(value)) {
    return 440;
  }
  return Math.min(480, Math.max(400, value));
}

function formatFrequency(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

function setStatus(text, isError = false) {
  statusText.textContent = text;
  statusText.classList.toggle("error", isError);
}

function setNeedle(cents) {
  const degrees = centsToNeedleDegrees(cents);
  needle.style.setProperty("--needle-deg", `${degrees}deg`);
  vuMeter.setAttribute("aria-valuenow", String(Math.max(-50, Math.min(50, cents))));
}

function setTunedState(tuned) {
  app.classList.toggle("tuned", tuned);
  document.body.classList.toggle("tuned", tuned);
}

function updateReadout(note) {
  if (!note) {
    setTunedState(false);
    setNeedle(0);
    noteName.textContent = "--";
    noteOctave.textContent = "";
    frequencyValue.textContent = "--";
    targetValue.textContent = "--";
    centsValue.textContent = "0";
    return;
  }

  const tuned = isTuned(note.cents);
  const centsPrefix = note.cents > 0 ? "+" : "";

  setTunedState(tuned);
  setNeedle(note.cents);
  noteName.textContent = note.name;
  noteOctave.textContent = note.octave;
  frequencyValue.textContent = formatFrequency(note.frequency);
  targetValue.textContent = formatFrequency(note.targetFrequency);
  centsValue.textContent = `${centsPrefix}${note.cents}`;

  if (tuned) {
    setStatus("TUNED");
  } else if (note.cents < 0) {
    setStatus("FLAT");
  } else {
    setStatus("SHARP");
  }
}

function updateLevel(buffer) {
  const level = Math.min(1, getRms(buffer) * 8);
  levelFill.style.width = `${Math.round(level * 100)}%`;
}

function tick() {
  if (!analyser || !audioContext || !timeBuffer) {
    return;
  }

  analyser.getFloatTimeDomainData(timeBuffer);
  updateLevel(timeBuffer);

  const detected = detectPitchAutoCorrelate(timeBuffer, audioContext.sampleRate, {
    minFrequency: 40,
    maxFrequency: 5000,
    rmsThreshold: 0.008,
    correlationThreshold: 0.72,
  });

  if (detected) {
    lastFrequency = detected;
    lastDetectedAt = performance.now();
    updateReadout(frequencyToNote(detected, getA4()));
  } else if (lastFrequency && performance.now() - lastDetectedAt > 650) {
    lastFrequency = null;
    updateReadout(null);
    setStatus("LISTENING");
  } else if (!lastFrequency) {
    updateReadout(null);
    setStatus("LISTENING");
  }

  animationFrame = window.requestAnimationFrame(tick);
}

async function start() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("MIC API UNAVAILABLE", true);
    return;
  }

  startButton.disabled = true;
  setStatus("STARTING");

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.12;
    timeBuffer = new Float32Array(analyser.fftSize);

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    startButton.textContent = "Stop";
    startButton.disabled = false;
    lastFrequency = null;
    lastDetectedAt = 0;
    setStatus("LISTENING");
    animationFrame = window.requestAnimationFrame(tick);
  } catch (error) {
    stop();
    startButton.disabled = false;
    setStatus(error?.name === "NotAllowedError" ? "MIC DENIED" : "MIC ERROR", true);
  }
}

function stop() {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  analyser = null;
  timeBuffer = null;
  lastFrequency = null;
  lastDetectedAt = 0;
  levelFill.style.width = "0%";
  startButton.textContent = "Start";
  startButton.disabled = false;
  updateReadout(null);
  setStatus("READY");
}

startButton.addEventListener("click", () => {
  if (audioContext) {
    stop();
    return;
  }
  start();
});

a4Input.addEventListener("change", () => {
  a4Input.value = getA4().toString();
  if (lastFrequency) {
    updateReadout(frequencyToNote(lastFrequency, getA4()));
  }
});

buildScale();
updateReadout(null);
