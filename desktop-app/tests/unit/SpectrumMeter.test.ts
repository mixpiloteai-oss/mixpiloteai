import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SpectrumMeter } from '../../src/renderer/src/audio/meters/SpectrumMeter.ts'
import { FrequencyAnalyzer } from '../../src/renderer/src/audio/analysis/FrequencyAnalyzer.ts'

const SR = 44100

function makeSine(freq: number, sr: number, n: number, amplitude = 0.5): Float32Array {
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

describe('SpectrumMeter', () => {
  const meter    = new SpectrumMeter()
  const analyzer = new FrequencyAnalyzer()

  describe('computeBarHeights()', () => {
    it('returns exactly 64 values for a valid spectrum', () => {
      const buf      = makeSine(440, SR, 2048)
      const spectrum = analyzer.analyzeSpectrum(buf, SR, 2048)
      const bars     = meter.computeBarHeights(spectrum, 64, SR)
      assert.strictEqual(bars.length, 64)
    })

    it('all bar values are finite numbers (not NaN or Infinity)', () => {
      const buf      = makeSine(1000, SR, 2048)
      const spectrum = analyzer.analyzeSpectrum(buf, SR, 2048)
      const bars     = meter.computeBarHeights(spectrum, 64, SR)
      for (let i = 0; i < bars.length; i++) {
        const v = bars[i] ?? NaN
        assert.ok(!isNaN(v), `bar ${i} is NaN`)
        assert.ok(isFinite(v) || v === -120, `bar ${i} is unexpected value ${v}`)
      }
    })
  })

  describe('computeSmoothedSpectrum()', () => {
    it('smoothing=1.0 → result matches prev', () => {
      const prev  = new Float32Array([1, 2, 3, 4])
      const next  = new Float32Array([5, 6, 7, 8])
      const result = meter.computeSmoothedSpectrum(prev, next, 1.0)
      for (let i = 0; i < prev.length; i++) {
        assert.ok(
          Math.abs((result[i] ?? 0) - (prev[i] ?? 0)) < 0.001,
          `smoothing=1.0: expected prev[${i}]=${prev[i]}, got ${result[i]}`,
        )
      }
    })

    it('smoothing=0.0 → result matches next', () => {
      const prev  = new Float32Array([1, 2, 3, 4])
      const next  = new Float32Array([5, 6, 7, 8])
      const result = meter.computeSmoothedSpectrum(prev, next, 0.0)
      for (let i = 0; i < next.length; i++) {
        assert.ok(
          Math.abs((result[i] ?? 0) - (next[i] ?? 0)) < 0.001,
          `smoothing=0.0: expected next[${i}]=${next[i]}, got ${result[i]}`,
        )
      }
    })

    it('smoothing=0.5 → result is midpoint', () => {
      const prev  = new Float32Array([0, 10])
      const next  = new Float32Array([10, 0])
      const result = meter.computeSmoothedSpectrum(prev, next, 0.5)
      assert.ok(Math.abs((result[0] ?? 0) - 5) < 0.001, `expected 5, got ${result[0]}`)
      assert.ok(Math.abs((result[1] ?? 0) - 5) < 0.001, `expected 5, got ${result[1]}`)
    })
  })
})
