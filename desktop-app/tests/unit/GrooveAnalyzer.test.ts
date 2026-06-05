import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeGroove } from '../../src/renderer/src/audio/ai/deep/GrooveAnalyzer.ts'
import type { AnalysisTrack } from '../../src/renderer/src/audio/ai/deep/AnalysisTypes.ts'

function makeQuantizedTrack(): AnalysisTrack {
  // Notes perfectly on the grid: 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5 (8th notes)
  return {
    id: 't1', name: 'Kick', type: 'drum',
    clips: [{
      id: 'c1', startBeat: 0,
      notes: Array.from({ length: 8 }, (_, i) => ({
        pitch: 36,
        startBeat: i * 0.5,
        duration: 0.25,
        velocity: 100,
      })),
    }],
  }
}

describe('GrooveAnalyzer', () => {
  it('perfectly quantized notes → swingAmount ≈ 0', () => {
    const track = makeQuantizedTrack()
    const result = analyzeGroove([track], 120)
    assert.ok(result.swingAmount < 0.1, `swingAmount should be near 0, got ${result.swingAmount}`)
  })

  it('perfectly quantized notes → grooveTemplate = straight', () => {
    const track = makeQuantizedTrack()
    const result = analyzeGroove([track], 120)
    assert.equal(result.grooveTemplate, 'straight')
  })

  it('uniform velocities → velocityVariance near 0', () => {
    const track: AnalysisTrack = {
      id: 't1', name: 'Kick', type: 'drum',
      clips: [{
        id: 'c1', startBeat: 0,
        notes: Array.from({ length: 8 }, (_, i) => ({
          pitch: 36,
          startBeat: i * 0.5,
          duration: 0.25,
          velocity: 80, // all same velocity
        })),
      }],
    }
    const result = analyzeGroove([track], 120)
    assert.ok(result.velocityVariance < 0.05, `velocityVariance should be near 0, got ${result.velocityVariance}`)
  })

  it('notes with consistent late timing → grooveTemplate = laid-back', () => {
    const track: AnalysisTrack = {
      id: 't1', name: 'Kick', type: 'drum',
      clips: [{
        id: 'c1', startBeat: 0,
        notes: [
          // On-beats are on grid
          { pitch: 36, startBeat: 0, duration: 0.25, velocity: 100 },
          { pitch: 36, startBeat: 1, duration: 0.25, velocity: 100 },
          { pitch: 36, startBeat: 2, duration: 0.25, velocity: 100 },
          { pitch: 36, startBeat: 3, duration: 0.25, velocity: 100 },
          // Off-beats are consistently late (pushed forward by 0.02)
          { pitch: 38, startBeat: 0.52, duration: 0.25, velocity: 90 },
          { pitch: 38, startBeat: 1.52, duration: 0.25, velocity: 90 },
          { pitch: 38, startBeat: 2.52, duration: 0.25, velocity: 90 },
          { pitch: 38, startBeat: 3.52, duration: 0.25, velocity: 90 },
        ],
      }],
    }
    const result = analyzeGroove([track], 120)
    // With consistent late timing, groove should be laid-back or humanized
    assert.ok(
      result.grooveTemplate === 'laid-back' || result.grooveTemplate === 'humanized',
      `Expected laid-back or humanized, got ${result.grooveTemplate}`
    )
  })

  it('empty tracks → default swing and straight template', () => {
    const result = analyzeGroove([], 120)
    assert.equal(result.swingAmount, 0)
    assert.equal(result.grooveTemplate, 'straight')
  })

  it('returns valid dominantSubdivision', () => {
    const track = makeQuantizedTrack()
    const result = analyzeGroove([track], 120)
    const valid = ['4th', '8th', '16th', '32nd']
    assert.ok(valid.includes(result.dominantSubdivision), `Got: ${result.dominantSubdivision}`)
  })
})
