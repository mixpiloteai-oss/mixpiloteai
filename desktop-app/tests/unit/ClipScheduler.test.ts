// ─── ClipScheduler.test.ts ────────────────────────────────────────────────────
// Tests for pure timing functions in ClipScheduler.ts (Node-compatible).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getNextQuantBoundary,
  quantizationToBeats,
  clipProgress,
  currentBeatPosition,
} from '../../src/renderer/src/audio/clip/ClipScheduler.ts'

describe('quantizationToBeats', () => {
  it('1 bar = 4 beats', () => {
    assert.equal(quantizationToBeats('1'), 4)
  })

  it('1/4 = 1 beat', () => {
    assert.equal(quantizationToBeats('1/4'), 1)
  })

  it('none = 0', () => {
    assert.equal(quantizationToBeats('none'), 0)
  })

  it('1/32 = 0.125 beats', () => {
    assert.equal(quantizationToBeats('1/32'), 4 / 32)
  })

  it('1/16 = 0.25 beats', () => {
    assert.equal(quantizationToBeats('1/16'), 4 / 16)
  })

  it('2 bars = 8 beats', () => {
    assert.equal(quantizationToBeats('2'), 8)
  })

  it('4 bars = 16 beats', () => {
    assert.equal(quantizationToBeats('4'), 16)
  })
})

describe('getNextQuantBoundary', () => {
  it('none returns currentTime immediately', () => {
    assert.equal(getNextQuantBoundary('none', 120, 1.5), 1.5)
  })

  it('1 bar at 120bpm from 0.0 = 2.0s', () => {
    // At 120bpm, 1 bar = 4 beats = 2s. Next boundary from 0 = 2s.
    assert.equal(getNextQuantBoundary('1', 120, 0.0), 2.0)
  })

  it('1 bar at 120bpm from 1.0 = 2.0s (still same bar)', () => {
    assert.equal(getNextQuantBoundary('1', 120, 1.0), 2.0)
  })

  it('1 bar at 120bpm from 2.1 = 4.0s (past first bar)', () => {
    assert.ok(Math.abs(getNextQuantBoundary('1', 120, 2.1) - 4.0) < 1e-9)
  })

  it('1/4 beat at 120bpm from 0.0 = 0.5s', () => {
    // 1 beat at 120bpm = 0.5s
    assert.equal(getNextQuantBoundary('1/4', 120, 0.0), 0.5)
  })

  it('1/4 beat at 120bpm from 0.6 = 1.0s', () => {
    assert.ok(Math.abs(getNextQuantBoundary('1/4', 120, 0.6) - 1.0) < 1e-9)
  })

  it('1/2 bar at 120bpm from 0.0 = 1.0s (2 beats = 1s)', () => {
    assert.equal(getNextQuantBoundary('1/2', 120, 0.0), 1.0)
  })
})

describe('currentBeatPosition', () => {
  it('0s at 120bpm = beat 0', () => {
    assert.equal(currentBeatPosition(120, 0), 0)
  })

  it('0.5s at 120bpm = beat 1', () => {
    assert.equal(currentBeatPosition(120, 0.5), 1)
  })

  it('2.0s at 120bpm = beat 4', () => {
    assert.equal(currentBeatPosition(120, 2.0), 4)
  })
})

describe('clipProgress', () => {
  it('returns 0 before clip starts', () => {
    assert.equal(clipProgress(1.0, 4, 120, 0.5), 0)
  })

  it('4-beat clip at 120bpm: 1s in = 0.5 progress', () => {
    // 4 beats at 120bpm = 2s total, 1s elapsed = 0.5
    assert.ok(Math.abs(clipProgress(0, 4, 120, 1.0) - 0.5) < 1e-9)
  })

  it('loops: 1s into 2nd loop of 2s clip returns 0.5', () => {
    // 2-beat clip at 120bpm = 1s. At 1.5s with start=0: elapsed=1.5, 1.5%1.0=0.5, progress=0.5
    assert.ok(Math.abs(clipProgress(0, 2, 120, 1.5) - 0.5) < 1e-9)
  })

  it('0 length returns 0', () => {
    assert.equal(clipProgress(0, 0, 120, 1.0), 0)
  })

  it('at exact start returns 0', () => {
    assert.equal(clipProgress(0, 4, 120, 0), 0)
  })

  it('at end of loop returns 0 (wraps)', () => {
    // 4 beats at 120bpm = 2s. At exactly 2.0s: elapsed=2, 2%2=0, progress=0
    assert.equal(clipProgress(0, 4, 120, 2.0), 0)
  })
})
