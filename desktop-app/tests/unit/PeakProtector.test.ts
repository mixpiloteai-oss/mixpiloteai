import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PeakProtector, peakProtector } from '../../src/renderer/src/audio/export/PeakProtector.ts'

describe('PeakProtector', () => {
  const pp = new PeakProtector()

  describe('analyze()', () => {
    it('buffer with max 1.5: hasTruePeakViolation=true', () => {
      const buf  = new Float32Array([0.5, 1.5, -1.0, 0.8])
      const result = pp.analyze([buf])
      assert.ok(result.hasTruePeakViolation, 'should detect violation for max 1.5')
    })

    it('buffer with max 1.5: suggestedGainReduction ≈ 1/1.5 ≈ 0.667', () => {
      const buf  = new Float32Array([0.0, 1.5, 0.0])
      const result = pp.analyze([buf])
      assert.ok(Math.abs(result.suggestedGainReduction - (1 / 1.5)) < 0.01,
        `expected ≈ 0.667, got ${result.suggestedGainReduction}`)
    })

    it('buffer with max 0.9: hasTruePeakViolation=false', () => {
      const buf  = new Float32Array([0.5, 0.9, -0.8, 0.3])
      const result = pp.analyze([buf])
      assert.ok(!result.hasTruePeakViolation, 'should not detect violation for max 0.9')
    })

    it('buffer with max 0.9: suggestedGainReduction = 1.0', () => {
      const buf  = new Float32Array([0.5, 0.9, -0.8])
      const result = pp.analyze([buf])
      assert.strictEqual(result.suggestedGainReduction, 1.0)
    })

    it('violationCount > 0 when peaks exceed threshold', () => {
      const buf  = new Float32Array([1.5, 1.2, 1.3, 0.5])
      const result = pp.analyze([buf])
      assert.ok(result.violationCount > 0, 'should have violation count > 0')
    })

    it('violationCount = 0 when no peaks exceed threshold', () => {
      const buf  = new Float32Array([0.3, 0.5, 0.7, 0.9])
      const result = pp.analyze([buf])
      assert.strictEqual(result.violationCount, 0)
    })

    it('empty channels: returns no violation', () => {
      const result = pp.analyze([])
      assert.ok(!result.hasTruePeakViolation)
      assert.strictEqual(result.maxTruePeak, 0)
      assert.strictEqual(result.violationCount, 0)
      assert.strictEqual(result.suggestedGainReduction, 1.0)
    })

    it('maxTruePeak ≥ actual peak (within Float32 precision)', () => {
      // 4x oversampling may find inter-sample peaks higher than actual samples
      // Note: Float32Array stores 0.9 as 0.8999999761581421
      const buf  = new Float32Array([0.8, 0.9, 0.8])
      const result = pp.analyze([buf])
      // The true peak should be at least the value stored in Float32Array (≈ 0.8999...)
      const storedPeak = buf[1]!   // the actual stored float32 value
      assert.ok(result.maxTruePeak >= storedPeak,
        `maxTruePeak ${result.maxTruePeak} should be >= stored peak ${storedPeak}`)
    })

    it('multi-channel: finds violation across any channel', () => {
      const ch1 = new Float32Array([0.5, 0.5])
      const ch2 = new Float32Array([0.5, 1.5])
      const result = pp.analyze([ch1, ch2])
      assert.ok(result.hasTruePeakViolation, 'should detect violation in ch2')
    })
  })

  describe('applyGainReduction()', () => {
    it('applies gain to all channels, result max ≤ 1.0', () => {
      const ch1  = new Float32Array([1.5, -1.2, 0.8])
      const ch2  = new Float32Array([1.1, 0.5, -1.3])
      const gain = 1 / 1.5  // ≈ 0.667
      const out  = pp.applyGainReduction([ch1, ch2], gain)

      for (let c = 0; c < out.length; c++) {
        for (let i = 0; i < out[c]!.length; i++) {
          assert.ok(Math.abs(out[c]![i] ?? 0) <= 1.0 + 0.001,
            `channel ${c}, sample ${i}: ${out[c]![i]} exceeds 1.0`)
        }
      }
    })

    it('does not modify original arrays', () => {
      const ch   = new Float32Array([1.5, 1.0])
      const orig = new Float32Array(ch)
      pp.applyGainReduction([ch], 0.5)
      assert.strictEqual(ch[0], orig[0], 'original should be unchanged')
    })

    it('gain=1.0 returns identical values', () => {
      const ch  = new Float32Array([0.5, -0.3, 0.8])
      const out = pp.applyGainReduction([ch], 1.0)
      for (let i = 0; i < ch.length; i++) {
        assert.ok(Math.abs((out[0]?.[i] ?? 0) - (ch[i] ?? 0)) < 1e-10)
      }
    })
  })

  describe('singleton', () => {
    it('peakProtector is a PeakProtector instance', () => {
      assert.ok(peakProtector instanceof PeakProtector)
    })
  })
})
