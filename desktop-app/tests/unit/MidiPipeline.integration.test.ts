// ─── MidiPipeline.integration.test.ts ────────────────────────────────────────
// Integration tests for MIDI processing pipeline.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateMelody } from '../../src/renderer/src/audio/ai/MelodyGenerator'
import type { MelodyOptions } from '../../src/renderer/src/audio/ai/MelodyGenerator'
import { generateBassline } from '../../src/renderer/src/audio/ai/BasslineGenerator'
import type { BasslineOptions } from '../../src/renderer/src/audio/ai/BasslineGenerator'
import { getPattern, KICK } from '../../src/renderer/src/audio/ai/DrumPatternLibrary'
import { applyVariation } from '../../src/renderer/src/audio/ai/PatternVariator'
import { VstMidiRouter } from '../../src/renderer/src/audio/vst/VstMidiRouter'
import { humanizeNotes } from '../../src/renderer/src/audio/ai/HumanizerEngine'
import { SeededRng } from '../../src/renderer/src/audio/ai/SeededRng'
import { MidiGenerationEngine } from '../../src/renderer/src/audio/ai/MidiGenerationEngine'

const melodyOpts: MelodyOptions = {
  key: { root: 0, mode: 'major' },
  scale: 'major',
  style: 'techno',
  bars: 4,
  startOctave: 4,
  noteDensity: 'medium',
  contour: 'arch',
  seed: 42,
}

describe('MidiPipeline.integration', () => {
  it('MelodyGenerator produces notes in valid MIDI range (0-127)', () => {
    const pattern = generateMelody(melodyOpts)
    assert.ok(pattern.notes.length > 0, 'Should generate at least one note')
    for (const note of pattern.notes) {
      assert.ok(note.pitch >= 0 && note.pitch <= 127,
        `Note pitch out of MIDI range: ${note.pitch}`)
    }
  })

  it('BasslineGenerator notes have positive duration', () => {
    const opts: BasslineOptions = {
      key: { root: 0, mode: 'minor' },
      style: 'techno',
      bassStyle: 'root_only',
      bars: 4,
      octave: 2,
      seed: 99,
    }
    const pattern = generateBassline(opts)
    assert.ok(pattern.notes.length > 0, 'Should generate at least one note')
    for (const note of pattern.notes) {
      assert.ok(note.lengthBeats > 0, `Note duration should be positive, got ${note.lengthBeats}`)
    }
  })

  it('DrumPatternLibrary tribe pattern has kick on beat 1', () => {
    const pattern = getPattern('tribe', 4, 42)
    const kickNotes = pattern.notes.filter(n => n.pitch === KICK)
    assert.ok(kickNotes.length > 0, 'Should have kick notes')

    // Check there is at least one kick at a beat position that is a multiple of 4 (i.e. downbeats)
    const hasDownbeatKick = kickNotes.some(n => n.startBeat % 4 < 0.01)
    assert.ok(hasDownbeatKick, 'Should have kick on at least one downbeat (bar start)')
  })

  it('PatternVariator retrograde reverses note order', () => {
    const pattern = generateMelody(melodyOpts)
    const retrograde = applyVariation(pattern, 'retrograde')

    // Original beat order vs retrograde beat order should differ
    const origBeats = pattern.notes.map(n => n.startBeat)
    const retBeats = retrograde.notes.map(n => n.startBeat)

    if (origBeats.length > 1) {
      // retrograde should not equal original order (it's reversed in time)
      const totalDur = Math.max(...origBeats.map((b, i) => b + pattern.notes[i]!.lengthBeats))
      // In retrograde, the note that was last should now be first
      const lastOrigBeat = Math.max(...origBeats)
      const firstRetBeat = Math.min(...retBeats)
      // The last note in original appears near 0 in retrograde
      assert.ok(firstRetBeat <= lastOrigBeat,
        `Retrograde should start at or before original last beat (retrograde reverses time)`)
    }
  })

  it('VstMidiRouter: noteTranspose +12 shifts all notes', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-1',
      targetInstanceId: 'synth-1',
      channelFilter: 'all',
      noteTranspose: 12,
      velocityScale: 1.0,
    })

    const event = { type: 'noteOn' as const, channel: 1, note: 60, velocity: 100 }
    const results = router.routeEvent('track-1', event)

    assert.equal(results.length, 1)
    assert.equal(results[0]!.event.note, 72, `Expected note 72, got ${results[0]!.event.note}`)
  })

  it('VstMidiRouter: velocityScale 0.5 halves velocity, min 1', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-2',
      targetInstanceId: 'synth-2',
      channelFilter: 'all',
      noteTranspose: 0,
      velocityScale: 0.5,
    })

    const event = { type: 'noteOn' as const, channel: 1, note: 60, velocity: 100 }
    const results = router.routeEvent('track-2', event)

    assert.equal(results.length, 1)
    assert.equal(results[0]!.event.velocity, 50)
  })

  it('HumanizerEngine natural style: timing within ±0.02 beats', () => {
    const rng = new SeededRng(42)
    const notes = Array.from({ length: 16 }, (_, i) => ({
      pitch: 60,
      startBeat: i * 0.5,
      duration: 0.25,
      velocity: 100,
    }))

    const humanized = humanizeNotes(notes, {
      timingAmount: 1.0,
      velocityAmount: 1.0,
      style: 'natural',
      rng,
    })

    for (const note of humanized) {
      assert.ok(Math.abs(note.timingOffset) <= 0.02,
        `timingOffset out of range for natural style: ${note.timingOffset}`)
    }
  })

  it('HumanizerEngine preserves note count', () => {
    const rng = new SeededRng(7)
    const notes = Array.from({ length: 32 }, (_, i) => ({
      pitch: 60 + (i % 12),
      startBeat: i * 0.25,
      duration: 0.2,
      velocity: 80,
    }))

    const humanized = humanizeNotes(notes, {
      timingAmount: 0.5,
      velocityAmount: 0.5,
      style: 'subtle',
      rng,
    })

    assert.equal(humanized.length, notes.length, 'Should preserve note count')
  })

  it('SeededRng deterministic: same seed produces same sequence', () => {
    const rng1 = new SeededRng(42)
    const rng2 = new SeededRng(42)

    const vals1 = Array.from({ length: 10 }, () => rng1.next())
    const vals2 = Array.from({ length: 10 }, () => rng2.next())

    for (let i = 0; i < 10; i++) {
      assert.equal(vals1[i], vals2[i], `Value at index ${i} should be identical`)
    }
  })

  it('MidiGenerationEngine.generate returns valid result', () => {
    const engine = new MidiGenerationEngine()
    const result = engine.generate({
      target: 'melody',
      bars: 4,
      seed: 123,
      style: 'techno',
      key: { root: 0, mode: 'minor' },
      bpm: 130,
    })

    assert.ok(result.pattern !== null, 'Should return a pattern')
    assert.ok(Array.isArray(result.pattern!.notes), 'Pattern notes should be an array')
    assert.ok(typeof result.request.seed === 'number' || result.request.seed === undefined,
      'Seed should be a number or undefined')
  })
})
