import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { softClip, processChannel, processBuffer } from '../../src/renderer/src/audio/export/SoftClipper.ts'

describe('SoftClipper', () => {
  describe('softClip()', () => {
    it('linear zone: softClip(0.5, 0.95) returns 0.5 unchanged', () => {
      const result = softClip(0.5, 0.95)
      assert.strictEqual(result, 0.5)
    })

    it('linear zone: softClip(0.0, 0.95) returns 0', () => {
      const result = softClip(0.0, 0.95)
      assert.strictEqual(result, 0.0)
    })

    it('linear zone: softClip(-0.5, 0.95) returns -0.5', () => {
      const result = softClip(-0.5, 0.95)
      assert.strictEqual(result, -0.5)
    })

    it('soft zone: softClip(1.5, 0.95) returns a value < 1.5 and > 0.95', () => {
      const result = softClip(1.5, 0.95)
      assert.ok(result < 1.5, `expected < 1.5, got ${result}`)
      assert.ok(result > 0.95, `expected > 0.95 (threshold), got ${result}`)
    })

    it('soft zone: softClip(-1.5, 0.95) returns negative value with correct shape', () => {
      const result = softClip(-1.5, 0.95)
      assert.ok(result < -0.95, `expected < -0.95, got ${result}`)
      assert.ok(result > -1.5, `expected > -1.5, got ${result}`)
    })

    it('symmetry: softClip(-x) === -softClip(x)', () => {
      const x = 1.2
      const pos = softClip(x, 0.95)
      const neg = softClip(-x, 0.95)
      assert.ok(Math.abs(pos + neg) < 1e-10, 'not symmetric')
    })

    it('extreme input 10.0 is bounded to near 1.0', () => {
      const result = softClip(10.0, 0.95)
      assert.ok(result < 1.1, `extreme input should produce bounded output, got ${result}`)
    })

    it('exact threshold: softClip(0.95, 0.95) returns 0.95', () => {
      // At the threshold boundary, should be linear
      const result = softClip(0.95, 0.95)
      assert.ok(Math.abs(result - 0.95) < 1e-10, `expected 0.95, got ${result}`)
    })
  })

  describe('processChannel()', () => {
    it('returns Float32Array of same length', () => {
      const buf = new Float32Array(256).fill(0.5)
      const out = processChannel(buf, 0.95)
      assert.ok(out instanceof Float32Array)
      assert.strictEqual(out.length, buf.length)
    })

    it('values in linear zone are unchanged', () => {
      const buf = new Float32Array([0.1, 0.5, -0.3, 0.9])
      const out = processChannel(buf, 0.95)
      for (let i = 0; i < buf.length; i++) {
        assert.ok(Math.abs((out[i] ?? 0) - (buf[i] ?? 0)) < 1e-10,
          `sample ${i}: expected ${buf[i]}, got ${out[i]}`)
      }
    })

    it('values above threshold are soft-clipped', () => {
      const buf = new Float32Array([1.0, 1.5, 2.0])
      const out = processChannel(buf, 0.95)
      for (let i = 0; i < out.length; i++) {
        assert.ok((out[i] ?? 0) <= 1.0 + 0.05, `sample ${i} not bounded: ${out[i]}`)
      }
    })
  })

  describe('processBuffer()', () => {
    it('processes all channels, returns same shape', () => {
      const ch1 = new Float32Array(100).fill(0.5)
      const ch2 = new Float32Array(100).fill(1.5)
      const out = processBuffer([ch1, ch2], 0.95)

      assert.strictEqual(out.length, 2)
      assert.strictEqual(out[0]?.length, 100)
      assert.strictEqual(out[1]?.length, 100)
    })

    it('linear zone values unchanged across channels', () => {
      const ch = new Float32Array([0.3, 0.8, -0.5])
      const [outCh] = processBuffer([ch], 0.95)
      for (let i = 0; i < ch.length; i++) {
        assert.ok(Math.abs((outCh?.[i] ?? 0) - (ch[i] ?? 0)) < 1e-10)
      }
    })

    it('empty channels array returns empty array', () => {
      const out = processBuffer([], 0.95)
      assert.strictEqual(out.length, 0)
    })
  })
})
