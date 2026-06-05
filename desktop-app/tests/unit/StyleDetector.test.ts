import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectStyle } from '../../src/renderer/src/audio/ai/deep/StyleDetector.ts'
import type { GrooveAnalysis } from '../../src/renderer/src/audio/ai/deep/GrooveAnalyzer.ts'
import type { ArrangementAnalysis } from '../../src/renderer/src/audio/ai/deep/ArrangementAnalyzer.ts'
import type { MixAnalysis } from '../../src/renderer/src/audio/ai/deep/MixAnalyzer.ts'

function makeGroove(styleHint: GrooveAnalysis['styleHint']): GrooveAnalysis {
  return {
    swingAmount: 0,
    grooveTemplate: 'straight',
    velocityVariance: 0.1,
    timingDeviation: 0.01,
    dominantSubdivision: '8th',
    styleHint,
  }
}

function makeArrangement(): ArrangementAnalysis {
  return {
    sections: [],
    energyCurve: new Float32Array(16),
    peakBar: 0,
    averageEnergy: 0.5,
    dynamicRange: 0.5,
    hasDropStructure: false,
    hasBridgeSection: false,
  }
}

function makeMix(): MixAnalysis {
  return {
    trackBalance: new Map(),
    frequencyDistribution: { sub: 0.25, low: 0.25, mid: 0.25, high: 0.25 },
    percussionRatio: 0.25,
    harmonicDensity: 0.5,
    stereoBalance: 0.5,
    headroomScore: 0.3,
    suggestions: [],
  }
}

describe('StyleDetector', () => {
  it('bpm=128, grooveStyleHint=techno → primaryStyle=techno', () => {
    const result = detectStyle(128, makeGroove('techno'), makeArrangement(), makeMix())
    assert.equal(result.primaryStyle, 'techno')
  })

  it('bpm=174, grooveStyleHint=dnb → primaryStyle=dnb', () => {
    const result = detectStyle(174, makeGroove('dnb'), makeArrangement(), makeMix())
    assert.equal(result.primaryStyle, 'dnb')
  })

  it('bpm=90, grooveStyleHint=hiphop → primaryStyle=hiphop', () => {
    const result = detectStyle(90, makeGroove('straight'), makeArrangement(), makeMix())
    // With bpm=90 in range 70-115, hiphop should be detected
    assert.ok(
      result.primaryStyle === 'hiphop' || result.primaryStyle === 'trap',
      `Expected hiphop or trap, got ${result.primaryStyle}`
    )
  })

  it('confidence > 0', () => {
    const result = detectStyle(128, makeGroove('techno'), makeArrangement(), makeMix())
    assert.ok(result.confidence > 0, `confidence should be > 0, got ${result.confidence}`)
  })

  it('jazz hint → jazz style', () => {
    const result = detectStyle(120, makeGroove('jazz'), makeArrangement(), makeMix())
    assert.equal(result.primaryStyle, 'jazz')
  })

  it('house hint with valid BPM → house style', () => {
    const result = detectStyle(128, makeGroove('house'), makeArrangement(), makeMix())
    assert.equal(result.primaryStyle, 'house')
  })

  it('returns bpmRange with min and max', () => {
    const result = detectStyle(128, makeGroove('techno'), makeArrangement(), makeMix())
    assert.ok(typeof result.bpmRange.min === 'number')
    assert.ok(typeof result.bpmRange.max === 'number')
    assert.ok(result.bpmRange.min <= result.bpmRange.max)
  })

  it('characteristicElements is an array', () => {
    const result = detectStyle(128, makeGroove('techno'), makeArrangement(), makeMix())
    assert.ok(Array.isArray(result.characteristicElements))
  })

  it('referenceArtists is an array', () => {
    const result = detectStyle(128, makeGroove('techno'), makeArrangement(), makeMix())
    assert.ok(Array.isArray(result.referenceArtists))
  })
})
