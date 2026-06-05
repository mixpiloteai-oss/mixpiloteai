import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GainStagingAnalyzer } from '../../src/renderer/src/audio/analysis/GainStagingAnalyzer.ts'

const SR = 44100

function makeSine(freq: number, sr: number, seconds: number, amplitude = 1.0): Float32Array {
  const n   = Math.floor(sr * seconds)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

// RMS amplitude for a target dBFS level
// dBFS = 20*log10(rms) → rms = 10^(dBFS/20)
// For a sine: amplitude = rms * √2
function amplitudeForRmsDb(rmsDb: number): number {
  const rms = Math.pow(10, rmsDb / 20)
  return rms * Math.SQRT2
}

describe('GainStagingAnalyzer', () => {
  const analyzer = new GainStagingAnalyzer()

  describe('analyzeGainStaging()', () => {
    it('track at -30 dBRMS → gain advice suggests positive adjustment', () => {
      // -30 dBRMS sine: amplitude = 10^(-30/20) * √2 ≈ 0.0447
      const amp = amplitudeForRmsDb(-30)
      const buf = makeSine(440, SR, 1.0, amp)
      const result = analyzer.analyzeGainStaging([{ id: 't1', name: 'Track 1', buffer: buf }])
      const advice = result.tracks[0]!

      assert.ok(
        advice.gainAdjustmentDb > 0,
        `track at -30 dBRMS should suggest gain increase, got ${advice.gainAdjustmentDb}`,
      )
    })

    it('track at ~-3 dBRMS (hot) → needsGainReduction=true', () => {
      // -3 dBRMS: amplitude ≈ 1.0 (close to full scale)
      const amp = amplitudeForRmsDb(-3)
      // Clamp amplitude at 1.0 to avoid actual clipping
      const clampedAmp = Math.min(amp, 0.98)
      const buf = makeSine(440, SR, 1.0, clampedAmp)
      const result = analyzer.analyzeGainStaging([{ id: 't2', name: 'Hot Track', buffer: buf }])
      const advice = result.tracks[0]!

      assert.ok(
        advice.needsGainReduction,
        `track at -3 dBRMS should need gain reduction, got needsGainReduction=${advice.needsGainReduction}, rmsDb=${advice.currentRmsDb.toFixed(1)}`,
      )
    })

    it('suggestedMasterGain: loud mix → negative value (reduce gain)', () => {
      // Hot mix at -6 dBRMS
      const amp = amplitudeForRmsDb(-6) * Math.SQRT1_2  // ≈ 0.5
      const buf = makeSine(440, SR, 1.0, 0.9)
      const result = analyzer.analyzeGainStaging([{ id: 't3', name: 'Loud Track', buffer: buf }])

      assert.ok(
        result.suggestedMasterGain < 0,
        `loud mix should suggest reducing master gain, got ${result.suggestedMasterGain}`,
      )
    })

    it('returns TrackGainAdvice with all required fields', () => {
      const buf = makeSine(440, SR, 0.5)
      const result = analyzer.analyzeGainStaging([{ id: 't4', name: 'Track', buffer: buf }])
      const advice = result.tracks[0]!

      assert.ok(typeof advice.trackId           === 'string')
      assert.ok(typeof advice.currentRmsDb      === 'number')
      assert.ok(typeof advice.targetRmsDb       === 'number')
      assert.ok(typeof advice.gainAdjustmentDb  === 'number')
      assert.ok(typeof advice.isClipping        === 'boolean')
      assert.ok(typeof advice.needsGainReduction === 'boolean')
    })
  })
})
