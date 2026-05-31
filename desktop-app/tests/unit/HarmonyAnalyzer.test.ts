// ─── HarmonyAnalyzer.test.ts ──────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPitchClassProfile,
  detectKey,
  NOTE_NAMES,
} from '../../src/renderer/src/audio/ai/HarmonyAnalyzer.ts'
import type { MidiNote } from '../../src/renderer/src/types/project.ts'

function makeNote(pitch: number, startBeat = 0, lengthBeats = 1, velocity = 100): MidiNote {
  return { id: `n-${pitch}-${startBeat}`, pitch, startBeat, lengthBeats, velocity }
}

// C major chord: C=60, E=64, G=67
const C_MAJOR_NOTES: MidiNote[] = [
  makeNote(60), makeNote(64), makeNote(67),
  makeNote(72), makeNote(76), makeNote(79), // octave up
]

// A minor chord: A=69, C=72, E=76
const A_MINOR_NOTES: MidiNote[] = [
  makeNote(69), makeNote(72), makeNote(76),
  makeNote(57), makeNote(60), makeNote(64),
]

describe('HarmonyAnalyzer / buildPitchClassProfile', () => {
  it('all C notes → bin 0 is nonzero, rest are 0', () => {
    const notes: MidiNote[] = [
      makeNote(60), makeNote(72), makeNote(48), makeNote(84),
    ]
    const pcp = buildPitchClassProfile(notes)
    assert.ok(pcp[0] > 0, 'bin 0 (C) should be nonzero')
    for (let i = 1; i < 12; i++) {
      assert.equal(pcp[i], 0, `bin ${i} should be 0 for all-C notes`)
    }
  })

  it('empty notes → all zeros', () => {
    const pcp = buildPitchClassProfile([])
    for (let i = 0; i < 12; i++) {
      assert.equal(pcp[i], 0, `bin ${i} should be 0 for empty input`)
    }
  })
})

describe('HarmonyAnalyzer / detectKey', () => {
  it('only C major notes (C, E, G) → detected as C major', () => {
    const result = detectKey(C_MAJOR_NOTES)
    assert.equal(result.mode, 'major', `Expected major mode, got ${result.mode}`)
    assert.equal(result.root, 0, `Expected root 0 (C), got ${result.root} (${NOTE_NAMES[result.root]})`)
    assert.ok(result.confidence > 0.5, `Expected confidence > 0.5, got ${result.confidence}`)
  })

  it('only A minor notes (A, C, E) → detected as A minor', () => {
    const result = detectKey(A_MINOR_NOTES)
    assert.equal(result.mode, 'minor', `Expected minor mode, got ${result.mode}`)
    assert.equal(result.root, 9, `Expected root 9 (A), got ${result.root} (${NOTE_NAMES[result.root]})`)
    assert.ok(result.confidence > 0.5, `Expected confidence > 0.5, got ${result.confidence}`)
  })

  it('empty notes → returns result with confidence 0', () => {
    const result = detectKey([])
    assert.equal(result.confidence, 0, 'Empty notes should return confidence 0')
  })
})

describe('HarmonyAnalyzer / NOTE_NAMES', () => {
  it('NOTE_NAMES has 12 entries', () => {
    assert.equal(NOTE_NAMES.length, 12, `Expected 12 note names, got ${NOTE_NAMES.length}`)
  })
})
