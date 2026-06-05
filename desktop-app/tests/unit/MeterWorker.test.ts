// ─── MeterWorker.test.ts ─────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePeak,
  computeRms,
  computeShortTermLufs,
  isClipping,
  peakToDbfs,
} from '../../src/renderer/src/audio/MeterWorker.ts'

describe('MeterWorker / computePeak', () => {
  it('silence returns 0', () => {
    assert.equal(computePeak(new Float32Array(64)), 0)
  })

  it('returns max absolute value', () => {
    const buf = new Float32Array([-0.9, 0.5, 0.3, -0.7])
    assert.ok(Math.abs(computePeak(buf) - 0.9) < 1e-6)
  })

  it('positive and negative handled correctly', () => {
    const buf = new Float32Array([0.3, -0.8, 0.1])
    assert.ok(Math.abs(computePeak(buf) - 0.8) < 1e-6)
  })
})

describe('MeterWorker / computeRms', () => {
  it('silence returns 0', () => {
    assert.equal(computeRms(new Float32Array(64)), 0)
  })

  it('all-ones returns 1', () => {
    assert.ok(Math.abs(computeRms(new Float32Array(4).fill(1)) - 1.0) < 1e-6)
  })

  it('known value: [0.5, -0.5, 0.5, -0.5] → 0.5', () => {
    const buf = new Float32Array([0.5, -0.5, 0.5, -0.5])
    assert.ok(Math.abs(computeRms(buf) - 0.5) < 0.001)
  })

  it('empty buffer returns 0', () => {
    assert.equal(computeRms(new Float32Array(0)), 0)
  })
})

describe('MeterWorker / isClipping', () => {
  it('0.99 → false', () => {
    assert.equal(isClipping(0.99), false)
  })

  it('1.0 → true', () => {
    assert.equal(isClipping(1.0), true)
  })

  it('1.01 → true', () => {
    assert.equal(isClipping(1.01), true)
  })

  it('0.0 → false', () => {
    assert.equal(isClipping(0.0), false)
  })
})

describe('MeterWorker / computeShortTermLufs', () => {
  it('silence → -Infinity', () => {
    const result = computeShortTermLufs(new Float32Array(100).fill(0))
    assert.equal(result, -Infinity)
  })

  it('all-ones RMS → 0 LUFS (approximately)', () => {
    const buf    = new Float32Array(100).fill(1)
    const result = computeShortTermLufs(buf)
    assert.ok(Math.abs(result - (-0.691)) < 0.01)
  })

  it('non-silence returns finite number less than 0', () => {
    const buf    = new Float32Array(100).fill(0.1)
    const result = computeShortTermLufs(buf)
    assert.ok(isFinite(result))
    assert.ok(result < 0)
  })

  it('empty buffer → -Infinity', () => {
    assert.equal(computeShortTermLufs(new Float32Array(0)), -Infinity)
  })
})

describe('MeterWorker / peakToDbfs', () => {
  it('1.0 → 0 dBFS', () => {
    assert.ok(Math.abs(peakToDbfs(1.0)) < 1e-6)
  })

  it('0 → -Infinity', () => {
    assert.equal(peakToDbfs(0), -Infinity)
  })
})
