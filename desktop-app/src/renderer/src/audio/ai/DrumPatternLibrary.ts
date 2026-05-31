// ─── DrumPatternLibrary.ts ───────────────────────────────────────────────────
// Extended drum pattern library with styles and variation system.

import type { GeneratedNote, GeneratedPattern } from './PatternGenerator'
import { SeededRng } from './SeededRng'

export type DrumStyle =
  | 'four-on-the-floor' | 'breakbeat' | 'trap' | 'dnb' | 'reggaeton'
  | 'afrobeat' | 'boom-bap' | 'house' | 'techno' | 'tribe'

export type VariationType =
  | 'ghost_notes'     // add quiet (vel 40–60) notes between existing
  | 'syncopation'     // shift some notes by +/- 0.25 beats
  | 'fill'            // last beat of pattern replaced with a fill
  | 'half_time'       // notes at half density
  | 'double_time'     // notes at double density
  | 'swing'           // push every other 8th note slightly late (+0.04 beats)

export interface DrumPattern {
  name:   string
  bars:   number
  notes:  GeneratedNote[]
}

// GM drum mapping constants
export const KICK        = 36
export const SNARE       = 38
export const CLAP        = 39
export const CLOSED_HH   = 42
export const OPEN_HH     = 46
export const RIDE        = 51
export const CRASH       = 49
export const LOW_TOM     = 45
export const MID_TOM     = 47
export const HIGH_TOM    = 50

// ── Helper ────────────────────────────────────────────────────────────────────

function note(pitch: number, startBeat: number, velocity: number, length = 0.5): GeneratedNote {
  return { pitch, startBeat, velocity, lengthBeats: length }
}

// ── Pattern generators ────────────────────────────────────────────────────────

function makeFourOnTheFloor(bar: number): GeneratedNote[] {
  const o = bar * 4
  const notes: GeneratedNote[] = []
  // kick every beat
  for (let b = 0; b < 4; b++) notes.push(note(KICK, o + b, 120))
  // snare on 2 and 4
  notes.push(note(SNARE, o + 1, 105))
  notes.push(note(SNARE, o + 3, 105))
  // closed HH every 8th
  for (let i = 0; i < 8; i++) notes.push(note(CLOSED_HH, o + i * 0.5, 75, 0.25))
  return notes
}

function makeBreakbeat(bar: number): GeneratedNote[] {
  const o = bar * 4
  return [
    note(KICK,      o + 0,    127),
    note(KICK,      o + 2.75, 100),
    note(SNARE,     o + 1,    115),
    note(SNARE,     o + 2.5,  90),
    note(OPEN_HH,   o + 0.5,  80, 0.25),
    note(CLOSED_HH, o + 1.5,  70, 0.25),
    note(CLOSED_HH, o + 2.0,  75, 0.25),
    note(CLOSED_HH, o + 3.0,  72, 0.25),
    note(CLOSED_HH, o + 3.5,  68, 0.25),
  ]
}

function makeTrap(bar: number, rng: SeededRng): GeneratedNote[] {
  const o = bar * 4
  const notes: GeneratedNote[] = []
  // kick
  notes.push(note(KICK, o + 0,   110))
  notes.push(note(KICK, o + 2.5, 100))
  // clap
  notes.push(note(CLAP, o + 1, 110))
  notes.push(note(CLAP, o + 3, 110))
  // 16th note hi-hats
  for (let i = 0; i < 16; i++) {
    const vel = i % 2 === 0 ? 90 : 60
    notes.push(note(CLOSED_HH, o + i * 0.25, vel, 0.2))
  }
  // occasional open HH on off-beats
  const offBeats = [0.5, 1.5, 2.5, 3.5]
  for (const b of offBeats) {
    if (rng.next() > 0.7) notes.push(note(OPEN_HH, o + b, 70, 0.25))
  }
  return notes
}

function makeDnb(bar: number): GeneratedNote[] {
  const o = bar * 4
  return [
    note(KICK,      o + 0,    127),
    note(KICK,      o + 1.75, 120),
    note(SNARE,     o + 1.0,  120),
    note(SNARE,     o + 3.0,  120),
    note(CLOSED_HH, o + 0.0,  80, 0.25),
    note(CLOSED_HH, o + 0.5,  75, 0.25),
    note(CLOSED_HH, o + 1.0,  78, 0.25),
    note(CLOSED_HH, o + 1.5,  72, 0.25),
    note(CLOSED_HH, o + 2.0,  80, 0.25),
    note(CLOSED_HH, o + 2.5,  75, 0.25),
    note(CLOSED_HH, o + 3.0,  78, 0.25),
    note(CLOSED_HH, o + 3.5,  72, 0.25),
    note(OPEN_HH,   o + 0.25, 85, 0.2),
    note(OPEN_HH,   o + 2.25, 85, 0.2),
  ]
}

