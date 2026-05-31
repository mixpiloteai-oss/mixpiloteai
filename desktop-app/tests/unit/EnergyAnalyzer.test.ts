import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeEnergy } from '../../src/renderer/src/audio/ai/deep/EnergyAnalyzer.ts'
import type { AnalysisTrack } from '../../src/renderer/src/audio/ai/deep/AnalysisTypes.ts'

function makeTrack(id: string, name: string, barsAndVels: Array<{ bar: number; vel: number }>): AnalysisTrack {
  return {
    id,
    name,
    type: 'drum',
    clips: barsAndVels.map((bv, i) => ({
      id: `clip-${i}`,
      startBeat: bv.bar * 4,
      notes: [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: bv.vel }],
    })),
  }
}

describe('EnergyAnalyzer', () => {
  it('perTrackEnergy has entry for each track', () => {
    const tracks: AnalysisTrack[] = [
      makeTrack('t1', 'Kick', [{ bar: 0, vel: 100 }]),
      makeTrack('t2', 'Bass', [{ bar: 0, vel: 80 }]),
    ]
    const result = analyzeEnergy(tracks, 120, 8)
    assert.ok(result.perTrackEnergy.has('t1'))
    assert.ok(result.perTrackEnergy.has('t2'))
  })

  it('globalEnergy length equals totalBars', () => {
    const result = analyzeEnergy([], 120, 16)
    assert.equal(result.globalEnergy.length, 16)
  })

  it('buildupPoints detected: energy rises sharply', () => {
    // Create data with very low energy in bars 0-7 then high energy in bar 8
    const tracks: AnalysisTrack[] = [
      {
        id: 't1', name: 'Kick', type: 'drum',
        clips: [
          // Bar 0: tiny energy
          { id: 'c0', startBeat: 0, notes: [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: 1 }] },
          { id: 'c1', startBeat: 4, notes: [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: 1 }] },
          { id: 'c2', startBeat: 8, notes: [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: 1 }] },
          { id: 'c3', startBeat: 12, notes: [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: 1 }] },
          // Bar 4: lots of energy
          { id: 'c4', startBeat: 16, notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 36, startBeat: i * 0.25, duration: 0.25, velocity: 127 })) },
          { id: 'c5', startBeat: 20, notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 36, startBeat: i * 0.25, duration: 0.25, velocity: 127 })) },
          { id: 'c6', startBeat: 24, notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 36, startBeat: i * 0.25, duration: 0.25, velocity: 127 })) },
          { id: 'c7', startBeat: 28, notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 36, startBeat: i * 0.25, duration: 0.25, velocity: 127 })) },
        ],
      },
    ]
    const result = analyzeEnergy(tracks, 120, 16)
    // Should detect a buildup around bar 8
    assert.ok(result.buildupPoints.length > 0, 'Should detect buildup points')
  })

  it('dropPoints detected: energy peak then sharp drop', () => {
    const tracks: AnalysisTrack[] = [
      {
        id: 't1', name: 'Lead', type: 'lead',
        clips: [
          // Bars 0-3: high energy
          { id: 'c0', startBeat: 0, notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 60, startBeat: i * 0.25, duration: 0.25, velocity: 127 })) },
          { id: 'c1', startBeat: 4, notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 60, startBeat: i * 0.25, duration: 0.25, velocity: 127 })) },
          { id: 'c2', startBeat: 8, notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 60, startBeat: i * 0.25, duration: 0.25, velocity: 127 })) },
          { id: 'c3', startBeat: 12, notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 60, startBeat: i * 0.25, duration: 0.25, velocity: 127 })) },
          // Bar 8: very low energy
          { id: 'c4', startBeat: 32, notes: [{ pitch: 60, startBeat: 0, duration: 0.5, velocity: 1 }] },
        ],
      },
    ]
    const result = analyzeEnergy(tracks, 120, 16)
    // Should detect drop after high energy region
    assert.ok(result.dropPoints.length > 0, 'Should detect drop points')
  })

  it('returns empty arrays for no tracks', () => {
    const result = analyzeEnergy([], 120, 8)
    assert.equal(result.buildupPoints.length, 0)
    assert.equal(result.dropPoints.length, 0)
  })
})
