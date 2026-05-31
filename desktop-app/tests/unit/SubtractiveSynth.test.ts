import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SYNTH_PARAMS } from '../../src/renderer/src/audio/instruments/SubtractiveSynth.ts'
import type { SynthParams } from '../../src/renderer/src/audio/instruments/SubtractiveSynth.ts'

// Test pure param logic only (no AudioContext needed)
test('DEFAULT_SYNTH_PARAMS has correct structure', () => {
  const p: SynthParams = DEFAULT_SYNTH_PARAMS
  assert.ok(p.attack > 0)
  assert.ok(p.decay  > 0)
  assert.ok(p.sustain >= 0 && p.sustain <= 1)
  assert.ok(p.release > 0)
  assert.ok(p.filterCutoff >= 20 && p.filterCutoff <= 20000)
  assert.ok(p.polyphony >= 1)
})

test('DEFAULT_SYNTH_PARAMS osc waves are valid OscillatorType', () => {
  const valid = ['sine','square','sawtooth','triangle']
  assert.ok(valid.includes(DEFAULT_SYNTH_PARAMS.osc1Wave))
  assert.ok(valid.includes(DEFAULT_SYNTH_PARAMS.osc2Wave))
})

test('SynthParams filterEnvAmount has expected range', () => {
  assert.ok(DEFAULT_SYNTH_PARAMS.filterEnvAmount >= -4)
  assert.ok(DEFAULT_SYNTH_PARAMS.filterEnvAmount <= 4)
})
