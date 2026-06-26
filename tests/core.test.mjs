import test from "node:test";
import assert from "node:assert/strict";

import {
  centsFromFrequency,
  detectPitchAutoCorrelate,
  centsToNeedleDegrees,
  frequencyToNote,
  generateSineBuffer,
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
