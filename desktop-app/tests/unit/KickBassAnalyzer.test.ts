import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeKickBass } from '../../src/renderer/src/audio/ai/deep/KickBassAnalyzer.ts'
import type { AnalysisTrack } from '../../src/renderer/src/audio/ai/deep/AnalysisTypes.ts'

describe('KickBassAnalyzer', () => {
  it('kick and bass notes on same beat → overlapCount > 0', () => {
    const tracks: AnalysisTrack[] = [
      {
        id: 'tk-kick', name: 'Kick BD', type: 'drum',
        clips: [{ id: 'c1', startBeat: 0, notes: [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: 120 }] }],
      },
      {
        id: 'tk-bass', name: 'Bass Synth', type: 'bass',
        clips: [{ id: 'c2', startBeat: 0, notes: [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: 100 }] }],
      },
    ]
    const result = analyzeKickBass(tracks)
    assert.ok(result.overlapCount > 0, 'Should detect overlap')
  })

  it('no overlap → overlapCount = 0, frequencyClashRisk = low', () => {
    const tracks: AnalysisTrack[] = [
      {
        id: 'tk-kick', name: 'Kick', type: 'drum',
        clips: [{ id: 'c1', startBeat: 0, notes: [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: 120 }] }],
      },
      {
        id: 'tk-bass', name: 'Bass', type: 'bass',
        clips: [{ id: 'c2', startBeat: 0, notes: [{ pitch: 36, startBeat: 2, duration: 0.5, velocity: 100 }] }],
      },
    ]
    const result = analyzeKickBass(tracks)
    assert.equal(result.overlapCount, 0)
    assert.equal(result.frequencyClashRisk, 'low')
  })

  it('overlapRatio > 0.5 → frequencyClashRisk = high', () => {
    // 4 kick notes, 4 bass notes, all overlapping
    const kickNotes = Array.from({ length: 4 }, (_, i) => ({ pitch: 36, startBeat: i, duration: 0.5, velocity: 120 }))
    const bassNotes = Array.from({ length: 4 }, (_, i) => ({ pitch: 36, startBeat: i, duration: 0.5, velocity: 100 }))
    const tracks: AnalysisTrack[] = [
      { id: 'tk-kick', name: 'Kick BD', type: 'drum', clips: [{ id: 'c1', startBeat: 0, notes: kickNotes }] },
      { id: 'tk-bass', name: 'Bass Sub', type: 'bass', clips: [{ id: 'c2', startBeat: 0, notes: bassNotes }] },
    ]
    const result = analyzeKickBass(tracks)
    assert.equal(result.frequencyClashRisk, 'high')
  })

  it('sidechainDetected = true when overlapRatio > 0.3', () => {
    // 3 kick notes, 4 bass notes, 2 overlapping → ratio = 2/4 = 0.5 > 0.3
    const tracks: AnalysisTrack[] = [
      {
        id: 'tk-kick', name: 'Kick', type: 'drum',
        clips: [{
          id: 'c1', startBeat: 0,
          notes: [
            { pitch: 36, startBeat: 0, duration: 0.5, velocity: 120 },
            { pitch: 36, startBeat: 1, duration: 0.5, velocity: 120 },
            { pitch: 36, startBeat: 2, duration: 0.5, velocity: 120 },
          ],
        }],
      },
      {
        id: 'tk-bass', name: 'Bass', type: 'bass',
        clips: [{
          id: 'c2', startBeat: 0,
          notes: [
            { pitch: 36, startBeat: 0, duration: 0.5, velocity: 100 },   // overlap
            { pitch: 36, startBeat: 1, duration: 0.5, velocity: 100 },   // overlap
            { pitch: 36, startBeat: 0.5, duration: 0.5, velocity: 100 }, // no overlap
            { pitch: 36, startBeat: 1.5, duration: 0.5, velocity: 100 }, // no overlap
          ],
        }],
      },
    ]
    const result = analyzeKickBass(tracks)
    assert.ok(result.overlapRatio > 0.3, 'overlapRatio should be > 0.3')
    assert.ok(result.sidechainDetected, 'sidechain should be detected')
  })

  it('recommendation is a non-empty string', () => {
    const result = analyzeKickBass([])
    assert.ok(typeof result.recommendation === 'string')
    assert.ok(result.recommendation.length > 0)
  })
})
