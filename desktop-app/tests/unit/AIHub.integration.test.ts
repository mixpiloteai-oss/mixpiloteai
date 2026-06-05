// ─── AIHub.integration.test.ts ─────────────────────────────────────────────────
// Integration: AIActionManager + MidiCorrector + FillGenerator working together.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AIActionManager } from '../../src/renderer/src/audio/ai/AIActionManager.ts'
import { MidiCorrector } from '../../src/renderer/src/audio/ai/MidiCorrector.ts'
import type { MidiNote } from '../../src/renderer/src/audio/ai/MidiCorrector.ts'
import { FillGenerator } from '../../src/renderer/src/audio/ai/FillGenerator.ts'

function note(id: string, pitch: number, startBeat: number, duration: number, velocity: number): MidiNote {
  return { id, pitch, startBeat, duration, velocity }
}

describe('AIHub Integration', () => {
  it('FillGenerator → AIActionManager: fill notes packaged as AI action', () => {
    const fillGen = new FillGenerator()
    const mgr = new AIActionManager()

    const fillNotes = fillGen.generate({
      style: 'snare-roll',
      lengthBeats: 2,
      startBeat: 30,
      intensity: 0.8,
      bpm: 130,
      seed: 123,
    })

    assert.ok(fillNotes.length >= 1)

    const action = mgr.createAction(
      'add-midi-notes',
      'Snare Roll Fill',
      `Generated ${fillNotes.length} notes at beat 30`,
      'ajoute un snare roll',
      {
        midiNotes: fillNotes.map(n => ({
          pitch: n.pitch,
          startBeat: n.startBeat,
          duration: n.duration,
          velocity: n.velocity,
        })),
      },
      0.87,
    )

    assert.strictEqual(action.status, 'pending')
    assert.strictEqual(action.previewData.midiNotes?.length, fillNotes.length)
    assert.strictEqual(action.type, 'add-midi-notes')
  })

  it('MidiCorrector → AIActionManager: correction result packaged as preview', () => {
    const corrector = new MidiCorrector()
    const mgr = new AIActionManager()

    const raw: MidiNote[] = [
      note('a', 60, 0.13, 0.25, 40),
      note('b', 62, 0.38, 0.25, 120),
      note('c', 64, 0.62, 0.25, 30),
    ]

    const result = corrector.correctAll(raw, {
      quantizeStrength: 0.8,
      quantizeGrid: 0.25,
      velocitySmoothing: 0.5,
      removeOutliers: false,
      pitchRange: { min: 0, max: 127 },
    })

    const action = mgr.createAction(
      'replace-midi-notes',
      'Correct MIDI Timing & Velocity',
      `${result.changes.length} corrections applied, quality: ${(result.qualityBefore * 100).toFixed(0)}% → ${(result.qualityAfter * 100).toFixed(0)}%`,
      'corrige le MIDI',
      {
        midiNotes: result.notes.map(n => ({
          pitch: n.pitch,
          startBeat: n.startBeat,
          duration: n.duration,
          velocity: n.velocity,
        })),
      },
      0.9,
    )

    assert.strictEqual(action.type, 'replace-midi-notes')
    assert.ok(action.previewData.midiNotes!.length === raw.length)
  })

  it('AIActionManager: apply → undo → history flow', () => {
    const mgr = new AIActionManager()

    const a1 = mgr.createAction('suggest-only', 'Suggest A', 'desc A', 'cmd A', { textSuggestion: 'suggestion A' }, 0.7)
    const a2 = mgr.createAction('suggest-only', 'Suggest B', 'desc B', 'cmd B', { textSuggestion: 'suggestion B' }, 0.85)

    // Apply first, reject second
    assert.ok(mgr.applyAction(a1.id))
    mgr.rejectAction(a2.id)

    const history = mgr.getHistory()
    assert.strictEqual(history.length, 2)

    // Undo the applied action
    assert.ok(mgr.undoAction(a1.id))
    assert.strictEqual(mgr.getAction(a1.id)?.status, 'undone')

    // Acceptance rate: 0 applied, 1 rejected (undone doesn't count as applied)
    assert.strictEqual(mgr.totalApplied, 0)
    assert.strictEqual(mgr.totalRejected, 1)
  })

  it('FillGenerator: all 7 styles produce valid notes for 1-bar fill', () => {
    const gen = new FillGenerator()
    const styles = ['snare-roll', 'tom-fill', 'crash-buildup', 'tribal', 'trap-roll', 'break', 'simple'] as const

    for (const style of styles) {
      const notes = gen.generate({
        style,
        lengthBeats: 4,
        startBeat: 0,
        intensity: 0.6,
        bpm: 120,
        seed: 77,
      })

      assert.ok(notes.length >= 1, `style=${style}: no notes generated`)

      for (const n of notes) {
        assert.ok(n.pitch >= 0 && n.pitch <= 127, `${style}: pitch out of range: ${n.pitch}`)
        assert.ok(n.velocity >= 1 && n.velocity <= 127, `${style}: velocity out of range: ${n.velocity}`)
        assert.ok(n.duration > 0, `${style}: non-positive duration: ${n.duration}`)
        assert.ok(n.startBeat >= 0, `${style}: negative startBeat: ${n.startBeat}`)
      }
    }
  })

  it('MidiCorrector: full pipeline on 10-note sequence improves quality', () => {
    const corrector = new MidiCorrector()

    // Create a sequence with timing jitter and velocity extremes
    const notes: MidiNote[] = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      pitch: 60 + i,
      startBeat: i * 0.25 + (Math.random() * 0.08 - 0.04), // jitter ±0.04
      duration: 0.2,
      velocity: i % 2 === 0 ? 20 : 120, // alternating extremes
    }))

    const qualityBefore = corrector.computeQuality(notes, 0.25)

    const result = corrector.correctAll(notes, {
      quantizeStrength: 1.0,
      quantizeGrid: 0.25,
      velocitySmoothing: 1.0,
      removeOutliers: false,
      pitchRange: { min: 0, max: 127 },
    })

    assert.ok(result.qualityAfter >= qualityBefore - 0.01,
      `quality did not improve: ${qualityBefore} → ${result.qualityAfter}`)
    assert.strictEqual(result.notes.length, 10)
  })

  it('AIActionManager: pending → preview → apply flow', () => {
    const mgr = new AIActionManager()

    const action = mgr.createAction(
      'add-automation',
      'LFO Sweep',
      'Add filter LFO automation',
      'ajoute un LFO sur le filtre',
      { automationPoints: [{ laneId: 'filter', beat: 0, value: 0.5 }] },
      0.75,
    )

    assert.strictEqual(action.status, 'pending')
    assert.strictEqual(mgr.getPendingActions().length, 1)

    mgr.previewAction(action.id)
    assert.strictEqual(mgr.getAction(action.id)?.status, 'previewing')
    // still counts as pending
    assert.strictEqual(mgr.getPendingActions().length, 1)

    mgr.applyAction(action.id)
    assert.strictEqual(mgr.getAction(action.id)?.status, 'applied')
    assert.strictEqual(mgr.getPendingActions().length, 0)
    assert.strictEqual(mgr.getHistory().length, 1)
  })
})
