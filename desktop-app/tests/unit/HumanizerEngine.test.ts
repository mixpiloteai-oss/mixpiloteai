import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { humanizeNotes } from '../../src/renderer/src/audio/ai/HumanizerEngine.ts'
import { SeededRng } from '../../src/renderer/src/audio/ai/SeededRng.ts'
import type { AnalysisNote } from '../../src/renderer/src/audio/ai/deep/AnalysisTypes.ts'

function makeNotes(count: number): AnalysisNote[] {
  return Array.from({ length: count }, (_, i) => ({
    pitch: 60,
    startBeat: i * 0.5,
    duration: 0.25,
    velocity: 80,
  }))
}

describe('HumanizerEngine', () => {
  it('output count equals input count', () => {
    const notes = makeNotes(8)
    const rng = new SeededRng(42)
    const result = humanizeNotes(notes, { timingAmount: 1.0, velocityAmount: 1.0, style: 'natural', rng })
    assert.equal(result.length, notes.length)
  })

  it('style=subtle: all timingOffsets within ±0.01', () => {
    const notes = makeNotes(16)
    const rng = new SeededRng(42)
    const result = humanizeNotes(notes, { timingAmount: 1.0, velocityAmount: 1.0, style: 'subtle', rng })
    for (const note of result) {
      assert.ok(
        Math.abs(note.timingOffset) <= 0.01,
        `Subtle timing offset ${note.timingOffset} exceeds ±0.01`
      )
    }
  })

  it('style=laid-back: all timingOffsets >= 0 (always late)', () => {
    const notes = makeNotes(16)
    const rng = new SeededRng(42)
    const result = humanizeNotes(notes, { timingAmount: 1.0, velocityAmount: 1.0, style: 'laid-back', rng })
    for (const note of result) {
      assert.ok(
        note.timingOffset >= 0,
        `Laid-back timing offset ${note.timingOffset} should be >= 0`
      )
    }
  })

  it('style=jazz: all timingOffsets >= 0 (always late)', () => {
    const notes = makeNotes(16)
    const rng = new SeededRng(42)
    const result = humanizeNotes(notes, { timingAmount: 1.0, velocityAmount: 1.0, style: 'jazz', rng })
    for (const note of result) {
      assert.ok(
        note.timingOffset >= 0,
        `Jazz timing offset ${note.timingOffset} should be >= 0`
      )
    }
  })

  it('all velocities after humanize stay in 1-127', () => {
    const notes = makeNotes(32)
    const rng = new SeededRng(42)
    const result = humanizeNotes(notes, { timingAmount: 1.0, velocityAmount: 1.0, style: 'drunk', rng })
    for (const note of result) {
      assert.ok(note.velocity >= 1 && note.velocity <= 127, `Velocity ${note.velocity} out of range`)
    }
  })

  it('style=natural: timingOffset > subtle', () => {
    // Subtle max is 0.005, natural max is 0.015 — natural should have larger deviations on average
    const notes = makeNotes(100)
    const rng1 = new SeededRng(42)
    const rng2 = new SeededRng(42)
    const subtle = humanizeNotes(notes, { timingAmount: 1.0, velocityAmount: 1.0, style: 'subtle', rng: rng1 })
    const natural = humanizeNotes(notes, { timingAmount: 1.0, velocityAmount: 1.0, style: 'natural', rng: rng2 })
    const subtleAvg = subtle.reduce((s, n) => s + Math.abs(n.timingOffset), 0) / subtle.length
    const naturalAvg = natural.reduce((s, n) => s + Math.abs(n.timingOffset), 0) / natural.length
    assert.ok(naturalAvg >= subtleAvg, 'Natural should have >= timing deviation than subtle')
  })

  it('notes with startBeat=0 stay >= 0 after humanize', () => {
    const notes: AnalysisNote[] = [{ pitch: 36, startBeat: 0, duration: 0.5, velocity: 100 }]
    const rng = new SeededRng(42)
    const result = humanizeNotes(notes, { timingAmount: 1.0, velocityAmount: 1.0, style: 'natural', rng })
    assert.ok(result[0]!.startBeat >= 0, 'startBeat should not go negative')
  })
})
