export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const DEFAULT_A4 = 440;
const A4_MIDI = 69;

export function noteNumberToFrequency(midi, a4 = DEFAULT_A4) {
  return a4 * 2 ** ((midi - A4_MIDI) / 12);
}

export function centsFromFrequency(frequency, midi, a4 = DEFAULT_A4) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return 0;
  }

  const target = noteNumberToFrequency(midi, a4);
  const cents = Math.round(1200 * Math.log2(frequency / target));
  return Object.is(cents, -0) ? 0 : cents;
}

export function frequencyToNote(frequency, a4 = DEFAULT_A4) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }

  const exactNote = 12 * Math.log2(frequency / a4) + A4_MIDI;
  const midi = Math.round(exactNote);
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const targetFrequency = noteNumberToFrequency(midi, a4);
  const cents = centsFromFrequency(frequency, midi, a4);

  return {
    name,
    octave,
    midi,
    cents,
    frequency,
    targetFrequency,
  };
}

export function isTuned(cents, tolerance = 5) {
  return Number.isFinite(cents) && Math.abs(cents) <= tolerance;
}

export function centsToNeedleDegrees(cents, maxCents = 50, maxDegrees = 42) {
  if (!Number.isFinite(cents)) {
    return 0;
  }

  const clamped = Math.min(maxCents, Math.max(-maxCents, cents));
  return Math.round((clamped / maxCents) * maxDegrees);
}

export function getRms(buffer) {
  if (!buffer.length) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    sum += buffer[index] * buffer[index];
  }

  return Math.sqrt(sum / buffer.length);
}

export function detectPitchAutoCorrelate(
  buffer,
  sampleRate,
  {
    minFrequency = 50,
    maxFrequency = 2000,
    rmsThreshold = 0.01,
    correlationThreshold = 0.78,
  } = {}
) {
  if (!buffer.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return null;
  }

  if (getRms(buffer) < rmsThreshold) {
    return null;
  }

  let mean = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    mean += buffer[index];
  }
  mean /= buffer.length;

  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxLag = Math.min(
    Math.ceil(sampleRate / minFrequency),
    Math.floor(buffer.length / 2)
  );

  let bestLag = -1;
  let bestCorrelation = -1;
  const correlations = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;

    for (let index = 0; index < buffer.length - lag; index += 1) {
      const a = buffer[index] - mean;
      const b = buffer[index + lag] - mean;
      correlation += a * b;
      energyA += a * a;
      energyB += b * b;
    }

    const normalized =
      energyA && energyB ? correlation / Math.sqrt(energyA * energyB) : 0;
    correlations[lag] = normalized;

    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < correlationThreshold) {
    return null;
  }

  const previous = correlations[bestLag - 1] || bestCorrelation;
  const current = correlations[bestLag];
  const next = correlations[bestLag + 1] || bestCorrelation;
  const divisor = previous - 2 * current + next;
  const adjustment = divisor ? 0.5 * (previous - next) / divisor : 0;
  const refinedLag = bestLag + adjustment;

  if (!Number.isFinite(refinedLag) || refinedLag <= 0) {
    return null;
  }

  return sampleRate / refinedLag;
}

export function generateSineBuffer({
  frequency,
  sampleRate,
  length,
  amplitude = 1,
}) {
  const buffer = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    buffer[index] =
      amplitude * Math.sin((2 * Math.PI * frequency * index) / sampleRate);
  }
  return buffer;
}
