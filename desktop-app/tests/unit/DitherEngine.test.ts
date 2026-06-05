import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyDither } from '../../src/renderer/src/audio/export/DitherEngine.ts'

describe('DitherEngine', () => {
  describe("type='none'", () => {
    it('returns the same buffer reference unchanged', () => {
      const buf = new Float32Array([0.1, 0.5, -0.3, 0.0])
      const out = applyDither(buf, 16, 'none')
      assert.strictEqual(out, buf, 'should return same reference for type=none')
    })

    it('values are identical to input', () => {
      const buf = new Float32Array([0.25, -0.5, 0.75, -0.9, 0.0])
      const out = applyDither(buf, 16, 'none')
      for (let i = 0; i < buf.length; i++) {
        assert.strictEqual(out[i], buf[i])
      }
    })
  })

  describe("type='tpdf'", () => {
    it('output differs from input by no more than 2/(2^bitDepth) at 16-bit', () => {
      const bitDepth  = 16
      const amplitude = 1 / Math.pow(2, bitDepth)
      const maxDiff   = 2 * amplitude  // TPDF: two random values, max total swing = amplitude * 2

      const buf = new Float32Array(1000).fill(0.5)
      const out = applyDither(buf, bitDepth, 'tpdf')

      for (let i = 0; i < buf.length; i++) {
        const diff = Math.abs((out[i] ?? 0) - (buf[i] ?? 0))
        assert.ok(diff <= maxDiff + 1e-10, `sample ${i} diff ${diff} > max ${maxDiff}`)
      }
    })

    it('output length equals input length', () => {
      const buf = new Float32Array(512)
      const out = applyDither(buf, 16, 'tpdf')
      assert.strictEqual(out.length, buf.length)
    })

    it('all output values are clamped to [-1, 1]', () => {
      const buf = new Float32Array(500).fill(0.9999)
      const out = applyDither(buf, 16, 'tpdf')
      for (let i = 0; i < out.length; i++) {
        assert.ok((out[i] ?? 0) >= -1 && (out[i] ?? 0) <= 1, `value out of [-1,1]: ${out[i]}`)
      }
    })

    it('clamping at -1 boundary', () => {
      const buf = new Float32Array(200).fill(-0.9999)
      const out = applyDither(buf, 16, 'tpdf')
      for (let i = 0; i < out.length; i++) {
        assert.ok((out[i] ?? 0) >= -1, `value below -1: ${out[i]}`)
      }
    })
  })

  describe("type='rectangular'", () => {
    it('output differs from input by no more than 1/(2^bitDepth)', () => {
      const bitDepth  = 16
      const amplitude = 0.5 / Math.pow(2, bitDepth)
      const maxDiff   = amplitude * 2  // rectangular: range is [-amp, amp]

      const buf = new Float32Array(1000).fill(0.3)
      const out = applyDither(buf, bitDepth, 'rectangular')

      for (let i = 0; i < buf.length; i++) {
        const diff = Math.abs((out[i] ?? 0) - (buf[i] ?? 0))
        assert.ok(diff <= maxDiff + 1e-10, `sample ${i} diff ${diff} > max ${maxDiff}`)
      }
    })

    it('output length equals input length', () => {
      const buf = new Float32Array(256)
      const out = applyDither(buf, 24, 'rectangular')
      assert.strictEqual(out.length, buf.length)
    })

    it('all output values are clamped to [-1, 1]', () => {
      const buf = new Float32Array(200).fill(0.9999)
      const out = applyDither(buf, 24, 'rectangular')
      for (let i = 0; i < out.length; i++) {
        assert.ok((out[i] ?? 0) >= -1 && (out[i] ?? 0) <= 1, `value out of range: ${out[i]}`)
      }
    })

    it('24-bit dither has smaller amplitude than 16-bit', () => {
      // 24-bit amplitude = 0.5/2^24 ≈ 2.98e-8; 16-bit = 0.5/2^16 ≈ 7.63e-6
      const buf16 = new Float32Array(500).fill(0.5)
      const buf24 = new Float32Array(500).fill(0.5)
      const out16 = applyDither(buf16, 16, 'rectangular')
      const out24 = applyDither(buf24, 24, 'rectangular')

      let maxDiff16 = 0
      let maxDiff24 = 0
      for (let i = 0; i < buf16.length; i++) {
        maxDiff16 = Math.max(maxDiff16, Math.abs((out16[i] ?? 0) - 0.5))
        maxDiff24 = Math.max(maxDiff24, Math.abs((out24[i] ?? 0) - 0.5))
      }
      assert.ok(maxDiff16 > maxDiff24, '16-bit should have more dither noise than 24-bit')
    })
  })
})
