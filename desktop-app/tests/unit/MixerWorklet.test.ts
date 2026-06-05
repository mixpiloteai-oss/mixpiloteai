// ─── MixerWorklet.test.ts ────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyGain,
  applyGainStereo,
  clampGain,
  processorCode,
} from '../../src/renderer/src/audio/MixerWorklet.ts'

describe('MixerWorklet / applyGain', () => {
  it('gain=1 is identity', () => {
    const buf = new Float32Array([0.5, -0.3, 0.8])
    const out = applyGain(buf, 1)
    assert.ok(Math.abs(out[0] - 0.5) < 1e-6)
    assert.ok(Math.abs(out[1] - (-0.3)) < 1e-6)
    assert.ok(Math.abs(out[2] - 0.8) < 1e-6)
  })

  it('gain=0 silences buffer', () => {
    const buf = new Float32Array([1, -1, 0.5])
    const out = applyGain(buf, 0)
    for (const s of out) assert.ok(s === 0, `expected 0 but got ${s}`)
  })

  it('gain=0.5 halves amplitude', () => {
    const buf = new Float32Array([0.8, -0.4])
    const out = applyGain(buf, 0.5)
    assert.ok(Math.abs(out[0] - 0.4) < 1e-6)
    assert.ok(Math.abs(out[1] - (-0.2)) < 1e-6)
  })

  it('gain=2 doubles amplitude', () => {
    const buf = new Float32Array([0.1, 0.2])
    const out = applyGain(buf, 2)
    assert.ok(Math.abs(out[0] - 0.2) < 1e-6)
    assert.ok(Math.abs(out[1] - 0.4) < 1e-6)
  })

  it('does not mutate input', () => {
    const buf = new Float32Array([0.5])
    applyGain(buf, 0.5)
    assert.equal(buf[0], 0.5)
  })

  it('empty buffer returns empty', () => {
    assert.equal(applyGain(new Float32Array(0), 1).length, 0)
  })
})

describe('MixerWorklet / applyGainStereo', () => {
  it('applies same gain to both channels', () => {
    const L = new Float32Array([0.6, -0.4])
    const R = new Float32Array([0.3,  0.2])
    const { left, right } = applyGainStereo(L, R, 0.5)
    assert.ok(Math.abs(left[0]  - 0.3)  < 1e-6)
    assert.ok(Math.abs(right[0] - 0.15) < 1e-6)
  })
})

describe('MixerWorklet / clampGain', () => {
  it('passes through values in range', () => {
    assert.ok(Math.abs(clampGain(1) - 1) < 1e-6)
    assert.ok(Math.abs(clampGain(2) - 2) < 1e-6)
  })

  it('clamps negatives to 0', () => {
    assert.equal(clampGain(-1), 0)
  })

  it('clamps above 4 to 4', () => {
    assert.equal(clampGain(10), 4)
  })
})

describe('MixerWorklet / processorCode', () => {
  it('is a non-empty string', () => {
    assert.equal(typeof processorCode, 'string')
    assert.ok(processorCode.length > 0)
  })

  it('contains registerProcessor call', () => {
    assert.ok(processorCode.includes('registerProcessor'))
  })

  it('contains mixer-gain-processor name', () => {
    assert.ok(processorCode.includes('mixer-gain-processor'))
  })

  it('contains gain parameterDescriptor', () => {
    assert.ok(processorCode.includes("'gain'") || processorCode.includes('"gain"'))
  })
})
