// ─── LatencyCompensator.test.ts ───────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LatencyCompensator } from '../../src/renderer/src/audio/recording/LatencyCompensator.ts'

const lc = new LatencyCompensator()

describe('LatencyCompensator / compensate', () => {
  it('compensate(buf, 0, sr) returns copy identical to input', () => {
    const input = new Float32Array([1, 2, 3, 4, 5])
    const result = lc.compensate(input, 0, 44100)
    assert.deepEqual([...result], [1, 2, 3, 4, 5])
    // Should be a copy, not same reference
    assert.notEqual(result, input)
  })

  it('compensate with 10ms at 44100Hz trims 441 samples from start', () => {
    // Create a 1000-sample buffer where samples 0..440 = 0.0 and 441..999 = 1.0
    const input = new Float32Array(1000)
    for (let i = 441; i < 1000; i++) input[i] = 1.0
    const result = lc.compensate(input, 10, 44100)
    // After compensation: first sample should be 1.0 (was at 441)
    assert.equal(result[0], 1.0)
    assert.equal(result.length, 1000)
    // Tail should be zero-filled (559 meaningful samples + 441 zeros at end)
    assert.equal(result[999 - 441], 1.0)
    assert.equal(result[999 - 440], 0.0)
  })

  it('compensate where latency > buffer length returns all zeros (same length)', () => {
    const input = new Float32Array([1, 2, 3, 4, 5])
    // 1000ms at 44100Hz >> 5 samples
    const result = lc.compensate(input, 1000, 44100)
    assert.equal(result.length, 5)
    for (let i = 0; i < result.length; i++) {
      assert.equal(result[i], 0)
    }
  })

  it('compensate negative latency is treated as 0 (returns copy)', () => {
    const input = new Float32Array([1, 2, 3])
    const result = lc.compensate(input, -10, 44100)
    assert.deepEqual([...result], [1, 2, 3])
  })
})

describe('LatencyCompensator / msToSamples', () => {
  it('msToSamples(10, 44100) = 441', () => {
    assert.equal(lc.msToSamples(10, 44100), 441)
  })

  it('msToSamples(0, 44100) = 0', () => {
    assert.equal(lc.msToSamples(0, 44100), 0)
  })
})

describe('LatencyCompensator / estimateRoundTripMs', () => {
  it('estimateRoundTripMs(5, 5, 512, 44100) ≈ 5+5+(512/44100*1000)', () => {
    const bufferMs = (512 / 44100) * 1000
    const expected = 5 + 5 + bufferMs
    const result = lc.estimateRoundTripMs(5, 5, 512, 44100)
    assert.ok(
      Math.abs(result - expected) < 0.001,
      `expected ~${expected}, got ${result}`
    )
  })
})
