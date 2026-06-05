import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EQSuggestionEngine } from '../../src/renderer/src/audio/mixing/EQSuggestionEngine.ts'
import { FrequencyAnalyzer } from '../../src/renderer/src/audio/analysis/FrequencyAnalyzer.ts'

const SR = 44100

function makeSine(freq: number, sr: number, n: number, amplitude = 0.5): Float32Array {
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

function makeSpectrum(freq: number, sr: number, n = 2048) {
  const analyzer = new FrequencyAnalyzer()
  const buf = makeSine(freq, sr, n)
  return analyzer.analyzeSpectrum(buf, sr, n)
}

describe('EQSuggestionEngine', () => {
  const engine = new EQSuggestionEngine()

  describe('suggestEQ() — kick', () => {
    it('kick → at least 1 suggestion with valid fields', () => {
      const spectrum = makeSpectrum(80, SR)
      const suggestions = engine.suggestEQ(spectrum, 'Kick Drum', 'kick')
      assert.ok(suggestions.length >= 1, 'expected ≥1 suggestion for kick')
      for (const s of suggestions) {
        assert.ok(typeof s.frequencyHz === 'number' && s.frequencyHz > 0, `frequencyHz ${s.frequencyHz}`)
        assert.ok(typeof s.gainDb === 'number', `gainDb ${s.gainDb}`)
        assert.ok(typeof s.qFactor === 'number' && s.qFactor > 0, `qFactor ${s.qFactor}`)
        assert.ok(['critical', 'recommended', 'optional'].includes(s.priority), `priority ${s.priority}`)
      }
    })
  })

  describe('suggestEQ() — bass', () => {
    it('bass → includes HP suggestion at ~40 Hz', () => {
      const spectrum = makeSpectrum(100, SR)
      const suggestions = engine.suggestEQ(spectrum, 'Bass', 'bass')
      const hp = suggestions.find((s) => s.type === 'highpass')
      assert.ok(hp !== undefined, 'expected a highpass suggestion for bass')
      assert.ok(
        Math.abs((hp?.frequencyHz ?? 0) - 40) < 20,
        `expected HP near 40 Hz, got ${hp?.frequencyHz}`,
      )
    })
  })

  describe('suggestEQ() — pad', () => {
    it('pad → includes HP at ~120 Hz', () => {
      const spectrum = makeSpectrum(440, SR)
      const suggestions = engine.suggestEQ(spectrum, 'Pad', 'pad')
      const hp = suggestions.find((s) => s.type === 'highpass')
      assert.ok(hp !== undefined, 'expected a highpass suggestion for pad')
      assert.ok(
        Math.abs((hp?.frequencyHz ?? 0) - 120) < 30,
        `expected HP near 120 Hz, got ${hp?.frequencyHz}`,
      )
    })
  })

  describe('suggestEQ() — priority validation', () => {
    it('all suggestions have valid priority', () => {
      const types: Array<'kick' | 'bass' | 'snare' | 'vocals' | 'pad' | 'guitar'> = [
        'kick', 'bass', 'snare', 'vocals', 'pad', 'guitar',
      ]
      for (const type of types) {
        const spectrum = makeSpectrum(440, SR)
        const suggestions = engine.suggestEQ(spectrum, type, type)
        for (const s of suggestions) {
          assert.ok(
            ['critical', 'recommended', 'optional'].includes(s.priority),
            `${type}: unexpected priority '${s.priority}'`,
          )
        }
      }
    })
  })
})
