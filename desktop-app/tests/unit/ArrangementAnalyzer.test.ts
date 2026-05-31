import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeArrangement } from '../../src/renderer/src/audio/ai/deep/ArrangementAnalyzer.ts'
import type { AnalysisTrack } from '../../src/renderer/src/audio/ai/deep/AnalysisTypes.ts'

describe('ArrangementAnalyzer', () => {
  it('empty tracks → energyCurve all zeros', () => {
    const result = analyzeArrangement([], 120, 8)
    for (let i = 0; i < result.energyCurve.length; i++) {
      assert.equal(result.energyCurve[i], 0)
    }
  })

  it('energyCurve length equals totalBars', () => {
    const result = analyzeArrangement([], 120, 16)
    assert.equal(result.energyCurve.length, 16)
  })

  it('single drum track with clips covering bars 0-3 → energy > 0 in those bars', () => {
    const track: AnalysisTrack = {
      id: 't1',
      name: 'Kick',
      type: 'drum',
      clips: [
        {
          id: 'c1',
          startBeat: 0,
          notes: [
            { pitch: 36, startBeat: 0, duration: 0.5, velocity: 100 },
            { pitch: 36, startBeat: 4, duration: 0.5, velocity: 100 },
          ],
        },
      ],
    }
    const result = analyzeArrangement([track], 120, 8)
    // Bars 0 and 1 should have energy (clip starts at beat 0, notes go to beat ~4.5)
    assert.ok(result.energyCurve[0]! > 0, 'bar 0 should have energy')
    assert.ok(result.energyCurve[1]! > 0, 'bar 1 should have energy')
  })

  it('peakBar is bar with highest value', () => {
    const track: AnalysisTrack = {
      id: 't1',
      name: 'Kick',
      type: 'drum',
      clips: [
        { id: 'c1', startBeat: 4, notes: [{ pitch: 36, startBeat: 0, duration: 4, velocity: 127 }] },
        { id: 'c2', startBeat: 4, notes: [{ pitch: 38, startBeat: 0, duration: 4, velocity: 127 }] },
      ],
    }
    const result = analyzeArrangement([track], 120, 8)
    const maxVal = Math.max(...Array.from(result.energyCurve))
    assert.equal(result.energyCurve[result.peakBar], maxVal)
  })

  it('dynamicRange = max - min energy over all bars', () => {
    const track: AnalysisTrack = {
      id: 't1',
      name: 'Lead',
      type: 'lead',
      clips: [{ id: 'c1', startBeat: 0, notes: [{ pitch: 60, startBeat: 0, duration: 4, velocity: 100 }] }],
    }
    const result = analyzeArrangement([track], 120, 8)
    const max = Math.max(...Array.from(result.energyCurve))
    const min = Math.min(...Array.from(result.energyCurve))
    assert.ok(Math.abs(result.dynamicRange - (max - min)) < 0.001)
  })

  it('returns empty sections for zero totalBars', () => {
    const result = analyzeArrangement([], 120, 0)
    assert.equal(result.sections.length, 0)
    assert.equal(result.energyCurve.length, 0)
  })
})
