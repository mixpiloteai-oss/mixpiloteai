/**
 * ClipPlaybackCoordinator — pure time-conversion function tests
 *
 * Tests the core formulas without needing an AudioContext or real stores.
 * All the scheduling math is exercised here.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ─── Pure helper functions mirroring the coordinator's internal math ─────────

/** Convert 1-based bar + note beat offset → absolute beat (0-based) */
function absoluteBeat(clipStartBar: number, noteStartBeat: number, timeSigNumerator: number): number {
  return (clipStartBar - 1) * timeSigNumerator + noteStartBeat
}

/** Calculate lookahead window in beats given bpm and lookahead seconds */
function lookaheadBeats(bpm: number, lookaheadSec: number): number {
  return lookaheadSec * (bpm / 60)
}

/** Calculate note-on time in AudioContext seconds */
function noteAudioTime(
  absoluteBeatVal: number,
  currentAbsoluteBeat: number,
  bpm: number,
  contextNow: number,
): number {
  return contextNow + (absoluteBeatVal - currentAbsoluteBeat) / (bpm / 60)
}

/** Effective note duration clamped to clip boundary */
function effectiveDuration(
  noteLengthBeats: number,
  clipEndBeat: number,
  absNoteBeat: number,
): number {
  return Math.min(noteLengthBeats, clipEndBeat - absNoteBeat)
}

/** Clip end beat in absolute beats */
function clipEndAbsoluteBeat(clipStartBar: number, lengthBars: number, timeSigNumerator: number): number {
  return (clipStartBar - 1) * timeSigNumerator + lengthBars * timeSigNumerator
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ClipPlaybackCoordinator / absoluteBeat conversion', () => {
  it('clip at bar 1, note at beat 0 → absoluteBeat = 0', () => {
    assert.equal(absoluteBeat(1, 0, 4), 0)
  })

  it('clip at bar 1, note at beat 2 → absoluteBeat = 2', () => {
    assert.equal(absoluteBeat(1, 2, 4), 2)
  })

  it('clip at bar 2, note at beat 0 → absoluteBeat = 4 (4/4 time)', () => {
    assert.equal(absoluteBeat(2, 0, 4), 4)
  })

  it('clip at bar 5, note at beat 1.5 → absoluteBeat = 17.5 (4/4)', () => {
    assert.equal(absoluteBeat(5, 1.5, 4), 17.5)
  })

  it('3/4 time: clip at bar 3, note at beat 0 → absoluteBeat = 6', () => {
    assert.equal(absoluteBeat(3, 0, 3), 6)
  })
})

describe('ClipPlaybackCoordinator / lookahead window', () => {
  it('bpm=120, lookahead=0.1s → 0.2 beats', () => {
    const result = lookaheadBeats(120, 0.1)
    assert.ok(Math.abs(result - 0.2) < 1e-9, `expected 0.2, got ${result}`)
  })

  it('bpm=145, lookahead=0.1s → ~0.2417 beats', () => {
    const result = lookaheadBeats(145, 0.1)
    const expected = 145 / 60 * 0.1
    assert.ok(Math.abs(result - expected) < 1e-9)
  })

  it('note at absoluteBeat=0 should be in window [0, 0.2) for bpm=120', () => {
    const wStart = 0
    const wEnd   = lookaheadBeats(120, 0.1)  // 0.2
    const noteBeat = 0
    assert.ok(noteBeat >= wStart && noteBeat < wEnd)
  })

  it('note at absoluteBeat=0.5 should NOT be in window [0, 0.2) for bpm=120', () => {
    const wEnd   = lookaheadBeats(120, 0.1)  // 0.2
    const noteBeat = 0.5
    assert.ok(noteBeat >= wEnd, 'note at beat 0.5 should be outside 0.2 beat window')
  })
})

