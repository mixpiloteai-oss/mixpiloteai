// ─── MIDI Humanize ────────────────────────────────────────────────────────────
// Adds human-like variations to MIDI notes to make them feel less mechanical.
//
// Techniques inspired by professional DAW humanization:
// - Velocity randomization (drummer-style dynamics)
// - Timing micro-shifts (push/drag feel)
// - Duration variations (legato/staccato feel)
// - Pitch variations (very subtle, optional)

import type { PRNote } from '../../components/piano-roll/types'

export interface HumanizeOptions {
  /** Velocity variation (0-127 range). Default: 8 */
  velocityRange: number
  /** Timing variation in ticks. Default: 5 */
  timingRange: number
  /** Duration variation as fraction (0-1). Default: 0.1 */
  durationRange: number
  /** Bias toward earlier (-1) or later (1) timing. Default: 0 */
  timingBias: number
  /** Seed for deterministic randomization. Optional. */
  seed?: number
  /** Apply only to selected notes */
  selectedOnly?: boolean
}

const DEFAULTS: HumanizeOptions = {
  velocityRange: 8,
  timingRange:   5,
  durationRange: 0.1,
  timingBias:    0,
}

// ─── Seeded random (Mulberry32) ───────────────────────────────────────────────

class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed
  }

  next(): number {
    let t = (this.state += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Gaussian-ish distribution (sum of 3 uniform, more natural feel)
  gaussian(): number {
    return (this.next() + this.next() + this.next()) / 3 - 0.5
  }
}

// ─── Humanize Engine ──────────────────────────────────────────────────────────

export class MidiHumanize {
  /**
   * Apply humanization to a set of notes. Returns new array (immutable).
   */
  static apply(notes: PRNote[], options?: Partial<HumanizeOptions>): PRNote[] {
    const opts = { ...DEFAULTS, ...options }
    const seed = opts.seed ?? Math.floor(Date.now() % 2147483647)
    const rng  = new SeededRandom(seed)

    return notes.map(note => {
      if (opts.selectedOnly && !note.selected) return note

      // Velocity: Gaussian variation around current value
      const velocityDelta = Math.round(rng.gaussian() * 2 * opts.velocityRange)
      const newVelocity = Math.max(1, Math.min(127, (note.velocity ?? 100) + velocityDelta))

      // Timing: shift with bias
      const timingDelta = (rng.gaussian() * 2 + opts.timingBias) * opts.timingRange
      const newStart = Math.max(0, note.startBeat + timingDelta)

      // Duration: variations
      const durationFactor = 1 + rng.gaussian() * 2 * opts.durationRange
      const newDuration = Math.max(1, note.lengthBeats * durationFactor)

      return {
        ...note,
        velocity:    newVelocity,
        startBeat:   newStart,
        lengthBeats: newDuration,
      }
    })
  }

  /**
   * Groove preset: tight (subtle), medium (musical), loose (live drummer)
   */
  static preset(level: 'tight' | 'medium' | 'loose' | 'sloppy'): HumanizeOptions {
    switch (level) {
      case 'tight':  return { velocityRange: 4,  timingRange: 2,  durationRange: 0.05, timingBias: 0 }
      case 'medium': return { velocityRange: 8,  timingRange: 5,  durationRange: 0.10, timingBias: 0 }
      case 'loose':  return { velocityRange: 15, timingRange: 10, durationRange: 0.15, timingBias: 0 }
      case 'sloppy': return { velocityRange: 25, timingRange: 18, durationRange: 0.25, timingBias: 0 }
    }
  }
}
