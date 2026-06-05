import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { liveSuggestionEngine } from '../../src/renderer/src/audio/ai/LiveSuggestionEngine.ts'
import type { MusicContext } from '../../src/renderer/src/audio/ai/MusicContextEngine.ts'
import type { KickBassAnalysis } from '../../src/renderer/src/audio/ai/deep/KickBassAnalyzer.ts'
import type { ArrangementAnalysis } from '../../src/renderer/src/audio/ai/deep/ArrangementAnalyzer.ts'
import type { MixAnalysis } from '../../src/renderer/src/audio/ai/deep/MixAnalyzer.ts'
import type { GrooveAnalysis } from '../../src/renderer/src/audio/ai/deep/GrooveAnalyzer.ts'
import type { StyleDetection } from '../../src/renderer/src/audio/ai/deep/StyleDetector.ts'
import type { EnergyAnalysis } from '../../src/renderer/src/audio/ai/deep/EnergyAnalyzer.ts'

function makeContext(overrides: {
  kickBassRisk?: 'low' | 'medium' | 'high'
  headroomScore?: number
  dynamicRange?: number
  hasDropStructure?: boolean
  primaryStyle?: StyleDetection['primaryStyle']
  swingAmount?: number
  sectionCount?: number
}): MusicContext {
  const kickBass: KickBassAnalysis = {
    kickNotes: [],
    bassNotes: [],
    overlapCount: overrides.kickBassRisk === 'high' ? 10 : 0,
    overlapRatio: overrides.kickBassRisk === 'high' ? 0.8 : overrides.kickBassRisk === 'medium' ? 0.3 : 0.1,
    sidechainDetected: overrides.kickBassRisk === 'high',
    frequencyClashRisk: overrides.kickBassRisk ?? 'low',
    recommendation: 'Test recommendation',
  }

  const arrangement: ArrangementAnalysis = {
    sections: Array.from({ length: overrides.sectionCount ?? 4 }, (_, i) => ({
      label: 'verse' as const,
      startBar: i * 4,
      endBar: (i + 1) * 4,
      energy: 0.5,
      clipDensity: 0.5,
    })),
    energyCurve: new Float32Array(16).fill(0.5),
    peakBar: 8,
    averageEnergy: 0.5,
    dynamicRange: overrides.dynamicRange ?? 0.5,
    hasDropStructure: overrides.hasDropStructure ?? false,
    hasBridgeSection: false,
  }

  const mix: MixAnalysis = {
    trackBalance: new Map(),
    frequencyDistribution: { sub: 0.25, low: 0.25, mid: 0.25, high: 0.25 },
    percussionRatio: 0.25,
    harmonicDensity: 0.5,
    stereoBalance: 0.5,
    headroomScore: overrides.headroomScore ?? 0.3,
    suggestions: [],
  }

  const groove: GrooveAnalysis = {
    swingAmount: overrides.swingAmount ?? 0,
    grooveTemplate: 'straight',
    velocityVariance: 0.1,
    timingDeviation: 0.01,
    dominantSubdivision: '8th',
    styleHint: 'straight',
  }

  const style: StyleDetection = {
    primaryStyle: overrides.primaryStyle ?? 'techno',
    confidence: 0.8,
    subStyle: 'test',
    bpmRange: { min: 128, max: 145 },
    characteristicElements: [],
    referenceArtists: [],
  }

  const energy: EnergyAnalysis = {
    perTrackEnergy: new Map(),
    globalEnergy: new Float32Array(16).fill(0.5),
    buildupPoints: [],
    dropPoints: [],
    sustainedPeaks: [],
  }

  return {
    project: { bpm: 128, tracks: [], totalBars: 16, sampleRate: 44100 },
    arrangement,
    energy,
    kickBass,
    groove,
    mix,
    style,
    contextSummary: 'Test context',
    buildTimestamp: Date.now(),
  }
}

describe('LiveSuggestionEngine', () => {
  it('high kickBass clash risk → includes fix suggestion with priority 0.9', () => {
    const context = makeContext({ kickBassRisk: 'high' })
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    const fixSuggestion = suggestions.find(s => s.priority === 0.9 && s.type === 'fix')
    assert.ok(fixSuggestion, 'Should have a fix suggestion with priority 0.9')
  })

  it('low headroomScore → includes warning', () => {
    const context = makeContext({ headroomScore: 0.05 })
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    const warning = suggestions.find(s => s.type === 'warning')
    assert.ok(warning, 'Should have a warning suggestion for low headroom')
    assert.ok(warning.priority >= 0.9, 'Warning should have high priority')
  })

  it('suggestions sorted by priority descending', () => {
    const context = makeContext({ kickBassRisk: 'high', headroomScore: 0.05, dynamicRange: 0.1 })
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    for (let i = 1; i < suggestions.length; i++) {
      assert.ok(
        suggestions[i - 1]!.priority >= suggestions[i]!.priority,
        `Suggestion ${i - 1} priority ${suggestions[i - 1]!.priority} should be >= ${suggestions[i]!.priority}`
      )
    }
  })

  it('max 6 suggestions returned', () => {
    const context = makeContext({ kickBassRisk: 'high', headroomScore: 0.05, dynamicRange: 0.1, sectionCount: 1 })
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    assert.ok(suggestions.length <= 6, `Should return at most 6 suggestions, got ${suggestions.length}`)
  })

  it('suggestions have required fields', () => {
    const context = makeContext({})
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    assert.ok(suggestions.length > 0, 'Should have at least one suggestion')
    for (const s of suggestions) {
      assert.ok(typeof s.id === 'string' && s.id.length > 0, 'id should be non-empty string')
      assert.ok(typeof s.type === 'string', 'type should be string')
      assert.ok(typeof s.title === 'string' && s.title.length > 0, 'title should be non-empty string')
      assert.ok(typeof s.description === 'string' && s.description.length > 0, 'description should be non-empty string')
      assert.ok(typeof s.command === 'string', 'command should be string')
      assert.ok(typeof s.priority === 'number' && s.priority >= 0 && s.priority <= 1, 'priority should be 0-1')
      assert.ok(typeof s.category === 'string', 'category should be string')
    }
  })

  it('no drop structure for house → suggests adding drop', () => {
    const context = makeContext({ hasDropStructure: false, primaryStyle: 'house' })
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    const dropSuggestion = suggestions.find(s => s.priority === 0.8 && s.command === 'add drop')
    assert.ok(dropSuggestion, 'Should suggest adding drop for house without drop structure')
  })

  it('jazz with low swing → suggests humanize', () => {
    const context = makeContext({ primaryStyle: 'jazz', swingAmount: 0.01 })
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    const humanize = suggestions.find(s => s.priority === 0.75)
    assert.ok(humanize, 'Should suggest humanize for jazz without swing')
  })

  it('low dynamic range → enhancement suggestion', () => {
    const context = makeContext({ dynamicRange: 0.1 })
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    const dynamicsSuggestion = suggestions.find(s => s.priority === 0.85)
    assert.ok(dynamicsSuggestion, 'Should suggest more dynamics for low dynamic range')
  })
})