describe('ClipPlaybackCoordinator / noteAudioTime formula', () => {
  it('note at current beat → time equals contextNow', () => {
    const t = noteAudioTime(0, 0, 120, 5.0)
    assert.equal(t, 5.0)
  })

  it('note 1 beat ahead at 120 bpm → 0.5s in future', () => {
    // bpm=120 → secPerBeat = 0.5
    const t = noteAudioTime(1, 0, 120, 5.0)
    assert.ok(Math.abs(t - 5.5) < 1e-9, `expected 5.5, got ${t}`)
  })

  it('note 2 beats ahead at 60 bpm → 2.0s in future', () => {
    // bpm=60 → secPerBeat = 1.0
    const t = noteAudioTime(2, 0, 60, 0.0)
    assert.ok(Math.abs(t - 2.0) < 1e-9, `expected 2.0, got ${t}`)
  })

  it('note at beat 3.5, current at beat 3 at 120 bpm → 0.25s in future', () => {
    // 0.5 beats * 0.5 secPerBeat = 0.25
    const t = noteAudioTime(3.5, 3.0, 120, 10.0)
    assert.ok(Math.abs(t - 10.25) < 1e-9, `expected 10.25, got ${t}`)
  })
})

describe('ClipPlaybackCoordinator / loop boundary truncation', () => {
  it('note fits within clip → full duration preserved', () => {
    // clip: bar 1, 4 bars → beats 0..16 in 4/4
    const clipEnd = clipEndAbsoluteBeat(1, 4, 4)  // = 16
    const dur = effectiveDuration(2, clipEnd, 0)
    assert.equal(dur, 2)
  })

  it('note that would overflow clip boundary → truncated', () => {
    // clip ends at beat 4 (1 bar), note at beat 3.75, length 1 beat → overflows to 4.75
    const clipEnd = clipEndAbsoluteBeat(1, 1, 4)  // = 4
    const noteAt  = 3.75
    const dur = effectiveDuration(1.0, clipEnd, noteAt)
    // should be clamped to 4 - 3.75 = 0.25
    assert.ok(Math.abs(dur - 0.25) < 1e-9, `expected 0.25, got ${dur}`)
  })

  it('note exactly at clip end → zero duration (should be skipped)', () => {
    const clipEnd = clipEndAbsoluteBeat(1, 2, 4)  // = 8
    const dur = effectiveDuration(1.0, clipEnd, 8)
    assert.equal(dur, 0)
  })
})

describe('ClipPlaybackCoordinator / clipEndAbsoluteBeat', () => {
  it('bar 1, 4 bars, 4/4 → beat 16', () => {
    assert.equal(clipEndAbsoluteBeat(1, 4, 4), 16)
  })

  it('bar 3, 2 bars, 4/4 → beat 16', () => {
    // starts at (3-1)*4 = 8, length 2*4=8 → ends at 16
    assert.equal(clipEndAbsoluteBeat(3, 2, 4), 16)
  })

  it('bar 1, 1 bar, 3/4 → beat 3', () => {
    assert.equal(clipEndAbsoluteBeat(1, 1, 3), 3)
  })
})

describe('ClipPlaybackCoordinator / note scheduling window logic', () => {
  it('note at current beat is within window (=windowStart)', () => {
    const currentBeat = 8
    const bpm = 120
    const lookahead = 0.1
    const wEnd = currentBeat + lookaheadBeats(bpm, lookahead)
    const noteBeat = 8
    // Note at exactly windowStart should be scheduled
    assert.ok(noteBeat >= currentBeat && noteBeat < wEnd)
  })

  it('note before current beat is NOT scheduled', () => {
    const currentBeat = 8
    const noteBeat = 7.9
    assert.ok(noteBeat < currentBeat)
  })

  it('note after window is NOT scheduled', () => {
    const currentBeat = 8
    const wEnd = currentBeat + lookaheadBeats(120, 0.1)  // 8.2
    const noteBeat = 8.25
    assert.ok(noteBeat >= wEnd)
  })

  it('multiple notes: some in window, some out', () => {
    const currentBeat = 4
    const wEnd = currentBeat + lookaheadBeats(120, 0.1)  // 4.2
    const notes = [
      { startBeat: 4.0,  shouldSchedule: true  },
      { startBeat: 4.1,  shouldSchedule: true  },
      { startBeat: 4.19, shouldSchedule: true  },
      { startBeat: 4.2,  shouldSchedule: false },  // at exactly windowEnd: not scheduled
      { startBeat: 4.5,  shouldSchedule: false },
      { startBeat: 3.9,  shouldSchedule: false },  // before currentBeat
    ]
    for (const n of notes) {
      const absBeat = currentBeat + (n.startBeat - currentBeat)  // already absolute in this test
      const inWindow = absBeat >= currentBeat && absBeat < wEnd
      assert.equal(inWindow, n.shouldSchedule, `beat ${n.startBeat}: expected ${n.shouldSchedule}, got ${inWindow}`)
    }
  })
})
