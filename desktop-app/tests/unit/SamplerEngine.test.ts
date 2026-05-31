import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SAMPLER_CONFIG } from '../../src/renderer/src/audio/instruments/SamplerEngine.ts'
import type { SamplerConfig } from '../../src/renderer/src/audio/instruments/SamplerEngine.ts'

test('DEFAULT_SAMPLER_CONFIG has correct shape', () => {
  const c: SamplerConfig = DEFAULT_SAMPLER_CONFIG
  assert.ok(c.attack  > 0)
  assert.ok(c.release > 0)
  assert.ok(c.sustain >= 0 && c.sustain <= 1)
  assert.ok(c.polyphony >= 1)
  assert.ok(c.ampVelSensitivity >= 0 && c.ampVelSensitivity <= 1)
})

// Test pitch calculation math (pure, no AudioContext)
test('pitch ratio: rootPitch=60 target=72 → rate=2', () => {
  const semitones = 72 - 60
  const rate = Math.pow(2, semitones / 12)
  assert.ok(Math.abs(rate - 2.0) < 0.001)
})

test('pitch ratio: rootPitch=60 target=48 → rate=0.5', () => {
  const semitones = 48 - 60
  const rate = Math.pow(2, semitones / 12)
  assert.ok(Math.abs(rate - 0.5) < 0.001)
})

test('pitch ratio: rootPitch=60 target=60 → rate=1', () => {
  const rate = Math.pow(2, 0 / 12)
  assert.strictEqual(rate, 1)
})
