import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { StereoAnalyzer } from '../../src/renderer/src/audio/analysis/StereoAnalyzer.ts'

const SR = 44100

function makeSine(freq: number, sr: number, seconds: number, amplitude = 1.0): Float32Array {
  const n   = Math.floor(sr * seconds)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

describe('StereoAnalyzer', () => {
  const analyzer = new StereoAnalyzer()

  describe('analyzeStereo() — correlation', () => {
    it('identical buffers → correlation ≈ 1.0 (±0.001)', () => {
      const buf    = makeSine(440, SR, 0.5)
      const result = analyzer.analyzeStereo(buf, buf)
      assert.ok(
        Math.abs(result.correlation - 1.0) < 0.001,
        `expected 1.0, got ${result.correlation}`,
      )
    })

    it('inverted buffer → correlation ≈ -1.0 (±0.001)', () => {
      const buf     = makeSine(440, SR, 0.5, 0.8)
      const inv     = new Float32Array(buf.length)
      for (let i = 0; i < buf.length; i++) inv[i] = -(buf[i] ?? 0)
      const result  = analyzer.analyzeStereo(buf, inv)
      assert.ok(
        Math.abs(result.correlation - (-1.0)) < 0.001,
        `expected -1.0, got ${result.correlation}`,
      )
    })
  })

  describe('analyzeStereo() — stereoWidth', () => {
    it('identical (mono) channels → stereoWidth ≈ 0.0 (±0.01)', () => {
      const buf    = makeSine(440, SR, 0.5)
      const result = analyzer.analyzeStereo(buf, buf)
      assert.ok(
        result.stereoWidth < 0.01,
        `expected ~0.0, got ${result.stereoWidth}`,
      )
    })
  })

  describe('detectPhaseIssues()', () => {
    it('inverted right channel → at least 1 critical phase issue', () => {
      const left = makeSine(440, SR, 0.5, 0.8)
      const right = new Float32Array(left.length)
      for (let i = 0; i < left.length; i++) right[i] = -(left[i] ?? 0)
      const issues = analyzer.detectPhaseIssues(left, right, SR)
      const critical = issues.filter((i) => i.severity === 'critical')
      assert.ok(critical.length >= 1, `expected ≥1 critical issue, got ${critical.length}`)
    })
  })

  describe('analyzeStereo() — monoCompatibility', () => {
    it('identical channels → monoCompatibility ≈ 1.0', () => {
      const buf    = makeSine(440, SR, 0.5)
      const result = analyzer.analyzeStereo(buf, buf)
      assert.ok(
        Math.abs(result.monoCompatibility - 1.0) < 0.001,
        `expected 1.0, got ${result.monoCompatibility}`,
      )
    })
  })

  describe('computeGoniometer()', () => {
    it('mono signal → side channel near zero', () => {
      const buf  = makeSine(440, SR, 0.1)
      const data = analyzer.computeGoniometer(buf, buf)

      let maxSide = 0
      for (let i = 0; i < data.side.length; i++) {
        maxSide = Math.max(maxSide, Math.abs(data.side[i] ?? 0))
      }

      assert.ok(
        maxSide < 0.001,
        `mono signal side should be near 0, got max ${maxSide}`,
      )
    })
  })
})
