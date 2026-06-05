import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LimiterProcessor } from '../../src/renderer/src/audio/export/LimiterProcessor.ts'

const THRESHOLD_DB = -0.3
const THRESHOLD_LIN = Math.pow(10, THRESHOLD_DB / 20)  // ≈ 0.9656

describe('LimiterProcessor', () => {
  describe('construction', () => {
    it('creates with default options', () => {
      const limiter = new LimiterProcessor()
      assert.ok(limiter instanceof LimiterProcessor)
    })

    it('creates with custom threshold', () => {
      const limiter = new LimiterProcessor({ thresholdDb: -6, sampleRate: 48000 })
      assert.ok(limiter instanceof LimiterProcessor)
    })
  })

  describe('process()', () => {
    it('input below threshold: output approximately equals input (gain ≈ 1)', () => {
      const limiter = new LimiterProcessor({ thresholdDb: -0.3, attackMs: 0.1, releaseMs: 100 })
      const input   = new Float32Array(1000).fill(0.5)  // well below threshold
      const channels = [new Float32Array(input)]
      limiter.process(channels)

      // Most samples should be close to original (gain near 1.0)
      let closeCount = 0
      for (let i = 0; i < channels[0]!.length; i++) {
        if (Math.abs((channels[0]![i] ?? 0) - 0.5) < 0.01) closeCount++
      }
      assert.ok(closeCount > channels[0]!.length * 0.9, 'Most samples below threshold should be unchanged')
    })

    it('input above threshold: output does not exceed threshold (linear)', () => {
      const limiter = new LimiterProcessor({ thresholdDb: THRESHOLD_DB, attackMs: 0.1, releaseMs: 50, sampleRate: 44100 })
      // Feed a signal of 2.0 (far above 0dB)
      const input = new Float32Array(4000).fill(2.0)
      const channels = [new Float32Array(input)]
      limiter.process(channels)

      // After sufficient samples, output should be at or near threshold
      for (let i = 100; i < channels[0]!.length; i++) {
        assert.ok(
          Math.abs(channels[0]![i] ?? 0) <= THRESHOLD_LIN + 0.01,
          `sample ${i}: ${channels[0]![i]} exceeds threshold ${THRESHOLD_LIN}`
        )
      }
    })

    it('returns Float32Array[] with same channel count', () => {
      const limiter   = new LimiterProcessor()
      const channels  = [new Float32Array(100), new Float32Array(100)]
      const result    = limiter.process(channels)
      assert.strictEqual(result.length, 2)
      assert.ok(result[0] instanceof Float32Array)
      assert.ok(result[1] instanceof Float32Array)
    })

    it('processes multiple channels', () => {
      const limiter  = new LimiterProcessor({ thresholdDb: -0.3 })
      const ch1      = new Float32Array(500).fill(2.0)
      const ch2      = new Float32Array(500).fill(2.0)
      limiter.process([ch1, ch2])

      // Both channels should be reduced
      for (let i = 200; i < 500; i++) {
        assert.ok(Math.abs(ch1[i] ?? 0) <= THRESHOLD_LIN + 0.01)
        assert.ok(Math.abs(ch2[i] ?? 0) <= THRESHOLD_LIN + 0.01)
      }
    })

    it('empty channels array returns empty array', () => {
      const limiter = new LimiterProcessor()
      const result  = limiter.process([])
      assert.strictEqual(result.length, 0)
    })
  })

  describe('reset()', () => {
    it('reset() resets envelope state — silence after reset produces gain near 1', () => {
      const limiter = new LimiterProcessor({ thresholdDb: -0.3 })
      // First push the limiter hard
      const loud = new Float32Array(1000).fill(2.0)
      limiter.process([loud])

      // Reset
      limiter.reset()

      // Now process silence — gain should be 1.0 (no holdover)
      const silence = new Float32Array(100).fill(0.0)
      const result  = limiter.process([silence])

      for (let i = 0; i < result[0]!.length; i++) {
        assert.strictEqual(result[0]![i], 0.0, 'silence should remain silence after reset')
      }
    })
  })

  describe('currentGainDb', () => {
    it('returns 0 dB or below after processing loud signal', () => {
      const limiter = new LimiterProcessor({ thresholdDb: -0.3 })
      const loud    = new Float32Array(1000).fill(2.0)
      limiter.process([loud])
      assert.ok(limiter.currentGainDb <= 0, 'gain should be <= 0 dB after limiting')
    })

    it('returns a finite number', () => {
      const limiter = new LimiterProcessor()
      assert.ok(isFinite(limiter.currentGainDb))
    })
  })
})
