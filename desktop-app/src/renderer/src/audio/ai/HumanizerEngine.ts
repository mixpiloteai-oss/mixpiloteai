// ─── HumanizerEngine.ts ───────────────────────────────────────────────────────
// Applies human-like timing and velocity variations to notes.

import type { AnalysisNote } from './deep/AnalysisTypes'
import { SeededRng } from './SeededRng'

export type HumanizeStyle = 'subtle' | 'natural' | 'drunk' | 'jazz' | 'laid-back'

export interface HumanizerOptions {
  timingAmount: number    // 0-1
  velocityAmount: number  // 0-1
  style: HumanizeStyle
  rng: SeededRng
}

export interface HumanizedNote extends AnalysisNote {
  timingOffset: number    // in beats, can be negative
  velocityOffset: number  // signed integer
}

const STYLE_PARAMS: Record<HumanizeStyle, {
  timingRange: number      // max absolute timing offset in beats
  velocityRange: number    // max absolute velocity offset
  lateOnly?: boolean       // true = always late (positive offset)
  lateMin?: number         // minimum late amount
  jazzSwing?: boolean      // apply jazz velocity swing
}> = {
  subtle:    { timingRange: 0.005, velocityRange: 8 },
  natural:   { timingRange: 0.015, velocityRange: 15 },
  drunk:     { timingRange: 0.04,  velocityRange: 25 },
  jazz:      { timingRange: 0.025, velocityRange: 20, lateOnly: true, lateMin: 0.005, jazzSwing: true },
  'laid-back': { timingRange: 0.03, velocityRange: 12, lateOnly: true, lateMin: 0.01 },
}

/**
 * Apply humanization to a set of notes.
 */
export function humanizeNotes(notes: AnalysisNote[], options: HumanizerOptions): HumanizedNote[] {
  const { style, rng, timingAmount, velocityAmount } = options
  const params = STYLE_PARAMS[style]

  return notes.map(note => {
    const timingRange = params.timingRange * timingAmount
    const velocityRange = params.velocityRange * velocityAmount

    let timingOffset: number
    if (params.lateOnly) {
      // Always late: offset in [lateMin, timingRange]
      const min = params.lateMin ?? 0
      timingOffset = min + rng.next() * (timingRange - min)
    } else {
      // Symmetric: offset in [-timingRange, +timingRange]
      timingOffset = (rng.next() * 2 - 1) * timingRange
    }

    let velocityOffset: number
    if (params.jazzSwing) {
      // Jazz: strong beats (0, 2) louder, weak beats (1, 3) softer
      const beatPos = note.startBeat % 4
      const isStrongBeat = beatPos < 0.5 || (beatPos >= 2.0 && beatPos < 2.5)
      const swingFactor = isStrongBeat ? 1 : -0.5
      velocityOffset = Math.round(swingFactor * velocityRange * (0.5 + rng.next() * 0.5))
    } else {
      // Symmetric velocity variation
      velocityOffset = Math.round((rng.next() * 2 - 1) * velocityRange)
    }

    // Clamp timing so note doesn't go negative
    const newStartBeat = Math.max(0, note.startBeat + timingOffset)
    const actualTimingOffset = newStartBeat - note.startBeat

    // Clamp velocity 1-127
    const newVelocity = Math.max(1, Math.min(127, note.velocity + velocityOffset))
    const actualVelocityOffset = newVelocity - note.velocity

    return {
      ...note,
      startBeat: newStartBeat,
      velocity: newVelocity,
      timingOffset: actualTimingOffset,
      velocityOffset: actualVelocityOffset,
    }
  })
}
