// ─── MelodyGenerator.test.ts ──────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateMelody } from '../../src/renderer/src/audio/ai/MelodyGenerator.ts'

const C_MAJOR_PCS = new Set([0, 2, 4, 5, 7, 9, 11])

describe('MelodyGenerator', () => {
  it('C major medium density → all note pitch classes in C major scale', () => {
    const pattern = generateMelody({
      key:         { root: 0, mode: 'major' },
      scale:       'major',
      style:       'pop',
      bars:        1,
      startOctave: 4,
      noteDensity: 'medium',
      contour:     'random_walk',
      seed:        42,
    })
    assert.ok(pattern.notes.length > 0, 'Should have notes')
    for (const note of pattern.notes) {
      const pc = note.pitch % 12
      assert.ok(C_MAJOR_PCS.has(pc), `Pitch class ${pc} (pitch ${note.pitch}) not in C major`)
    }
  })

  it('ascending contour → last note pitch >= first note pitch', () => {
    const pattern = generateMelody({
      key:         { root: 0, mode: 'major' },
      scale:       'major',
      style:       'pop',
      bars:        2,
      startOctave: 4,
      noteDensity: 'medium',
      contour:     'ascending',
      seed:        123,
    })
    assert.ok(pattern.notes.length >= 2, 'Should have at least 2 notes')
    const sorted = [...pattern.notes].sort((a, b) => a.startBeat - b.startBeat)
    const firstPitch = sorted[0]!.pitch
    const lastPitch  = sorted[sorted.length - 1]!.pitch
    assert.ok(lastPitch >= firstPitch, `Last pitch (${lastPitch}) should be >= first pitch (${firstPitch})`)
  })

  it('sparse density → at most 2 notes per bar (every 2 beats)', () => {
    const bars = 1
    const pattern = generateMelody({
      key:         { root: 0, mode: 'major' },
      scale:       'major',
      style:       'pop',
      bars,
      startOctave: 4,
      noteDensity: 'sparse',
      contour:     'neighbor',
      seed:        77,
    })
    // 1 bar * 4 beats, sparse = every 2 beats → 2 notes
    assert.ok(pattern.notes.length <= 2, `Expected <= 2 notes for sparse 1 bar, got ${pattern.notes.length}`)
  })

  it('all velocities in [1, 127]', () => {
    const pattern = generateMelody({
      key:         { root: 0, mode: 'minor' },
      scale:       'natural_minor',
      style:       'techno',
      bars:        2,
      startOctave: 4,
      noteDensity: 'dense',
      contour:     'arch',
      seed:        55,
    })
    for (const note of pattern.notes) {
      assert.ok(note.velocity >= 1 && note.velocity <= 127,
        `Velocity ${note.velocity} out of range [1, 127]`)
    }
  })

  it('no note has lengthBeats <= 0', () => {
    const pattern = generateMelody({
      key:         { root: 5, mode: 'major' },
      scale:       'mixolydian',
      style:       'house',
      bars:        2,
      startOctave: 4,
      noteDensity: 'medium',
      contour:     'descending',
      seed:        999,
    })
    for (const note of pattern.notes) {
      assert.ok(note.lengthBeats > 0, `Note lengthBeats should be > 0, got ${note.lengthBeats}`)
    }
  })
})
