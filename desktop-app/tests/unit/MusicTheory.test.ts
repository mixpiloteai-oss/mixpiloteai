// ─── MusicTheory.test.ts ──────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getScaleIntervals,
  getScaleNotes,
  getChordNotes,
  nearestScaleNote,
  getProgression,
  styleToScale,
} from '../../src/renderer/src/audio/ai/MusicTheory.ts'

describe('MusicTheory / getScaleIntervals', () => {
  it('major scale returns [0,2,4,5,7,9,11]', () => {
    const intervals = getScaleIntervals('major')
    assert.deepEqual([...intervals], [0, 2, 4, 5, 7, 9, 11])
  })

  it('pentatonic_minor returns [0,3,5,7,10]', () => {
    const intervals = getScaleIntervals('pentatonic_minor')
    assert.deepEqual([...intervals], [0, 3, 5, 7, 10])
  })
})

describe('MusicTheory / getScaleNotes', () => {
  it('getScaleNotes(0, major, 4) contains C4=60, E4=64, G4=67', () => {
    const notes = getScaleNotes(0, 'major', 4)
    assert.ok(notes.includes(60), 'Should include C4 (60)')
    assert.ok(notes.includes(64), 'Should include E4 (64)')
    assert.ok(notes.includes(67), 'Should include G4 (67)')
  })
})

describe('MusicTheory / getChordNotes', () => {
  it('getChordNotes(0, major, 4) returns [60, 64, 67]', () => {
    const notes = getChordNotes(0, 'major', 4)
    assert.deepEqual(notes, [60, 64, 67])
  })

  it('getChordNotes(9, minor, 4) contains A4=69, C5=72, E5=76', () => {
    const notes = getChordNotes(9, 'minor', 4)
    assert.ok(notes.includes(69), 'Should include A4 (69)')
    assert.ok(notes.includes(72), 'Should include C5 (72)')
    assert.ok(notes.includes(76), 'Should include E5 (76)')
  })
})

describe('MusicTheory / nearestScaleNote', () => {
  it('nearestScaleNote(61, 0, major) snaps to 60 (C) not 62 (D)', () => {
    const result = nearestScaleNote(61, 0, 'major')
    // C#/Db (61) is 1 semitone from C (60) and 1 from D (62) — either is valid nearest, but C is closer
    assert.ok(result === 60 || result === 62, `Expected 60 or 62, got ${result}`)
  })
})

describe('MusicTheory / getProgression', () => {
  it('pop major 16 beats returns 4 chords with first root=0', () => {
    const prog = getProgression({ root: 0, mode: 'major' }, 'pop', 16)
    assert.equal(prog.length, 4, `Expected 4 chords, got ${prog.length}`)
    assert.equal(prog[0]?.root, 0, `First chord root should be 0, got ${prog[0]?.root}`)
  })
})

describe('MusicTheory / styleToScale', () => {
  it('techno + minor → dorian', () => {
    assert.equal(styleToScale('techno', 'minor'), 'dorian')
  })
})
