// ─── MidiCorrector.test.ts ─────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MidiCorrector } from '../../src/renderer/src/audio/ai/MidiCorrector.ts'
import type { MidiNote, CorrectionOptions } from '../../src/renderer/src/audio/ai/MidiCorrector.ts'

function note(id: string, pitch: number, startBeat: number, duration = 0.25, velocity = 100): MidiNote {
  return { id, pitch, startBeat, duration, velocity }
}

const corrector = new MidiCorrector()

describe('MidiCorrector', () => {
  describe('quantize', () => {
    it('strength=1.0: note at beat 0.1, grid=0.25 → snapped to 0.0', () => {
      const notes = [note('n1', 60, 0.1)]
      const result = corrector.quantize(notes, 0.25, 1.0)
      assert.ok(Math.abs(result[0]!.startBeat - 0.0) < 0.001,
        `Expected 0.0, got ${result[0]!.startBeat}`)
    })

    it('strength=0.5: note at beat 0.1, grid=0.25 → midway to 0 (0.05)', () => {
      const notes = [note('n1', 60, 0.1)]
      const result = corrector.quantize(notes, 0.25, 0.5)
      // snapped=0.0, original=0.1, result = 0.1 + (0 - 0.1)*0.5 = 0.05
      assert.ok(Math.abs(result[0]!.startBeat - 0.05) < 0.001,
        `Expected 0.05, got ${result[0]!.startBeat}`)
    })

    it('strength=0: no change', () => {
      const notes = [note('n1', 60, 0.13)]
      const result = corrector.quantize(notes, 0.25, 0)
      assert.ok(Math.abs(result[0]!.startBeat - 0.13) < 0.001)
    })

    it('preserves other fields', () => {
      const notes = [note('n1', 72, 0.5, 0.25, 80)]
      const result = corrector.quantize(notes, 0.25, 1.0)
      assert.equal(result[0]!.id, 'n1')
      assert.equal(result[0]!.pitch, 72)
      assert.equal(result[0]!.velocity, 80)
    })
  })

  describe('smoothVelocities', () => {
    it('smooths extreme values with windowSize=3', () => {
      const notes = [
        note('n1', 60, 0,    0.25, 100),
        note('n2', 60, 0.25, 0.25, 20),
        note('n3', 60, 0.5,  0.25, 100),
        note('n4', 60, 0.75, 0.25, 20),
        note('n5', 60, 1.0,  0.25, 100),
      ]
      const result = corrector.smoothVelocities(notes, 2)
      // Middle values should be blended toward average
      assert.ok(result[1]!.velocity > 20, `n2 velocity should be smoothed up, got ${result[1]!.velocity}`)
      assert.ok(result[1]!.velocity < 100, `n2 velocity should be less than 100, got ${result[1]!.velocity}`)
      // All velocities should be clamped in [1, 127]
      for (const n of result) {
        assert.ok(n.velocity >= 1 && n.velocity <= 127, `velocity ${n.velocity} out of range`)
      }
    })

    it('returns empty array for empty input', () => {
      assert.equal(corrector.smoothVelocities([], 3).length, 0)
    })

    it('single note unchanged in effective range', () => {
      const notes = [note('n1', 60, 0, 0.25, 80)]
      const result = corrector.smoothVelocities(notes, 3)
      assert.equal(result[0]!.velocity, 80)
    })
  })

  describe('fixOverlaps', () => {
    it('truncates overlapping notes of same pitch', () => {
      const notes = [
        note('n1', 60, 0.0, 0.5),   // ends at 0.5
        note('n2', 60, 0.25, 0.5),  // starts at 0.25 — overlap!
      ]
      const result = corrector.fixOverlaps(notes)
      const n1 = result.find(n => n.id === 'n1')!
      assert.ok(n1.duration <= 0.25 + 0.001,
        `n1 should be truncated to ≤0.25, got ${n1.duration}`)
    })

    it('does not modify non-overlapping notes', () => {
      const notes = [
        note('n1', 60, 0.0, 0.25),
        note('n2', 60, 0.25, 0.25),
      ]
      const result = corrector.fixOverlaps(notes)
      assert.ok(Math.abs(result[0]!.duration - 0.25) < 0.001)
    })

    it('does not affect notes of different pitch', () => {
      const notes = [
        note('n1', 60, 0.0, 0.5),
        note('n2', 62, 0.25, 0.5),  // different pitch, no overlap fix needed
      ]
      const result = corrector.fixOverlaps(notes)
      const n1 = result.find(n => n.id === 'n1')!
      assert.ok(Math.abs(n1.duration - 0.5) < 0.001, 'Different pitch note should not be truncated')
    })

    it('returns empty array for empty input', () => {
      assert.equal(corrector.fixOverlaps([]).length, 0)
    })
  })

  describe('removeOutlierPitches', () => {
    it('removes notes with pitch < min', () => {
      const notes = [note('n1', 5, 0), note('n2', 60, 0.25)]
      const result = corrector.removeOutlierPitches(notes, 36, 96)
      assert.equal(result.length, 1)
      assert.equal(result[0]!.id, 'n2')
    })

    it('removes notes with pitch > max', () => {
      const notes = [note('n1', 110, 0), note('n2', 60, 0.25)]
      const result = corrector.removeOutlierPitches(notes, 36, 96)
      assert.equal(result.length, 1)
      assert.equal(result[0]!.id, 'n2')
    })

    it('keeps notes within range', () => {
      const notes = [note('n1', 36, 0), note('n2', 60, 0.25), note('n3', 96, 0.5)]
      const result = corrector.removeOutlierPitches(notes, 36, 96)
      assert.equal(result.length, 3)
    })
  })

  describe('computeQuality', () => {
    it('perfectly quantized notes → quality > 0.7', () => {
      const grid = 0.25
      const notes = [
        note('n1', 60, 0.0,   0.25, 80),
        note('n2', 62, 0.25,  0.25, 80),
        note('n3', 64, 0.5,   0.25, 80),
        note('n4', 65, 0.75,  0.25, 80),
      ]
      const quality = corrector.computeQuality(notes, grid)
      assert.ok(quality > 0.7, `Expected quality > 0.7, got ${quality}`)
    })

    it('random timing → lower quality than perfect', () => {
      const grid = 0.25
      const perfectNotes = [
        note('p1', 60, 0.0,  0.25, 80),
        note('p2', 62, 0.25, 0.25, 80),
        note('p3', 64, 0.5,  0.25, 80),
        note('p4', 65, 0.75, 0.25, 80),
      ]
      const randomNotes = [
        note('r1', 60, 0.07,  0.25, 80),
        note('r2', 62, 0.18,  0.25, 80),
        note('r3', 64, 0.44,  0.25, 80),
        note('r4', 65, 0.61,  0.25, 80),
      ]
      const perfectQ = corrector.computeQuality(perfectNotes, grid)
      const randomQ  = corrector.computeQuality(randomNotes, grid)
      assert.ok(perfectQ > randomQ, `Perfect (${perfectQ}) should be > random (${randomQ})`)
    })

    it('empty notes → quality 1', () => {
      assert.equal(corrector.computeQuality([], 0.25), 1)
    })
  })

  describe('correctAll', () => {
    it('returns CorrectionResult with qualityAfter >= qualityBefore', () => {
      const options: CorrectionOptions = {
        quantizeStrength: 1.0,
        quantizeGrid: 0.25,
        velocitySmoothing: 1.0,
        removeOutliers: true,
        pitchRange: { min: 36, max: 96 },
      }
      const notes = [
        note('n1', 60, 0.07,  0.25, 40),
        note('n2', 62, 0.18,  0.25, 120),
        note('n3', 5,  0.44,  0.25, 30),   // pitch outlier
        note('n4', 65, 0.51,  0.25, 90),
      ]
      const result = corrector.correctAll(notes, options)
      assert.ok(result.qualityAfter >= result.qualityBefore,
        `qualityAfter (${result.qualityAfter}) should be >= qualityBefore (${result.qualityBefore})`)
    })

    it('returns notes array without outlier pitches when removeOutliers=true', () => {
      const options: CorrectionOptions = {
        quantizeStrength: 0,
        quantizeGrid: 0.25,
        velocitySmoothing: 0,
        removeOutliers: true,
        pitchRange: { min: 36, max: 96 },
      }
      const notes = [
        note('n1', 5,  0.0,  0.25, 80),  // removed
        note('n2', 60, 0.25, 0.25, 80),  // kept
      ]
      const result = corrector.correctAll(notes, options)
      assert.equal(result.notes.length, 1)
      assert.equal(result.notes[0]!.id, 'n2')
      // Should have a 'removed' change
      assert.ok(result.changes.some(c => c.type === 'removed' && c.noteId === 'n1'))
    })

    it('records quantize changes', () => {
      const options: CorrectionOptions = {
        quantizeStrength: 1.0,
        quantizeGrid: 0.25,
        velocitySmoothing: 0,
        removeOutliers: false,
        pitchRange: { min: 0, max: 127 },
      }
      const notes = [note('n1', 60, 0.1, 0.25, 80)]
      const result = corrector.correctAll(notes, options)
      assert.ok(result.changes.some(c => c.type === 'quantize' && c.noteId === 'n1'))
    })
  })
})
