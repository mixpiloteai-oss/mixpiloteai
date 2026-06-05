// ─── BasslineGenerator.test.ts ────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateBassline } from '../../src/renderer/src/audio/ai/BasslineGenerator.ts'

describe('BasslineGenerator', () => {
  it('root_only C major bars=1 → notes on beats 0 and 2 only', () => {
    const pattern = generateBassline({
      key:       { root: 0, mode: 'major' },
      style:     'pop',
      bassStyle: 'root_only',
      bars:      1,
      octave:    2,
      seed:      0,
    })
    const beats = pattern.notes.map(n => n.startBeat).sort((a, b) => a - b)
    assert.equal(beats.length, 2, `Expected 2 notes (root_only 1 bar), got ${beats.length}`)
    assert.equal(beats[0], 0, `First note should be on beat 0, got ${beats[0]}`)
    assert.equal(beats[1], 2, `Second note should be on beat 2, got ${beats[1]}`)
  })

  it('root_only C major → pitch should be 36 (C2)', () => {
    const pattern = generateBassline({
      key:       { root: 0, mode: 'major' },
      style:     'pop',
      bassStyle: 'root_only',
      bars:      1,
      octave:    2,
      seed:      0,
    })
    for (const note of pattern.notes) {
      assert.equal(note.pitch, 36, `Expected C2 (36), got ${note.pitch}`)
    }
  })

  it('arpeggio bars=1 → at least 4 notes', () => {
    const pattern = generateBassline({
      key:       { root: 0, mode: 'major' },
      style:     'pop',
      bassStyle: 'arpeggio',
      bars:      1,
      octave:    2,
      seed:      0,
    })
    assert.ok(pattern.notes.length >= 4, `Expected >= 4 notes for arpeggio, got ${pattern.notes.length}`)
  })

  it('all pitches in bass range [24, 60]', () => {
    for (const bassStyle of ['root_only', 'walking', 'syncopated', 'groove', 'arpeggio'] as const) {
      const pattern = generateBassline({
        key:       { root: 0, mode: 'major' },
        style:     'pop',
        bassStyle,
        bars:      2,
        octave:    2,
        seed:      42,
      })
      for (const note of pattern.notes) {
        assert.ok(note.pitch >= 24 && note.pitch <= 60,
          `[${bassStyle}] Pitch ${note.pitch} out of bass range [24, 60]`)
      }
    }
  })

  it('walking bars=1 → at least 4 notes (one per beat)', () => {
    const pattern = generateBassline({
      key:       { root: 0, mode: 'major' },
      style:     'pop',
      bassStyle: 'walking',
      bars:      1,
      octave:    2,
      seed:      0,
    })
    assert.ok(pattern.notes.length >= 4, `Expected >= 4 notes for walking 1 bar, got ${pattern.notes.length}`)
  })
})
