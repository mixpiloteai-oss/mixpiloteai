import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CompressionSuggestionEngine } from '../../src/renderer/src/audio/mixing/CompressionSuggestionEngine.ts'
import type { DynamicsResult } from '../../src/renderer/src/audio/analysis/DynamicsAnalyzer.ts'

describe('CompressionSuggestionEngine', () => {
  const engine = new CompressionSuggestionEngine()

  function makeDynamics(crestFactor: number, rmsDb = -18): DynamicsResult {
    return {
      peakDb:       rmsDb + crestFactor,
      rmsDb,
      crestFactor,
      dynamicRange: crestFactor * 0.8,
    }
  }

  describe('suggestCompression() — crest factor', () => {
    it('high crestFactor (25 dB) → fast attack ≤ 10 ms', () => {
      const dynamics = makeDynamics(25)
      const result   = engine.suggestCompression(dynamics)
      assert.ok(
        result.attack <= 10,
        `expected attack ≤ 10 ms for high crest, got ${result.attack}`,
      )
    })

    it('low crestFactor (3 dB) → ratio ≤ 2.0', () => {
      const dynamics = makeDynamics(3)
      const result   = engine.suggestCompression(dynamics)
      assert.ok(
        result.ratio <= 2.0,
        `expected ratio ≤ 2.0 for low crest, got ${result.ratio}`,
      )
    })
  })

  describe('suggestCompression() — kick type', () => {
    it('kick → attack ≤ 10 ms and ratio ≥ 3.0', () => {
      const dynamics = makeDynamics(20)
      const result   = engine.suggestCompression(dynamics, 'kick')
      assert.ok(
        result.attack <= 10,
        `kick attack should be ≤ 10 ms, got ${result.attack}`,
      )
      assert.ok(
        result.ratio >= 3.0,
        `kick ratio should be ≥ 3.0, got ${result.ratio}`,
      )
    })
  })

  describe('suggestCompression() — makeupGain', () => {
    it('makeupGain is a finite number', () => {
      const dynamics = makeDynamics(15)
      const result   = engine.suggestCompression(dynamics)
      assert.ok(isFinite(result.makeupGain), `makeupGain should be finite, got ${result.makeupGain}`)
    })

    it('makeupGain compensates for gain reduction', () => {
      const dynamics = makeDynamics(20, -20)
      const result   = engine.suggestCompression(dynamics)
      // makeupGain should be positive or zero (compensating for reduction)
      assert.ok(result.makeupGain >= 0, `makeupGain should be ≥ 0, got ${result.makeupGain}`)
    })
  })

  describe('suggestCompression() — structure', () => {
    it('result has all required fields', () => {
      const dynamics = makeDynamics(15)
      const result   = engine.suggestCompression(dynamics)
      assert.ok(typeof result.threshold  === 'number')
      assert.ok(typeof result.ratio      === 'number')
      assert.ok(typeof result.attack     === 'number')
      assert.ok(typeof result.release    === 'number')
      assert.ok(typeof result.makeupGain === 'number')
      assert.ok(typeof result.knee       === 'number')
      assert.ok(typeof result.reason     === 'string')
      assert.ok(['critical', 'recommended', 'optional'].includes(result.priority))
    })
  })
})