function makeReggaeton(bar: number): GeneratedNote[] {
  const o = bar * 4
  const notes: GeneratedNote[] = []
  // kick
  notes.push(note(KICK, o + 0,    110))
  notes.push(note(KICK, o + 0.75, 95))
  notes.push(note(KICK, o + 2.0,  110))
  notes.push(note(KICK, o + 2.75, 95))
  // snare
  notes.push(note(SNARE, o + 1.0, 105))
  notes.push(note(SNARE, o + 3.0, 105))
  // closed HH every 0.5
  for (let i = 0; i < 8; i++) notes.push(note(CLOSED_HH, o + i * 0.5, 75, 0.25))
  return notes
}

function makeAfrobeat(bar: number): GeneratedNote[] {
  const o = bar * 4
  return [
    note(KICK,    o + 0,   110),
    note(KICK,    o + 1.5, 100),
    note(KICK,    o + 2.0, 110),
    note(KICK,    o + 3.5, 95),
    note(SNARE,   o + 1.0, 105),
    note(SNARE,   o + 2.5, 100),
    note(OPEN_HH, o + 0.5, 80, 0.25),
    note(OPEN_HH, o + 1.0, 75, 0.25),
    note(OPEN_HH, o + 2.5, 80, 0.25),
    note(OPEN_HH, o + 3.0, 75, 0.25),
  ]
}

function makeBoomBap(bar: number, rng: SeededRng): GeneratedNote[] {
  const o = bar * 4
  const notes: GeneratedNote[] = []
  // kick
  notes.push(note(KICK, o + 0,   115))
  notes.push(note(KICK, o + 2.5, 100))
  // snare
  notes.push(note(SNARE, o + 1.0, 110))
  notes.push(note(SNARE, o + 3.0, 105))
  // closed HH every 0.5
  for (let i = 0; i < 8; i++) notes.push(note(CLOSED_HH, o + i * 0.5, 75, 0.25))
  // occasional open HH
  if (rng.next() > 0.75) notes.push(note(OPEN_HH, o + 0.75, 70, 0.25))
  if (rng.next() > 0.75) notes.push(note(OPEN_HH, o + 2.75, 70, 0.25))
  return notes
}

function makeHouse(bar: number): GeneratedNote[] {
  const o = bar * 4
  const notes: GeneratedNote[] = []
  // kick on every beat
  for (let b = 0; b < 4; b++) notes.push(note(KICK, o + b, 115))
  // clap/snare on 1.5 and 3.5
  notes.push(note(SNARE, o + 1.5, 100))
  notes.push(note(SNARE, o + 3.5, 100))
  // closed HH every 0.25
  for (let i = 0; i < 16; i++) notes.push(note(CLOSED_HH, o + i * 0.25, 70, 0.2))
  return notes
}

function makeTechno(bar: number, rng: SeededRng): GeneratedNote[] {
  const o = bar * 4
  const notes: GeneratedNote[] = []
  // kick on every beat
  for (let b = 0; b < 4; b++) notes.push(note(KICK, o + b, 110))
  // closed HH every 0.5
  for (let i = 0; i < 8; i++) notes.push(note(CLOSED_HH, o + i * 0.5, 80, 0.25))
  // occasional snare on 2
  if (rng.next() > 0.4) notes.push(note(SNARE, o + 2.0, 100))
  return notes
}

