import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LoudnessMeter, loudnessMeter } from '../../src/renderer/src/audio/export/LoudnessMeter.ts'

const SR = 44100

/** Generate a sine wave buffer. */
function makeSine(freq: number, sr: number, seconds: number, amplitude = 1.0): Float32Array {
  const n   = Math.floor(sr * seconds)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

describe('LoudnessMeter', () => {
  const meter = new LoudnessMeter()

  describe('measureRms()', () => {
    it('silence (all zeros): returns -Infinity', () => {
      const buf = new Float32Array(1000)
      assert.strictEqual(meter.measureRms(buf), -Infinity)
    })

    it('full-scale sine: ≈ -3.01 dB (RMS = 1/√2)', () => {
      // RMS of A·sin = A/√2; for A=1: RMS = 1/√2 ≈ 0.707, dB ≈ -3.01
      const sine = makeSine(440, SR, 1.0, 1.0)
      const rms  = meter.measureRms(sine)
      assert.ok(Math.abs(rms - (-3.01)) < 0.1, `expected ≈ -3.01 dB, got ${rms}`)
    })

    it('half-scale sine: ≈ -9 dB', () => {
      const sine = makeSine(440, SR, 1.0, 0.5)
      const rms  = meter.measureRms(sine)
      assert.ok(Math.abs(rms - (-9.03)) < 0.2, `expected ≈ -9 dB, got ${rms}`)
    })

    it('constant 1.0: returns 0 dB', () => {
      const buf = new Float32Array(1000).fill(1.0)
      const rms = meter.measureRms(buf)
      assert.ok(Math.abs(rms - 0) < 0.001, `expected 0 dB, got ${rms}`)
    })

    it('empty buffer: returns -Infinity', () => {
      const rms = meter.measureRms(new Float32Array(0))
      assert.strictEqual(rms, -Infinity)
    })
  })

  describe('measurePeak()', () => {
    it('buffer with max 0.5: returns ≈ -6 dB', () => {
      const buf = new Float32Array([0.0, 0.3, 0.5, -0.2, 0.4])
      const peak = meter.measurePeak(buf)
      // 20*log10(0.5) = -6.02 dB
      assert.ok(Math.abs(peak - (-6.02)) < 0.05, `expected ≈ -6.02 dB, got ${peak}`)
    })

    it('silence: returns -Infinity', () => {
      const buf = new Float32Array(100)
      assert.strictEqual(meter.measurePeak(buf), -Infinity)
    })

    it('full-scale (1.0): returns 0 dB', () => {
      const buf = new Float32Array([0.5, 1.0, -0.5])
      const peak = meter.measurePeak(buf)
      assert.ok(Math.abs(peak - 0) < 0.001, `expected 0 dB, got ${peak}`)
    })

    it('full-scale negative (-1.0): returns 0 dB', () => {
      const buf = new Float32Array([-1.0, 0.5])
      const peak = meter.measurePeak(buf)
      assert.ok(Math.abs(peak - 0) < 0.001, `expected 0 dB, got ${peak}`)
    })
  })

  describe('measureIntegratedLoudness()', () => {
    it('empty channels: returns all -Infinity', () => {
      const result = meter.measureIntegratedLoudness([], SR)
      assert.strictEqual(result.rmsDb, -Infinity)
      assert.strictEqual(result.peakDb, -Infinity)
      assert.strictEqual(result.truePeakDb, -Infinity)
    })

    it('silence: returns -Infinity loudness', () => {
      const silence = new Float32Array(SR)
      const result  = meter.measureIntegratedLoudness([silence, silence], SR)
      assert.strictEqual(result.rmsDb, -Infinity)
    })

    it('truePeak detection: buffer with max 0.9 → truePeakDb ≈ -0.92 dB (within 1 dB)', () => {
      // 20*log10(0.9) ≈ -0.915 dB
      const buf    = new Float32Array(SR).fill(0.9)
      const result = meter.measureIntegratedLoudness([buf], SR)
      assert.ok(Math.abs(result.truePeakDb - (-0.915)) < 1.0,
        `truePeakDb: expected ≈ -0.92 dB, got ${result.truePeakDb}`)
    })

    it('dynamicRange = peakDb - rmsDb (positive for typical sine wave)', () => {
      const sine   = makeSine(440, SR, 1.0, 0.8)
      const result = meter.measureIntegratedLoudness([sine], SR)
      // Peak is 0.8 (-1.94 dB), RMS is 0.8/√2 (-4.95 dB), DR ≈ 3.01 dB
      assert.ok(result.dynamicRange > 0, `dynamicRange should be positive for sine wave, got ${result.dynamicRange}`)
    })

    it('crestFactor = truePeakDb - rmsDb', () => {
      const sine   = makeSine(440, SR, 0.5, 0.7)
      const result = meter.measureIntegratedLoudness([sine], SR)
      const expected = result.truePeakDb - result.rmsDb
      assert.ok(Math.abs(result.crestFactor - expected) < 0.01,
        `crestFactor mismatch: ${result.crestFactor} vs ${expected}`)
    })

    it('returns a valid LoudnessMeasurement shape', () => {
      const sine   = makeSine(220, SR, 0.5)
      const result = meter.measureIntegratedLoudness([sine], SR)
      assert.ok(typeof result.rmsDb === 'number')
      assert.ok(typeof result.peakDb === 'number')
      assert.ok(typeof result.truePeakDb === 'number')
      assert.ok(typeof result.lufsApprox === 'number')
      assert.ok(typeof result.dynamicRange === 'number')
      assert.ok(typeof result.crestFactor === 'number')
    })
  })

  describe('singleton', () => {
    it('loudnessMeter is an instance of LoudnessMeter', () => {
      assert.ok(loudnessMeter instanceof LoudnessMeter)
    })
  })
})
