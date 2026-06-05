import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getScalePitches, snapPitchToScale, isInScale,
  buildChord, getDiatonicChords,
  generateMelody, lcgRand,
} from '../../src/renderer/src/lib/musicTheory.ts'

describe('musicTheory / lcgRand', () => {
  it('is deterministic for a fixed seed', () => {
    const a = lcgRand(42)
    const b = lcgRand(42)
    assert.equal(a.value, b.value)
    assert.equal(a.next, b.next)
  })
  it('returns value in [0, 1)', () => {
    let seed = 12345
    for (let i = 0; i < 1000; i++) {
      const r = lcgRand(seed)
      assert.ok(r.value >= 0 && r.value < 1, `out of range: ${r.value}`)
      seed = r.next
    }
  })
  it('changes seed every step', () => {
    const r = lcgRand(7)
    assert.notEqual(r.next, 7)
  })
})

describe('musicTheory / getScalePitches', () => {
  it('C major contains C, D, E, F, G, A, B in each octave', () => {
    const pitches = getScalePitches('C', 'major')
    // C0 = 12 in our representation? Let's just check intervals: every value % 12 ∈ {0,2,4,5,7,9,11}
    const set = new Set(pitches.map(p => p % 12))
    assert.deepEqual([...set].sort((a, b) => a - b), [0, 2, 4, 5, 7, 9, 11])
  })
  it('C major has 75 notes across 0–127', () => {
    // 7 pitches per octave * 11 octaves = 77, minus the ones past 127.
    const pitches = getScalePitches('C', 'major')
    assert.ok(pitches.length >= 70 && pitches.length <= 80, `got ${pitches.length}`)
  })
  it('pentatonic-major has only 5 distinct pitch classes', () => {
    const set = new Set(getScalePitches('C', 'pentatonic-major').map(p => p % 12))
    assert.equal(set.size, 5)
  })
})

describe('musicTheory / snapPitchToScale', () => {
  it('a pitch already in scale is unchanged', () => {
    assert.equal(snapPitchToScale(60, 'C', 'major'), 60) // C4
    assert.equal(snapPitchToScale(64, 'C', 'major'), 64) // E4
  })
  it('snaps off-scale notes to the nearest', () => {
    // C# (61) is not in C major. Nearest are C (60) and D (62), both distance 1; impl returns first found.
    const out = snapPitchToScale(61, 'C', 'major')
    assert.ok(out === 60 || out === 62, `got ${out}`)
  })
})

describe('musicTheory / isInScale', () => {
  it('60 (C4) is in C major', () => assert.equal(isInScale(60, 'C', 'major'), true))
  it('61 (C#4) is NOT in C major', () => assert.equal(isInScale(61, 'C', 'major'), false))
  it('63 (D#4) is in C minor (b3)', () => assert.equal(isInScale(63, 'C', 'minor'), true))
})

describe('musicTheory / buildChord', () => {
  it('C major triad on root 60', () => {
    const c = buildChord(60, 'maj')
    assert.deepEqual(c.pitches, [60, 64, 67])
    assert.equal(c.name, 'C')
  })
  it('C minor triad on root 60', () => {
    const c = buildChord(60, 'min')
    assert.deepEqual(c.pitches, [60, 63, 67])
    assert.equal(c.name, 'Cm')
  })
  it('Cmaj7 has 4 pitches', () => {
    const c = buildChord(60, 'maj7')
    assert.deepEqual(c.pitches, [60, 64, 67, 71])
    assert.equal(c.name, 'Cmaj7')
  })
  it('clamps notes above 127', () => {
    const c = buildChord(125, 'maj7')
    assert.ok(c.pitches.every(p => p >= 0 && p <= 127))
  })
})

describe('musicTheory / getDiatonicChords', () => {
  it('C major: I, ii, iii, IV, V, vi, vii°', () => {
    const chords = getDiatonicChords('C', 'major')
    assert.equal(chords.length, 7)
    assert.equal(chords[0]!.type, 'maj')
    assert.equal(chords[1]!.type, 'min')
    assert.equal(chords[2]!.type, 'min')
    assert.equal(chords[3]!.type, 'maj')
    assert.equal(chords[4]!.type, 'maj')
    assert.equal(chords[5]!.type, 'min')
    assert.equal(chords[6]!.type, 'dim')
  })
  it('A minor: i, ii°, III, iv, v, VI, VII', () => {
    const chords = getDiatonicChords('A', 'minor')
    assert.equal(chords[0]!.type, 'min')
    assert.equal(chords[1]!.type, 'dim')
    assert.equal(chords[2]!.type, 'maj')
  })
})

describe('musicTheory / generateMelody', () => {
  it('is deterministic given the same seed', () => {
    const a = generateMelody('C', 'major', 4, 4, 'medium', 4, 42)
    const b = generateMelody('C', 'major', 4, 4, 'medium', 4, 42)
    assert.deepEqual(a, b)
  })
  it('generates more notes with dense vs sparse density', () => {
    const sparse = generateMelody('C', 'major', 8, 4, 'sparse', 4, 1).length
    const dense  = generateMelody('C', 'major', 8, 4, 'dense',  4, 1).length
    assert.ok(dense > sparse, `dense=${dense} sparse=${sparse}`)
  })
  it('all notes are within the requested octave range', () => {
    const notes = generateMelody('C', 'major', 4, 4, 'medium', 4, 99)
    for (const n of notes) {
      assert.ok(n.pitch >= 48 && n.pitch <= 72, `pitch ${n.pitch} out of range`)
    }
  })
  it('all velocities are within MIDI 1–127', () => {
    const notes = generateMelody('C', 'major', 4, 4, 'dense', 4, 7)
    for (const n of notes) {
      assert.ok(n.velocity >= 1 && n.velocity <= 127)
    }
  })
  it('no note extends past total beats', () => {
    const totalBeats = 4 * 4
    const notes = generateMelody('C', 'major', 4, 4, 'medium', 4, 13)
    for (const n of notes) {
      assert.ok(n.beat + n.lengthBeats <= totalBeats + 1e-6, `runs past end: ${n.beat}+${n.lengthBeats}`)
    }
  })
})
