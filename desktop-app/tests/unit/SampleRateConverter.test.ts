import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { convertSampleRate, convertBuffer } from '../../src/renderer/src/audio/export/SampleRateConverter.ts'

describe('SampleRateConverter', () => {
  describe('convertSampleRate', () => {
    it('fromRate === toRate: returns the same buffer reference', () => {
      const buf = new Float32Array([0.1, 0.2, 0.3])
      const out = convertSampleRate(buf, 44100, 44100)
      assert.strictEqual(out, buf, 'should return same reference when rates are equal')
    })

    it('44100 → 22050: output length is approximately half of input', () => {
      const input  = new Float32Array(44100)
      const output = convertSampleRate(input, 44100, 22050)
      // Expected: Math.round(44100 * 22050 / 44100) = 22050
      assert.strictEqual(output.length, 22050)
    })

    it('22050 → 44100: output length is approximately double of input', () => {
      const input  = new Float32Array(22050)
      const output = convertSampleRate(input, 22050, 44100)
      assert.strictEqual(output.length, 44100)
    })

    it('converted signal preserves DC value (constant 0.5 input → approx 0.5 output)', () => {
      const n     = 1000
      const input = new Float32Array(n).fill(0.5)
      const out   = convertSampleRate(input, 44100, 22050)

      // All output samples should be approximately 0.5 (DC preserved through resampling)
      for (let i = 0; i < out.length; i++) {
        assert.ok(Math.abs((out[i] ?? 0) - 0.5) < 0.001,
          `sample ${i}: expected ~0.5, got ${out[i]}`)
      }
    })

    it('upsample 2x: output length is correct', () => {
      const input = new Float32Array(100)
      const out   = convertSampleRate(input, 22050, 44100)
      assert.strictEqual(out.length, 200)
    })

    it('arbitrary ratio: 44100 → 48000', () => {
      const input    = new Float32Array(44100)
      const expected = Math.round(44100 * 48000 / 44100)  // = 48000
      const out      = convertSampleRate(input, 44100, 48000)
      assert.strictEqual(out.length, expected)
    })

    it('preserves zero samples through resampling', () => {
      const input = new Float32Array(100)  // all zeros
      const out   = convertSampleRate(input, 44100, 22050)
      for (let i = 0; i < out.length; i++) {
        assert.strictEqual(out[i], 0, `sample ${i} should be 0`)
      }
    })
  })

  describe('convertBuffer', () => {
    it('applies conversion to all channels independently', () => {
      const ch1 = new Float32Array(1000).fill(0.3)
      const ch2 = new Float32Array(1000).fill(0.7)
      const out = convertBuffer([ch1, ch2], 44100, 22050)

      assert.strictEqual(out.length, 2, 'should have 2 output channels')
      assert.strictEqual(out[0]?.length, 500, 'ch1 should be half length')
      assert.strictEqual(out[1]?.length, 500, 'ch2 should be half length')

      // DC values preserved
      for (let i = 0; i < (out[0]?.length ?? 0); i++) {
        assert.ok(Math.abs((out[0]?.[i] ?? 0) - 0.3) < 0.001, `ch1 sample ${i} off`)
        assert.ok(Math.abs((out[1]?.[i] ?? 0) - 0.7) < 0.001, `ch2 sample ${i} off`)
      }
    })

    it('returns empty array for empty input', () => {
      const out = convertBuffer([], 44100, 22050)
      assert.strictEqual(out.length, 0)
    })

    it('same rate: returns same references', () => {
      const ch = new Float32Array(100)
      const out = convertBuffer([ch], 44100, 44100)
      assert.strictEqual(out[0], ch, 'same rate should return same reference')
    })
  })
})
