// ─── DrumPatternLibrary.test.ts ───────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getPattern,
  createVariation,
  KICK,
  CLOSED_HH,
} from '../../src/renderer/src/audio/ai/DrumPatternLibrary.ts'

describe('DrumPatternLibrary / getPattern', () => {
  it('four-on-the-floor has kick (pitch 36) on beats 0,1,2,3', () => {
    const pattern = getPattern('four-on-the-floor', 1, 0)
    const kicks = pattern.notes.filter(n => n.pitch === KICK)
    assert.ok(kicks.length >= 4, `Expected at least 4 kicks, got ${kicks.length}`)
    const kickBeats = kicks.map(n => n.startBeat).sort((a, b) => a - b)
    assert.ok(kickBeats.includes(0), 'Should have kick at beat 0')
    assert.ok(kickBeats.includes(1), 'Should have kick at beat 1')
    assert.ok(kickBeats.includes(2), 'Should have kick at beat 2')
    assert.ok(kickBeats.includes(3), 'Should have kick at beat 3')
  })

  it('techno kick velocity = 110', () => {
    const pattern = getPattern('techno', 1, 0)
    const kicks = pattern.notes.filter(n => n.pitch === KICK)
    assert.ok(kicks.length > 0, 'Should have kicks')
    for (const kick of kicks) {
      assert.equal(kick.velocity, 110, `Expected velocity 110, got ${kick.velocity}`)
    }
  })

  it('trap has 16th note hi-hat pattern (pitch 42)', () => {
    const pattern = getPattern('trap', 1, 0)
    const hats = pattern.notes.filter(n => n.pitch === CLOSED_HH)
    // 16 16th notes per bar
    assert.ok(hats.length >= 16, `Expected at least 16 hi-hats, got ${hats.length}`)
    // Check positions at 0.25 increments
    const hatBeats = hats.map(n => n.startBeat)
    assert.ok(hatBeats.includes(0), 'Should have hat at beat 0')
    assert.ok(hatBeats.includes(0.25), 'Should have hat at beat 0.25')
    assert.ok(hatBeats.includes(0.5), 'Should have hat at beat 0.5')
  })
})

describe('DrumPatternLibrary / createVariation', () => {
  it('swing variation shifts 8th-note offsets', () => {
    const base = getPattern('four-on-the-floor', 1, 0)
    const swung = createVariation(base, 'swing', 0)
    // At least one note should be shifted from its original position
    const baseBeatSet  = new Set(base.notes.map(n => n.startBeat))
    const swungBeatSet = new Set(swung.notes.map(n => n.startBeat))
    // Swung version should have notes not in original (the 0.5+0.04 offsets)
    let hasShifted = false
    for (const beat of swungBeatSet) {
      if (!baseBeatSet.has(beat)) { hasShifted = true; break }
    }
    assert.ok(hasShifted, 'Swing should shift some note beats')
  })

  it('ghost_notes adds notes with velocity < 60', () => {
    const base = getPattern('four-on-the-floor', 1, 0)
    const ghosted = createVariation(base, 'ghost_notes', 0)
    const ghosts = ghosted.notes.filter(n => n.velocity < 60)
    assert.ok(ghosts.length > 0, `Expected ghost notes with velocity < 60, got ${ghosts.length}`)
  })

  it('fill variation has notes in the last beat area', () => {
    const bars = 2
    const base = getPattern('four-on-the-floor', bars, 0)
    const filled = createVariation(base, 'fill', 0)
    const fillStart = (bars - 1) * 4 + 3.0
    const fillNotes = filled.notes.filter(n => n.startBeat >= fillStart)
    assert.ok(fillNotes.length > 0, `Expected fill notes at beat >= ${fillStart}, got ${fillNotes.length}`)
  })
})
