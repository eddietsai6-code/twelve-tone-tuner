import test from "node:test";
import assert from "node:assert/strict";

import {
  centsFromFrequency,
  detectPitchAutoCorrelate,
  centsToNeedleDegrees,
  findClosestInstrumentTarget,
  frequencyToNote,
  generateSineBuffer,
  getTuningHint,
  isTuned,
  noteNumberToFrequency,
} from "../assets/tuner-core.js";

test("frequencyToNote resolves A4 at 440 Hz with zero cents", () => {
  const note = frequencyToNote(440, 440);

  assert.equal(note.name, "A");
  assert.equal(note.octave, 4);
  assert.equal(note.midi, 69);
  assert.equal(note.cents, 0);
  assert.equal(note.targetFrequency, 440);
});

test("frequencyToNote resolves middle C near 261.63 Hz", () => {
  const note = frequencyToNote(261.625565, 440);

  assert.equal(note.name, "C");
  assert.equal(note.octave, 4);
  assert.equal(note.midi, 60);
  assert.ok(Math.abs(note.targetFrequency - 261.625565) < 0.001);
  assert.equal(note.cents, 0);
});

test("centsFromFrequency returns signed flat and sharp offsets", () => {
  const target = noteNumberToFrequency(69, 440);
  const sharp = target * 2 ** (12 / 1200);
  const flat = target * 2 ** (-8 / 1200);

  assert.equal(centsFromFrequency(sharp, 69, 440), 12);
  assert.equal(centsFromFrequency(flat, 69, 440), -8);
});

test("isTuned treats the green zone as inclusive plus or minus five cents", () => {
  assert.equal(isTuned(-5), true);
  assert.equal(isTuned(0), true);
  assert.equal(isTuned(5), true);
  assert.equal(isTuned(-6), false);
  assert.equal(isTuned(6), false);
});

test("centsToNeedleDegrees maps cents to a clamped VU needle angle", () => {
  assert.equal(centsToNeedleDegrees(-50), -42);
  assert.equal(centsToNeedleDegrees(0), 0);
  assert.equal(centsToNeedleDegrees(50), 42);
  assert.equal(centsToNeedleDegrees(80), 42);
  assert.equal(centsToNeedleDegrees(-80), -42);
});

test("findClosestInstrumentTarget matches guitar strings by standard tuning", () => {
  const target = findClosestInstrumentTarget(82.41, "guitar", 440);

  assert.equal(target.string, "6");
  assert.equal(target.name, "E");
  assert.equal(target.octave, 2);
  assert.equal(target.display, "6 = E2");
  assert.ok(Math.abs(target.targetFrequency - 82.4069) < 0.01);
  assert.equal(target.cents, 0);
});

test("findClosestInstrumentTarget requires the chosen instrument target for green state", () => {
  const guitarTarget = findClosestInstrumentTarget(440, "guitar", 440);
  const ukuleleTarget = findClosestInstrumentTarget(440, "ukulele", 440);

  assert.equal(guitarTarget.display, "1 = E4");
  assert.equal(guitarTarget.cents > 0, true);
  assert.equal(ukuleleTarget.display, "1 = A4");
  assert.equal(ukuleleTarget.cents, 0);
});

test("getTuningHint lists standard instrument strings", () => {
  assert.equal(getTuningHint("guitar"), "6=E2 5=A2 4=D3 3=G3 2=B3 1=E4");
  assert.equal(getTuningHint("ukulele"), "4=G4 3=C4 2=E4 1=A4");
  assert.equal(getTuningHint("violin"), "4=G3 3=D4 2=A4 1=E5");
});

test("detectPitchAutoCorrelate detects a generated 440 Hz sine wave", () => {
  const sampleRate = 48000;
  const buffer = generateSineBuffer({
    frequency: 440,
    sampleRate,
    length: 4096,
    amplitude: 0.8,
  });

  const detected = detectPitchAutoCorrelate(buffer, sampleRate);

  assert.ok(detected);
  assert.ok(Math.abs(detected - 440) < 2, `expected 440 Hz, got ${detected}`);
});

test("detectPitchAutoCorrelate keeps quiet low notes in the correct octave", () => {
  const sampleRate = 48000;
  const buffer = generateSineBuffer({
    frequency: 110,
    sampleRate,
    length: 8192,
    amplitude: 0.012,
  });

  const detected = detectPitchAutoCorrelate(buffer, sampleRate, {
    minFrequency: 40,
    maxFrequency: 5000,
    rmsThreshold: 0.0035,
    correlationThreshold: 0.68,
  });

  assert.ok(detected);
  assert.ok(Math.abs(detected - 110) < 1, `expected 110 Hz, got ${detected}`);
});

test("detectPitchAutoCorrelate detects quieter sustained notes", () => {
  const sampleRate = 48000;
  const buffer = generateSineBuffer({
    frequency: 440,
    sampleRate,
    length: 8192,
    amplitude: 0.006,
  });

  const detected = detectPitchAutoCorrelate(buffer, sampleRate, {
    minFrequency: 40,
    maxFrequency: 5000,
    rmsThreshold: 0.0035,
    correlationThreshold: 0.68,
  });

  assert.ok(detected);
  assert.ok(Math.abs(detected - 440) < 2, `expected 440 Hz, got ${detected}`);
});

test("detectPitchAutoCorrelate ignores very quiet input", () => {
  const sampleRate = 48000;
  const buffer = generateSineBuffer({
    frequency: 440,
    sampleRate,
    length: 4096,
    amplitude: 0.002,
  });

  assert.equal(detectPitchAutoCorrelate(buffer, sampleRate), null);
});
