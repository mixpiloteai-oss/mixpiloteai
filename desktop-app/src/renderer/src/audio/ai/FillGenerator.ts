// ─── FillGenerator.ts ─────────────────────────────────────────────────────────
// Generates drum fills at specified positions.

import { SeededRng } from './SeededRng'

export type FillStyle =
  | 'snare-roll'
  | 'tom-fill'
  | 'crash-buildup'
  | 'tribal'
  | 'trap-roll'
  | 'break'
  | 'simple'

export interface FillOptions {
  style: FillStyle
  lengthBeats: number   // typically 1 or 2
  startBeat: number
  intensity: number     // 0-1
  bpm: number
  seed: number
}

export interface FillNote {
  pitch: number       // MIDI pitch
  startBeat: number
  duration: number
  velocity: number
}

// Standard GM drum pitches
const DRUM = {
  KICK: 36,
  SNARE: 38,
  CLOSED_HAT: 42,
  OPEN_HAT: 46,
  TOM_HIGH: 50,
  TOM_MID: 47,
  TOM_LOW: 45,
  TOM_FLOOR: 41,
  CRASH: 49,
  RIDE: 51,
  RIMSHOT: 37,
} as const

function fillNote(pitch: number, startBeat: number, velocity: number, duration = 0.25): FillNote {
  return { pitch, startBeat, velocity: Math.max(1, Math.min(127, Math.round(velocity))), duration }
}

export class FillGenerator {
  generate(options: FillOptions): FillNote[] {
    const rng = new SeededRng(options.seed)
    const { style, lengthBeats, startBeat, intensity } = options
    const notes: FillNote[] = []

    switch (style) {
      case 'snare-roll': {
        // 16th or 32nd note snare roll with increasing velocity
        const use32nds = intensity > 0.7
        const subdivisions = use32nds ? 8 : 4  // per beat
        const total = Math.round(lengthBeats * subdivisions)
        const step = 1 / subdivisions
        for (let i = 0; i < total; i++) {
          const t = total > 1 ? i / (total - 1) : 0
          const velocity = 60 + t * 60  // 60→120
          notes.push(fillNote(DRUM.SNARE, startBeat + i * step, velocity, step * 0.8))
        }
        break
      }

      case 'tom-fill': {
        // Descending tom pattern: HIGH→MID→LOW→FLOOR, 4 notes per beat
        const toms = [DRUM.TOM_HIGH, DRUM.TOM_MID, DRUM.TOM_LOW, DRUM.TOM_FLOOR] as const
        const step = 0.25
        const total = Math.round(lengthBeats * 4)
        // Kick on beat 1
        notes.push(fillNote(DRUM.KICK, startBeat, 110, step * 0.9))
        for (let i = 0; i < total; i++) {
          const tom = toms[i % toms.length]!
          const velocity = 80 + intensity * 40 - i * (10 / total)
          notes.push(fillNote(tom, startBeat + i * step, velocity, step * 0.8))
        }
        break
      }

      case 'crash-buildup': {
        // Accelerating 16th notes on closed hat, last note = crash, velocity crescendo
        const total = Math.round(lengthBeats * 4)
        const step = 1 / 4
        for (let i = 0; i < total - 1; i++) {
          const t = total > 1 ? i / (total - 1) : 0
          const velocity = 50 + t * 60
          notes.push(fillNote(DRUM.CLOSED_HAT, startBeat + i * step, velocity, step * 0.8))
        }
        // Final crash
        notes.push(fillNote(DRUM.CRASH, startBeat + (total - 1) * step, 110, 0.5))
        break
      }

      case 'tribal': {
        // Tribal fill: kick + rimshots + open hats with variation
        const total = Math.round(lengthBeats * 4)
        const step = 0.25
        for (let i = 0; i < total; i++) {
          const beat = startBeat + i * step
          // Kick on every beat
          if (i % 4 === 0) {
            notes.push(fillNote(DRUM.KICK, beat, 120, step * 0.9))
          }
          // Rimshot variation
          if (rng.next() > 0.5) {
            notes.push(fillNote(DRUM.RIMSHOT, beat, 70 + rng.next() * 30, step * 0.7))
          }
          // Open hat on off beats
          if (i % 2 === 1 && rng.next() > 0.4) {
            notes.push(fillNote(DRUM.OPEN_HAT, beat, 65 + rng.next() * 25, step * 0.6))
          }
        }
        break
      }

      case 'trap-roll': {
        // 32nd note hi-hat roll, accent every 4th
        const step = 0.125  // 32nd notes
        const total = Math.round(lengthBeats * 8)
        for (let i = 0; i < total; i++) {
          const isAccent = i % 4 === 0
          const velocity = isAccent ? 90 + intensity * 30 : 50 + intensity * 20
          notes.push(fillNote(DRUM.CLOSED_HAT, startBeat + i * step, velocity, step * 0.8))
        }
        break
      }

      case 'break': {
        // Combined kick+snare with syncopation determined by rng
        const total = Math.round(lengthBeats * 4)
        const step = 0.25
        for (let i = 0; i < total; i++) {
          const beat = startBeat + i * step
          // Kick on beat 1 of each group
          if (i % 4 === 0) {
            notes.push(fillNote(DRUM.KICK, beat, 110, step * 0.9))
          }
          // Snare placement determined by rng for syncopation
          if (rng.next() > 0.6) {
            notes.push(fillNote(DRUM.SNARE, beat, 85 + rng.next() * 30, step * 0.8))
          }
        }
        // Ensure at least a snare on beat 2
        notes.push(fillNote(DRUM.SNARE, startBeat + 0.5, 100, step * 0.8))
        break
      }

      case 'simple': {
        // Basic 4-note fill: tom-high × 3, crash on last beat
        const step = lengthBeats / 4
        notes.push(fillNote(DRUM.TOM_HIGH, startBeat,              90, step * 0.8))
        notes.push(fillNote(DRUM.TOM_HIGH, startBeat + step,       95, step * 0.8))
        notes.push(fillNote(DRUM.TOM_HIGH, startBeat + step * 2,   100, step * 0.8))
        notes.push(fillNote(DRUM.CRASH,   startBeat + step * 3,   110, step * 0.8))
        break
      }
    }

    // Clamp all notes to valid range and within fill bounds
    return notes
      .filter(n => n.startBeat < startBeat + lengthBeats)
      .map(n => ({
        ...n,
        pitch: Math.max(0, Math.min(127, n.pitch)),
        velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
      }))
  }

  /**
   * Returns beat positions where fills would sound natural.
   * Rules: every 8 bars (32 beats), every 4 bars if tempo < 100 BPM.
   */
  suggestFillPositions(totalBeats: number, bpm: number): number[] {
    const positions: number[] = []
    const interval = bpm < 100 ? 16 : 32  // beats between fills

    for (let beat = interval - 1; beat < totalBeats; beat += interval) {
      positions.push(beat)
    }

    return positions.filter(p => p >= 0 && p < totalBeats)
  }
}

export const fillGenerator = new FillGenerator()
