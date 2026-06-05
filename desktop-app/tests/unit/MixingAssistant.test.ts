// ─── MixingAssistant.test.ts ──────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeMix,
  getSuggestions,
} from '../../src/renderer/src/audio/workflow/MixingAssistant.ts'
import type { Project } from '../../src/renderer/src/types/project.ts'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id:                       'test-proj',
    name:                     'Test',
    bpm:                      120,
    timeSignatureNumerator:   4,
    timeSignatureDenominator: 4,
    sampleRate:               44100,
    masterGainDb:             -6,
    loopStart:                1,
    loopEnd:                  17,
    totalBars:                16,
    tracks:                   [],
    ...overrides,
  }
}

describe('MixingAssistant / analyzeMix', () => {
  it('masterGainDb=1 produces a critical issue', () => {
    const project = makeProject({ masterGainDb: 1 })
    const analysis = analyzeMix(project)
    const criticals = analysis.issues.filter(i => i.level === 'critical')
    assert.ok(criticals.length > 0, 'should have at least one critical issue')
  })

  it('masterGainDb=-6 has no critical issues', () => {
    const project = makeProject({ masterGainDb: -6 })
    const analysis = analyzeMix(project)
    const criticals = analysis.issues.filter(i => i.level === 'critical')
    assert.equal(criticals.length, 0, 'should have no critical issues')
  })

  it('track with gainDb=10 produces a warning for that track', () => {
    const project = makeProject({
      tracks: [
        {
          id: 'tk-1', name: 'Hot Track', type: 'midi', color: '#f97316',
          gainDb: 10, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
          clips: [{ id: 'c1', trackId: 'tk-1', name: 'A', startBar: 1, lengthBars: 4, color: '#f97316', muted: false, notes: [] }],
        },
      ],
    })
    const analysis = analyzeMix(project)
    const trackWarning = analysis.issues.find(i => i.level === 'warning' && i.trackId === 'tk-1')
    assert.ok(trackWarning, 'should have a warning for the hot track')
  })

  it('all tracks centered produces an info about panning', () => {
    const project = makeProject({
      tracks: [
        {
          id: 'tk-1', name: 'Track A', type: 'midi', color: '#3b82f6',
          gainDb: -4, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
          clips: [{ id: 'c1', trackId: 'tk-1', name: 'A', startBar: 1, lengthBars: 4, color: '#3b82f6', muted: false, notes: [] }],
        },
        {
          id: 'tk-2', name: 'Track B', type: 'midi', color: '#10b981',
          gainDb: -4, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
          clips: [{ id: 'c2', trackId: 'tk-2', name: 'B', startBar: 1, lengthBars: 4, color: '#10b981', muted: false, notes: [] }],
        },
      ],
    })
    const analysis = analyzeMix(project)
    const panInfo = analysis.issues.find(i => i.id === 'all-centered')
    assert.ok(panInfo, 'should have info about centered panning')
  })

  it('score decreases with more issues', () => {
    const cleanProject = makeProject({ masterGainDb: -6 })
    const hotProject   = makeProject({ masterGainDb: 1 })

    const cleanScore = analyzeMix(cleanProject).score
    const hotScore   = analyzeMix(hotProject).score

    assert.ok(hotScore < cleanScore, 'score should be lower when there are issues')
  })

  it('getSuggestions returns at most 3 items', () => {
    const project  = makeProject({ masterGainDb: 1 })
    const analysis = analyzeMix(project)
    const suggestions = getSuggestions(analysis)
    assert.ok(suggestions.length <= 3, `should return <= 3 suggestions, got ${suggestions.length}`)
  })
})
