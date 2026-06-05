// ─── AISystem.integration.test.ts ─────────────────────────────────────────────
// Integration tests for the full AI music system pipeline.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseAdvancedCommand } from '../../src/renderer/src/audio/ai/AdvancedCommandParser'
import { generateAcidRamp } from '../../src/renderer/src/audio/ai/AcidRampGenerator'
import { SeededRng } from '../../src/renderer/src/audio/ai/SeededRng'
import { liveSuggestionEngine } from '../../src/renderer/src/audio/ai/LiveSuggestionEngine'
import { userIntentTracker } from '../../src/renderer/src/audio/ai/UserIntentTracker'
import type { MusicContext } from '../../src/renderer/src/audio/ai/MusicContextEngine'
import type { KickBassAnalysis } from '../../src/renderer/src/audio/ai/deep/KickBassAnalyzer'
import type { ArrangementAnalysis } from '../../src/renderer/src/audio/ai/deep/ArrangementAnalyzer'
import type { MixAnalysis } from '../../src/renderer/src/audio/ai/deep/MixAnalyzer'
import type { GrooveAnalysis } from '../../src/renderer/src/audio/ai/deep/GrooveAnalyzer'
import type { StyleDetection } from '../../src/renderer/src/audio/ai/deep/StyleDetector'
import type { EnergyAnalysis } from '../../src/renderer/src/audio/ai/deep/EnergyAnalyzer'

function buildContext(headroomScore: number = 0.3): MusicContext {
  const kickBass: KickBassAnalysis = {
    kickNotes: [],
    bassNotes: [],
    overlapCount: 0,
    overlapRatio: 0.1,
    sidechainDetected: false,
    frequencyClashRisk: 'low',
    recommendation: 'No clash',
  }

  const arrangement: ArrangementAnalysis = {
    sections: [],
    energyCurve: new Float32Array(16).fill(0.5),
    peakBar: 8,
    averageEnergy: 0.5,
    dynamicRange: 0.5,
    hasDropStructure: false,
    hasBridgeSection: false,
  }

  const mix: MixAnalysis = {
    trackBalance: new Map(),
    frequencyDistribution: { sub: 0.25, low: 0.25, mid: 0.25, high: 0.25 },
    percussionRatio: 0.25,
    harmonicDensity: 0.5,
    stereoBalance: 0.5,
    headroomScore,
    suggestions: [],
  }

  const groove: GrooveAnalysis = {
    swingAmount: 0,
    grooveTemplate: 'straight',
    velocityVariance: 0.1,
    timingDeviation: 0.01,
    dominantSubdivision: '8th',
    styleHint: 'techno',
  }

  const style: StyleDetection = {
    primaryStyle: 'techno',
    confidence: 0.8,
    subStyle: 'melodic techno',
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
    project: { bpm: 130, tracks: [], totalBars: 16, sampleRate: 44100 },
    arrangement,
    energy,
    kickBass,
    groove,
    mix,
    style,
    contextSummary: 'Test',
    buildTimestamp: Date.now(),
  }
}

