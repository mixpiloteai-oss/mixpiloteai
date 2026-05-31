// ─── PatternGenerator.test.ts ─────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateKickPattern,
  generateBassPattern,
  generateHihatPattern,
  generateBuildup,
  generateDrop,
} from '../../src/renderer/src/audio/ai/PatternGenerator.ts'

describe('PatternGenerator / kick', () => {
  it('generateKickPattern("tribe", 1) → has notes, all pitch=36', () => {
    const pattern = generateKickPattern('tribe', 1)
    assert.ok(pattern.notes.length > 0, 'Should have notes')
    for (const note of pattern.notes) {
      assert.equal(note.pitch, 36, `All kick pitches should be 36, got ${note.pitch}`)
    }
  })

  it('generateKickPattern("techno", 2) → notes at every beat, velocity=110', () => {
    const pattern = generateKickPattern('techno', 2)
    // 2 bars * 4 beats = 8 notes on the floor
    assert.ok(pattern.notes.length >= 8, `Expected at least 8 notes, got ${pattern.notes.length}`)
    for (const note of pattern.notes) {
      assert.equal(note.velocity, 110, `All techno kick velocities should be 110, got ${note.velocity}`)
    }
  })
})

describe('PatternGenerator / bass', () => {
  it('generateBassPattern("aggressive", 1) → all notes have velocity >= 100', () => {
    const pattern = generateBassPattern('aggressive', 1)
    assert.ok(pattern.notes.length > 0, 'Should have notes')
    for (const note of pattern.notes) {
      assert.ok(note.velocity >= 100, `Expected velocity >= 100, got ${note.velocity}`)
    }
  })
})

describe('PatternGenerator / hihat', () => {
  it('generateHihatPattern("straight", 1) → 8 notes (8th notes per bar)', () => {
    const pattern = generateHihatPattern('straight', 1)
    assert.equal(pattern.notes.length, 8, `Expected 8 notes for straight 1 bar, got ${pattern.notes.length}`)
  })
})

describe('PatternGenerator / buildup', () => {
  it('generateBuildup(2) → notes span both bars, velocity increases', () => {
    const pattern = generateBuildup(2)
    assert.ok(pattern.notes.length > 0, 'Buildup should have notes')

    // Check span: some notes should be in bar 2 (startBeat >= 4)
    const bar2Notes = pattern.notes.filter(n => n.startBeat >= 4)
    assert.ok(bar2Notes.length > 0, 'Buildup should have notes in bar 2 (startBeat >= 4)')

    // Check velocity increases: last note should have higher velocity than first
    const sorted    = [...pattern.notes].sort((a, b) => a.startBeat - b.startBeat)
    const firstVel  = sorted[0].velocity
    const lastVel   = sorted[sorted.length - 1].velocity
    assert.ok(lastVel >= firstVel, `Last velocity (${lastVel}) should be >= first velocity (${firstVel})`)
  })
})

describe('PatternGenerator / drop', () => {
  it('generateDrop(2) → first note is kick at beat 0', () => {
    const pattern = generateDrop(2)
    assert.ok(pattern.notes.length > 0, 'Drop should have notes')

    const firstNote = [...pattern.notes].sort((a, b) => a.startBeat - b.startBeat)[0]
    assert.equal(firstNote.startBeat, 0,  `First note startBeat should be 0, got ${firstNote.startBeat}`)
    assert.equal(firstNote.pitch,     36, `First note should be kick (pitch 36), got ${firstNote.pitch}`)
  })
})
