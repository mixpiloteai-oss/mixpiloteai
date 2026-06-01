// ─── MelodyGenerator.ts ──────────────────────────────────────────────────────
// Scale-aware, chord-tone-respecting melody generator.

import type { MusicalStyle } from './MusicAnalyzer'
import type { GeneratedNote, GeneratedPattern } from './PatternGenerator'
import type { ScaleType, ProgressionStyle, ChordDef } from './MusicTheory'
import {
  getScaleNotes,
  getChordNotes,
  getProgression,
  nearestScaleNote,
} from './MusicTheory'
import { SeededRng } from './SeededRng'

export type MelodyContour = 'arch' | 'ascending' | 'descending' | 'neighbor' | 'random_walk'

export interface MelodyOptions {
  key:         { root: number; mode: 'major' | 'minor' }
  scale:       ScaleType
  style:       MusicalStyle
  bars:        number
  startOctave: number    // MIDI octave for root note (e.g. 4 = middle C)
  noteDensity: 'sparse' | 'medium' | 'dense'  // notes per beat: 0.5 / 1 / 2
  contour:     MelodyContour
  seed:        number
}

/** Map MusicalStyle to ProgressionStyle. */
export function styleToProgressionStyle(style: MusicalStyle): ProgressionStyle {
  switch (style) {
    case 'techno':          return 'techno'
    case 'house':           return 'house'
    case 'ambient':         return 'ambient'
    case 'hip-hop':         return 'hip-hop'
    case 'pop':             return 'pop'
    case 'drum-and-bass':   return 'techno'
    case 'unknown':         return 'pop'
  }
}

/** Get scale notes spanning two octaves for note picking. */
function getScaleRange(root: number, scale: ScaleType, octave: number): number[] {
  return [
    ...getScaleNotes(root, scale, octave - 1),
    ...getScaleNotes(root, scale, octave),
    ...getScaleNotes(root, scale, octave + 1),
  ]
}

/** Find index of pitch in a sorted array (nearest). */
function indexInScale(pitch: number, scaleNotes: number[]): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < scaleNotes.length; i++) {
    const d = Math.abs(scaleNotes[i]! - pitch)
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

/** Shift pitch by steps within scale (clamp to array bounds). */
function stepInScale(pitch: number, steps: number, scaleNotes: number[]): number {
  const idx = indexInScale(pitch, scaleNotes)
  const newIdx = Math.max(0, Math.min(scaleNotes.length - 1, idx + steps))
  return scaleNotes[newIdx]!
}

/** Generate a melody from MelodyOptions. */
export function generateMelody(opts: MelodyOptions): GeneratedPattern {
  const rng = new SeededRng(opts.seed)
  const totalBeats = opts.bars * 4
  const progressionStyle = styleToProgressionStyle(opts.style)
  const progression = getProgression(opts.key, progressionStyle, totalBeats)

  // Beat step size by density
  const stepSize = opts.noteDensity === 'sparse' ? 2.0
    : opts.noteDensity === 'medium' ? 1.0
    : 0.5

  // Build beat positions
  const beatPositions: number[] = []
  for (let b = 0; b < totalBeats; b += stepSize) {
    beatPositions.push(b)
  }

  const scaleNotes = getScaleRange(opts.key.root, opts.scale, opts.startOctave)
  const notes: GeneratedNote[] = []

  // Find chord active at beat
  function getChordAt(beat: number): ChordDef {
    let elapsed = 0
    for (const chord of progression) {
      elapsed += chord.duration
      if (beat < elapsed) return chord
    }
    return progression[progression.length - 1]!
  }

  // Note length by density
  const baseLen = opts.noteDensity === 'sparse' ? 1.5
    : opts.noteDensity === 'medium' ? 0.75
    : 0.25

  // Contour: compute step offsets per note index
  function contourOffset(idx: number, total: number, _prevPitch: number | null, rngLocal: SeededRng): number {
    switch (opts.contour) {
      case 'arch': {
        const half = total / 2
        const pos = idx < half ? idx / half : (total - idx) / half
        return Math.round(pos * 4)
      }
      case 'ascending':
        return Math.round((idx / Math.max(1, total - 1)) * 5)
      case 'descending':
        return -Math.round((idx / Math.max(1, total - 1)) * 5)
      case 'neighbor':
        return idx % 2 === 0 ? 0 : rngLocal.pick([-1, 1] as const)
      case 'random_walk': {
        const roll = rngLocal.next()
        if (roll < 0.8) return rngLocal.pick([-1, 0, 1] as const)
        return rngLocal.pick([-2, 2] as const)
      }
    }
  }

  let prevPitch: number | null = null

  for (let i = 0; i < beatPositions.length; i++) {
    const beat = beatPositions[i]!
    const chord = getChordAt(beat)
    const chordTones = getChordNotes(chord.root, chord.type, opts.startOctave)
    const isStrong = (opts.noteDensity === 'dense')
      ? beat % 2.0 === 0
      : beat % 1.0 === 0

    // Pick raw pitch
    let rawPitch: number
    if (isStrong) {
      rawPitch = rng.next() < 0.7
        ? rng.pick(chordTones as readonly number[])
        : rng.pick(scaleNotes as readonly number[])
    } else {
      rawPitch = rng.next() < 0.8
        ? rng.pick(scaleNotes as readonly number[])
        : rng.pick(chordTones as readonly number[])
    }

    // Contour adjustment
    const steps = contourOffset(i, beatPositions.length, prevPitch, rng)
    const contoured = stepInScale(rawPitch, steps, scaleNotes)

    // Snap to scale
    const pitch = nearestScaleNote(contoured, opts.key.root, opts.scale)

    prevPitch = pitch

    // Velocity
    const baseVel = isStrong
      ? 90 + Math.round((rng.next() - 0.5) * 20)
      : 60 + Math.round((rng.next() - 0.5) * 20)
    const velocity = Math.max(1, Math.min(127, baseVel))

    // Duration: last note of phrase extends to phrase end
    const nextBeat = beatPositions[i + 1] ?? totalBeats
    const isLast = i === beatPositions.length - 1
    const len = isLast
      ? Math.max(baseLen, totalBeats - beat - 0.05)
      : Math.min(baseLen, nextBeat - beat - 0.05)

    notes.push({
      pitch,
      startBeat: beat,
      lengthBeats: Math.max(0.05, len),
      velocity,
    })
  }

  return { name: `Melody (${opts.style})`, notes, bars: opts.bars }
}