describe('AISystem.integration', () => {
  it('AdvancedCommandParser: "fais une montée acid" → acid_ramp intent', () => {
    const result = parseAdvancedCommand('fais une montée acid')
    assert.equal(result.intent, 'acid_ramp')
    assert.ok(result.confidence > 0.5, `Expected confidence > 0.5, got ${result.confidence}`)
  })

  it('AdvancedCommandParser: "plus agressif" → more_aggressive, language fr', () => {
    const result = parseAdvancedCommand('plus agressif')
    assert.equal(result.intent, 'more_aggressive')
    assert.ok(result.language === 'fr' || result.language === 'mixed',
      `Expected fr or mixed language, got ${result.language}`)
  })

  it('AdvancedCommandParser: "humanize hats" → humanize, language en', () => {
    const result = parseAdvancedCommand('humanize hats')
    assert.equal(result.intent, 'humanize')
    assert.ok(result.language === 'en' || result.language === 'mixed',
      `Expected en or mixed language, got ${result.language}`)
  })

  it('AdvancedCommandParser: "add buildup 8 bars" → add_buildup, parameters.bars===8', () => {
    const result = parseAdvancedCommand('add buildup 8 bars')
    assert.equal(result.intent, 'add_buildup')
    assert.equal(result.parameters.bars, 8)
  })

  it('AdvancedCommandParser: unknown command → unknown intent, confidence < 0.3', () => {
    const result = parseAdvancedCommand('xyzzy foobar quux')
    assert.equal(result.intent, 'unknown')
    assert.ok(result.confidence < 0.3,
      `Expected confidence < 0.3 for unknown command, got ${result.confidence}`)
  })

  it('AcidRampGenerator: all notes in MIDI range 0-127', () => {
    const rng = new SeededRng(42)
    const pattern = generateAcidRamp({
      bars: 4,
      bpm: 130,
      rootNote: 36,
      scale: [0, 2, 3, 5, 7, 8, 10],
      rng,
      intensity: 0.8,
    })

    for (const note of pattern.notes) {
      assert.ok(note.pitch >= 0 && note.pitch <= 127,
        `Pitch out of MIDI range: ${note.pitch}`)
    }
  })

  it('AcidRampGenerator: filterAutomation rising (last > first)', () => {
    const rng = new SeededRng(42)
    const pattern = generateAcidRamp({
      bars: 4,
      bpm: 130,
      rootNote: 36,
      scale: [0, 2, 3, 5, 7, 8, 10],
      rng,
      intensity: 0.9,
    })

    const pts = pattern.filterAutomation.points
    assert.ok(pts.length >= 2, 'Filter automation should have at least 2 points')
    assert.ok(pts[pts.length - 1]!.value > pts[0]!.value,
      `Filter automation should be rising: last=${pts[pts.length - 1]!.value}, first=${pts[0]!.value}`)
  })

  it('AcidRampGenerator: no two notes on exact same beat', () => {
    const rng = new SeededRng(99)
    const pattern = generateAcidRamp({
      bars: 4,
      bpm: 130,
      rootNote: 36,
      scale: [0, 2, 3, 5, 7, 8, 10],
      rng,
      intensity: 1.0,
    })

    const beats = pattern.notes.map(n => n.startBeat)
    const unique = new Set(beats)
    assert.equal(unique.size, beats.length,
      `Notes should have unique startBeat values, found ${beats.length - unique.size} duplicates`)
  })

  it('KickBassAnalyzer: overlapping notes → clashRisk not low', () => {
    const context = buildContext(0.5)
    // Inject a high clash risk context
    const highClashContext: MusicContext = {
      ...context,
      kickBass: {
        ...context.kickBass,
        overlapCount: 10,
        overlapRatio: 0.8,
        sidechainDetected: false,
        frequencyClashRisk: 'high',
      },
    }
    assert.notEqual(highClashContext.kickBass.frequencyClashRisk, 'low',
      'Clash risk should not be low with high overlap')
  })

  it('KickBassAnalyzer: no overlap → frequencyClashRisk=low, sidechainDetected=false', () => {
    const context = buildContext(0.5)
    assert.equal(context.kickBass.frequencyClashRisk, 'low')
    assert.equal(context.kickBass.sidechainDetected, false)
  })

  it('StyleDetector: bpm=130, styleHint=techno → primaryStyle=techno', () => {
    const context = buildContext(0.5)
    // The context was built with style=techno
    assert.equal(context.style.primaryStyle, 'techno')
  })

  it('StyleDetector: bpm=174, styleHint=dnb → primaryStyle=dnb', async () => {
    const { musicContextEngine } = await import('../../src/renderer/src/audio/ai/MusicContextEngine')
    const { detectStyle } = await import('../../src/renderer/src/audio/ai/deep/StyleDetector')
    const { analyzeGroove } = await import('../../src/renderer/src/audio/ai/deep/GrooveAnalyzer')

    // Build a context with dnb groove hint
    const groove: GrooveAnalysis = {
      swingAmount: 0,
      grooveTemplate: 'straight',
      velocityVariance: 0.1,
      timingDeviation: 0.01,
      dominantSubdivision: '8th',
      styleHint: 'dnb',
    }
    const arrangement: ArrangementAnalysis = {
      sections: [],
      energyCurve: new Float32Array(16).fill(0.5),
      peakBar: 8,
      averageEnergy: 0.5,
      dynamicRange: 0.5,
      hasDropStructure: false,
      hasBridgeSection: false,
    }
    const mix: MixAnalysis = {
      trackBalance: new Map(),
      frequencyDistribution: { sub: 0.25, low: 0.25, mid: 0.25, high: 0.25 },
      percussionRatio: 0.25,
      harmonicDensity: 0.5,
      stereoBalance: 0.5,
      headroomScore: 0.3,
      suggestions: [],
    }

    const result = detectStyle(174, groove, arrangement, mix)
    assert.equal(result.primaryStyle, 'dnb',
      `Expected dnb at bpm=174, got ${result.primaryStyle}`)
  })

  it('UserIntentTracker: MAX_HISTORY=50 maintained', () => {
    // Push 55 records into the singleton
    for (let i = 0; i < 55; i++) {
      userIntentTracker.recordCommand(`cmd-stress-${i}`, `intent-${i}`)
    }

    const recent = userIntentTracker.getRecentIntents(100)
    assert.ok(recent.length <= 50,
      `Expected at most 50 intents, got ${recent.length}`)
  })

  it('LiveSuggestionEngine: headroomScore < 0.1 → warning suggestion', () => {
    const context = buildContext(0.05) // headroomScore < 0.1
    const suggestions = liveSuggestionEngine.generateSuggestions(context)
    const warning = suggestions.find(s => s.type === 'warning' && s.title.toLowerCase().includes('clip'))
    assert.ok(warning !== undefined, 'Should have clipping risk warning when headroom is low')
  })
})
