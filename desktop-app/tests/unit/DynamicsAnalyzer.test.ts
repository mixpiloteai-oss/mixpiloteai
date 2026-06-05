import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DynamicsAnalyzer } from '../../src/renderer/src/audio/analysis/DynamicsAnalyzer.ts'

const SR = 44100

function makeSine(freq: number, sr: number, seconds: number, amplitude = 1.0): Float32Array {
  const n   = Math.floor(sr * seconds)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

describe('DynamicsAnalyzer', () => {
  const analyzer = new DynamicsAnalyzer()

  describe('analyzeDynamics() — peakDb', () => {
    it('amplitude 0.5 → peakDb ≈ -6.02 dBFS (±0.1)', () => {
      const buf = new Float32Array(1000).fill(0.5)
      const result = analyzer.analyzeDynamics(buf, SR)
      assert.ok(
        Math.abs(result.peakDb - (-6.02)) < 0.1,
        `expected ≈ -6.02, got ${result.peakDb}`,
      )
    })
  })

  describe('analyzeDynamics() — rmsDb', () => {
    it('full-scale sine → rmsDb ≈ -3 dBFS (±0.1)', () => {
      const sine   = makeSine(440, SR, 1.0, 1.0)
      const result = analyzer.analyzeDynamics(sine, SR)
      // RMS of unit sine = 1/√2, 20*log10(1/√2) ≈ -3.01 dB
      assert.ok(
        Math.abs(result.rmsDb - (-3.01)) < 0.1,
        `expected ≈ -3.01, got ${result.rmsDb}`,
      )
    })
  })

  describe('detectClipping()', () => {
    it('Float32Array of all 1.0 → isClipping=true', () => {
      const buf    = new Float32Array(1000).fill(1.0)
      const result = analyzer.detectClipping(buf)
      assert.strictEqual(result.isClipping, true)
    })

    it('sine wave amplitude 0.5 → isClipping=false', () => {
      const sine   = makeSine(440, SR, 0.5, 0.5)
      const result = analyzer.detectClipping(sine)
      assert.strictEqual(result.isClipping, false)
    })

    it('clippingPercentage: all 1.0 → 100%', () => {
      const buf    = new Float32Array(500).fill(1.0)
      const result = analyzer.detectClipping(buf)
      assert.ok(result.clippingPercentage > 99, `expected ~100%, got ${result.clippingPercentage}`)
    })
  })

  describe('analyzeDynamics() — crestFactor', () => {
    it('impulse has higher crestFactor than continuous sine', () => {
      // Impulse: single 1.0 sample in silence → very high crest
      const impulse = new Float32Array(SR)
      impulse[100]  = 1.0
      const rImpulse = analyzer.analyzeDynamics(impulse, SR)

      const sine    = makeSine(440, SR, 1.0, 0.5)
      const rSine   = analyzer.analyzeDynamics(sine, SR)

      assert.ok(
        rImpulse.crestFactor > rSine.crestFactor,
        `impulse crest ${rImpulse.crestFactor.toFixed(1)} should > sine crest ${rSine.crestFactor.toFixed(1)}`,
      )
    })
  })

  describe('computeLUFS()', () => {
    it('silence → -Infinity', () => {
      const buf  = new Float32Array(SR)
      const lufs = analyzer.computeLUFS(buf, SR)
      assert.ok(!isFinite(lufs), `expected -Infinity for silence, got ${lufs}`)
    })

    it('loud signal → finite LUFS value', () => {
      const buf  = makeSine(440, SR, 2.0, 0.8)
      const lufs = analyzer.computeLUFS(buf, SR)
      assert.ok(
        isFinite(lufs),
        `expected finite LUFS for loud sine, got ${lufs}`,
      )
    })
  })
})
