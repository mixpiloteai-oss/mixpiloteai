import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateAcidRamp } from '../../src/renderer/src/audio/ai/AcidRampGenerator.ts'
import { SeededRng } from '../../src/renderer/src/audio/ai/SeededRng.ts'

const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]

describe('AcidRampGenerator', () => {
  it('generateAcidRamp bars=2 → notes.length > 0', () => {
    const rng = new SeededRng(42)
    const result = generateAcidRamp({ bars: 2, bpm: 130, rootNote: 36, scale: MINOR_SCALE, rng, intensity: 0.8 })
    assert.ok(result.notes.length > 0, 'Should generate notes')
  })

  it('all notes have pitch in valid range (0-127)', () => {
    const rng = new SeededRng(42)
    const result = generateAcidRamp({ bars: 2, bpm: 130, rootNote: 36, scale: MINOR_SCALE, rng, intensity: 0.8 })
    for (const note of result.notes) {
      assert.ok(note.pitch >= 0 && note.pitch <= 127, `Pitch ${note.pitch} out of range`)
    }
  })

  it('all notes have velocity in valid range (1-127)', () => {
    const rng = new SeededRng(42)
    const result = generateAcidRamp({ bars: 2, bpm: 130, rootNote: 36, scale: MINOR_SCALE, rng, intensity: 0.8 })
    for (const note of result.notes) {
      assert.ok(note.velocity >= 1 && note.velocity <= 127, `Velocity ${note.velocity} out of range`)
    }
  })

  it('filterAutomation has points with first value < last value (rising sweep)', () => {
    const rng = new SeededRng(42)
    const result = generateAcidRamp({ bars: 4, bpm: 130, rootNote: 36, scale: MINOR_SCALE, rng, intensity: 0.8 })
    const pts = result.filterAutomation.points
    assert.ok(pts.length >= 2, 'Should have at least 2 automation points')
    const firstVal = pts[0]!.value
    const lastVal = pts[pts.length - 1]!.value
    assert.ok(firstVal < lastVal, `First filter value ${firstVal} should be less than last ${lastVal}`)
  })

  it('filterAutomation type is filter', () => {
    const rng = new SeededRng(42)
    const result = generateAcidRamp({ bars: 2, bpm: 130, rootNote: 36, scale: MINOR_SCALE, rng, intensity: 0.8 })
    assert.equal(result.filterAutomation.type, 'filter')
  })

  it('resonanceAutomation type is resonance', () => {
    const rng = new SeededRng(42)
    const result = generateAcidRamp({ bars: 2, bpm: 130, rootNote: 36, scale: MINOR_SCALE, rng, intensity: 0.8 })
    assert.equal(result.resonanceAutomation.type, 'resonance')
  })

  it('no two notes start on exact same beat', () => {
    const rng = new SeededRng(42)
    const result = generateAcidRamp({ bars: 2, bpm: 130, rootNote: 36, scale: MINOR_SCALE, rng, intensity: 0.8 })
    const beats = result.notes.map(n => Math.round(n.startBeat * 1000))
    const uniqueBeats = new Set(beats)
    assert.equal(uniqueBeats.size, beats.length, 'No two notes should start on same beat')
  })

  it('accent notes have higher velocity than non-accent', () => {
    const rng = new SeededRng(42)
    const result = generateAcidRamp({ bars: 4, bpm: 130, rootNote: 36, scale: MINOR_SCALE, rng, intensity: 1.0 })
    const accentNotes = result.notes.filter(n => n.accent)
    const nonAccentNotes = result.notes.filter(n => !n.accent)
    if (accentNotes.length > 0 && nonAccentNotes.length > 0) {
      const avgAccent = accentNotes.reduce((s, n) => s + n.velocity, 0) / accentNotes.length
      const avgNonAccent = nonAccentNotes.reduce((s, n) => s + n.velocity, 0) / nonAccentNotes.length
      assert.ok(avgAccent > avgNonAccent, 'Accent notes should be louder on average')
    }
  })
})