function makeTribe(bar: number, totalBars: number): GeneratedNote[] {
  const o = bar * 4
  const notes: GeneratedNote[] = []
  // kick on every beat
  for (let b = 0; b < 4; b++) notes.push(note(KICK, o + b, 127))
  // syncopated kick on even bars
  if (bar % 2 === 0) notes.push(note(KICK, o + 0.75, 90, 0.25))
  // HH every 0.5
  for (let i = 0; i < 8; i++) notes.push(note(CLOSED_HH, o + i * 0.5, 75, 0.25))
  // low-tom fills on last bar's beat 3.5
  if (bar === totalBars - 1) notes.push(note(LOW_TOM, o + 3.5, 100, 0.25))
  return notes
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Generate a drum pattern for the given style, bars, and seed. */
export function getPattern(style: DrumStyle, bars: number, seed: number): DrumPattern {
  const rng = new SeededRng(seed)
  const notes: GeneratedNote[] = []

  for (let bar = 0; bar < bars; bar++) {
    switch (style) {
      case 'four-on-the-floor':
        notes.push(...makeFourOnTheFloor(bar))
        break
      case 'breakbeat':
        notes.push(...makeBreakbeat(bar))
        break
      case 'trap':
        notes.push(...makeTrap(bar, rng))
        break
      case 'dnb':
        notes.push(...makeDnb(bar))
        break
      case 'reggaeton':
        notes.push(...makeReggaeton(bar))
        break
      case 'afrobeat':
        notes.push(...makeAfrobeat(bar))
        break
      case 'boom-bap':
        notes.push(...makeBoomBap(bar, rng))
        break
      case 'house':
        notes.push(...makeHouse(bar))
        break
      case 'techno':
        notes.push(...makeTechno(bar, rng))
        break
      case 'tribe':
        notes.push(...makeTribe(bar, bars))
        break
    }
  }

  return { name: `Drums (${style})`, bars, notes }
}

/** Apply a variation to an existing DrumPattern. */
export function createVariation(base: DrumPattern, type: VariationType, seed: number): DrumPattern {
  const rng = new SeededRng(seed)
  let notes = base.notes.map(n => ({ ...n }))

  switch (type) {
    case 'ghost_notes': {
      const ghosts: GeneratedNote[] = []
      for (const n of notes) {
        if (n.pitch === SNARE && n.startBeat >= 0.25) {
          ghosts.push(note(SNARE, n.startBeat - 0.25, 45, 0.125))
        }
      }
      notes = [...notes, ...ghosts].sort((a, b) => a.startBeat - b.startBeat)
      return { ...base, name: `${base.name} (ghost)`, notes }
    }

    case 'syncopation': {
      const nonKickIndices = notes
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.pitch !== KICK)
        .map(({ i }) => i)
      const totalBeats = base.bars * 4
      // Shift 25% of non-kick notes
      const count = Math.max(1, Math.floor(nonKickIndices.length * 0.25))
      const shuffled = rng.shuffle([...nonKickIndices])
      for (let k = 0; k < count && k < shuffled.length; k++) {
        const idx = shuffled[k]!
        const n = notes[idx]!
        n.startBeat = Math.min(n.startBeat + 0.25, totalBeats - n.lengthBeats)
      }
      return { ...base, name: `${base.name} (sync)`, notes }
    }

    case 'fill': {
      // Replace notes at beat >= (bars-1)*4+3.0 with tom fills
      const fillStart = (base.bars - 1) * 4 + 3.0
      const filtered = notes.filter(n => n.startBeat < fillStart)
      const fills: GeneratedNote[] = [
        note(HIGH_TOM, fillStart,       110, 0.125),
        note(MID_TOM,  fillStart + 0.125, 105, 0.125),
        note(LOW_TOM,  fillStart + 0.25,  100, 0.125),
        note(SNARE,    fillStart + 0.375, 115, 0.125),
        note(HIGH_TOM, fillStart + 0.5,  108, 0.125),
        note(MID_TOM,  fillStart + 0.625, 103, 0.125),
        note(LOW_TOM,  fillStart + 0.75,  98, 0.125),
        note(SNARE,    fillStart + 0.875, 120, 0.125),
      ]
      return { ...base, name: `${base.name} (fill)`, notes: [...filtered, ...fills] }
    }

    case 'half_time': {
      // Keep only notes at beat positions divisible by 0.5
      const filtered = notes.filter(n => Math.abs((n.startBeat % 0.5)) < 0.01 || Math.abs((n.startBeat % 0.5) - 0.5) < 0.01)
      return { ...base, name: `${base.name} (half)`, notes: filtered }
    }

    case 'double_time': {
      // Duplicate each note at startBeat/2, compress pattern to half length
      const doubled = notes.map(n => ({
        ...n,
        startBeat: n.startBeat / 2,
        lengthBeats: n.lengthBeats / 2,
      }))
      return { ...base, name: `${base.name} (2x)`, bars: Math.ceil(base.bars / 2), notes: doubled }
    }

    case 'swing': {
      // Push every other 8th (offset ≈ 0.5 mod 1.0) slightly late
      const swung = notes.map(n => {
        const sub = n.startBeat % 1.0
        if (Math.abs(sub - 0.5) < 0.01) {
          return { ...n, startBeat: n.startBeat + 0.04 }
        }
        return n
      })
      return { ...base, name: `${base.name} (swing)`, notes: swung }
    }
  }
}
