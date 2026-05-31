// ─── PatternVariator.ts ──────────────────────────────────────────────────────
// Takes an existing GeneratedPattern and produces musically coherent variations.

import type { GeneratedNote, GeneratedPattern } from './PatternGenerator'
import type { ScaleType } from './MusicTheory'
import { nearestScaleNote } from './MusicTheory'
import { SeededRng } from './SeededRng'

export type VariationOp =
  | 'octave_up' | 'octave_down'
  | 'retrograde'
  | 'augment'
  | 'diminution'
  | 'ghost_fill'
  | 'invert_contour'
  | 'rhythmic_shift'
  | 'accent_shift'
  | 'snap_to_scale'

export interface VariationOptions {
  root?:   number
  scale?:  ScaleType
  seed?:   number
}

function clampPitch(p: number): number {
  return Math.max(0, Math.min(127, p))
}

function totalDuration(notes: GeneratedNote[]): number {
  if (notes.length === 0) return 0
  return Math.max(...notes.map(n => n.startBeat + n.lengthBeats))
}

export function applyVariation(
  pattern: GeneratedPattern,
  op: VariationOp,
  opts: VariationOptions = {},
): GeneratedPattern {
  const notes = pattern.notes.map(n => ({ ...n }))

  switch (op) {
    case 'octave_up':
      return {
        ...pattern,
        name: `${pattern.name} (+oct)`,
        notes: notes.map(n => ({ ...n, pitch: clampPitch(n.pitch + 12) })),
      }

    case 'octave_down':
      return {
        ...pattern,
        name: `${pattern.name} (-oct)`,
        notes: notes.map(n => ({ ...n, pitch: clampPitch(n.pitch - 12) })),
      }

    case 'retrograde': {
      const dur = totalDuration(notes)
      return {
        ...pattern,
        name: `${pattern.name} (retro)`,
        notes: notes.map(n => ({
          ...n,
          startBeat: dur - n.startBeat - n.lengthBeats,
        })).sort((a, b) => a.startBeat - b.startBeat),
      }
    }

    case 'augment':
      return {
        ...pattern,
        name: `${pattern.name} (aug)`,
        bars: pattern.bars * 2,
        notes: notes.map(n => ({
          ...n,
          startBeat: n.startBeat * 2,
          lengthBeats: n.lengthBeats * 2,
        })),
      }

    case 'diminution':
      return {
        ...pattern,
        name: `${pattern.name} (dim)`,
        bars: Math.max(1, Math.ceil(pattern.bars / 2)),
        notes: notes.map(n => ({
          ...n,
          startBeat: n.startBeat / 2,
          lengthBeats: n.lengthBeats / 2,
        })),
      }

    case 'ghost_fill': {
      const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat)
      const ghosts: GeneratedNote[] = []
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur  = sorted[i]!
        const next = sorted[i + 1]!
        const gap  = next.startBeat - (cur.startBeat + cur.lengthBeats)
        if (gap > 0.5) {
          const mid = cur.startBeat + cur.lengthBeats + gap / 2
          ghosts.push({ pitch: cur.pitch, startBeat: mid, velocity: 40, lengthBeats: 0.125 })
        }
      }
      return {
        ...pattern,
        name: `${pattern.name} (ghost)`,
        notes: [...notes, ...ghosts].sort((a, b) => a.startBeat - b.startBeat),
      }
    }

    case 'invert_contour': {
      if (notes.length === 0) return pattern
      const meanPitch = notes.reduce((s, n) => s + n.pitch, 0) / notes.length
      return {
        ...pattern,
        name: `${pattern.name} (inv)`,
        notes: notes.map(n => ({
          ...n,
          pitch: clampPitch(Math.round(2 * meanPitch - n.pitch)),
        })),
      }
    }

    case 'rhythmic_shift': {
      const dur = totalDuration(notes)
      if (dur === 0) return pattern
      return {
        ...pattern,
        name: `${pattern.name} (shift)`,
        notes: notes.map(n => ({
          ...n,
          startBeat: (n.startBeat + 0.25) % dur,
        })),
      }
    }

    case 'accent_shift': {
      if (notes.length < 2) return pattern
      const sorted = [...notes].sort((a, b) => a.velocity - b.velocity)
      const low = sorted[0]!
      const high = sorted[sorted.length - 1]!
      const lowVel  = low.velocity
      const highVel = high.velocity
      return {
        ...pattern,
        name: `${pattern.name} (accent)`,
        notes: notes.map(n => {
          if (n === low)  return { ...n, velocity: highVel }
          if (n === high) return { ...n, velocity: lowVel }
          return n
        }),
      }
    }

    case 'snap_to_scale': {
      const root  = opts.root ?? 0
      const scale = opts.scale ?? 'major'
      return {
        ...pattern,
        name: `${pattern.name} (snapped)`,
        notes: notes.map(n => ({
          ...n,
          pitch: nearestScaleNote(n.pitch, root, scale),
        })),
      }
    }
  }
}

export function suggestVariations(pattern: GeneratedPattern): VariationOp[] {
  const suggestions: VariationOp[] = []

  if (pattern.notes.length === 0) return ['retrograde', 'rhythmic_shift']

  const pitches = pattern.notes.map(n => n.pitch)
  const velocities = pattern.notes.map(n => n.velocity)
  const pitchSpan = Math.max(...pitches) - Math.min(...pitches)
  const velSpan   = Math.max(...velocities) - Math.min(...velocities)
  const allSame   = pitches.every(p => p === pitches[0])

  if (pitchSpan > 12) suggestions.push('octave_down')
  if (velSpan < 20)   suggestions.push('accent_shift', 'ghost_fill')
  if (allSame)        suggestions.push('invert_contour')
  suggestions.push('retrograde', 'rhythmic_shift')

  // Deduplicate and cap at 4
  const unique: VariationOp[] = []
  for (const op of suggestions) {
    if (!unique.includes(op)) unique.push(op)
    if (unique.length >= 4) break
  }

  return unique
}
