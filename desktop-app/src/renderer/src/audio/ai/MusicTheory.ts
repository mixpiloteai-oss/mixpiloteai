// ─── MusicTheory.ts ──────────────────────────────────────────────────────────
// Foundation for all scale-aware generation.

import type { MusicalStyle } from './MusicAnalyzer'

export type ScaleType =
  | 'major' | 'natural_minor' | 'harmonic_minor' | 'melodic_minor'
  | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
  | 'pentatonic_major' | 'pentatonic_minor' | 'blues'

export type ProgressionStyle = 'techno' | 'house' | 'ambient' | 'hip-hop' | 'pop' | 'jazz'

export interface ChordDef {
  root:     number     // 0–11 pitch class
  type:     'major' | 'minor' | 'dominant7' | 'major7' | 'minor7' | 'diminished'
  duration: number     // beats
}

// ── Scale intervals ──────────────────────────────────────────────────────────

const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  major:           [0, 2, 4, 5, 7, 9, 11],
  natural_minor:   [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor:  [0, 2, 3, 5, 7, 8, 11],
  melodic_minor:   [0, 2, 3, 5, 7, 9, 11],
  dorian:          [0, 2, 3, 5, 7, 9, 10],
  phrygian:        [0, 1, 3, 5, 7, 8, 10],
  lydian:          [0, 2, 4, 6, 7, 9, 11],
  mixolydian:      [0, 2, 4, 5, 7, 9, 10],
  locrian:         [0, 1, 3, 5, 6, 8, 10],
  pentatonic_major:[0, 2, 4, 7, 9],
  pentatonic_minor:[0, 3, 5, 7, 10],
  blues:           [0, 3, 5, 6, 7, 10],
}

// ── Chord intervals ──────────────────────────────────────────────────────────

const CHORD_INTERVALS: Record<ChordDef['type'], readonly number[]> = {
  major:      [0, 4, 7],
  minor:      [0, 3, 7],
  dominant7:  [0, 4, 7, 10],
  major7:     [0, 4, 7, 11],
  minor7:     [0, 3, 7, 10],
  diminished: [0, 3, 6],
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the interval array for a given scale type. */
export function getScaleIntervals(scale: ScaleType): readonly number[] {
  return SCALE_INTERVALS[scale]
}

/**
 * Returns MIDI pitches for one octave of a scale.
 * Octave 4 = middle C octave: C4 = MIDI 60.
 * Formula: base = root + (octave + 1) * 12
 */
export function getScaleNotes(root: number, scale: ScaleType, octave: number): number[] {
  const intervals = SCALE_INTERVALS[scale]
  const base = root + (octave + 1) * 12
  return intervals.map(i => base + i)
}

/**
 * Returns MIDI pitches of a chord voicing.
 * Octave 4 = middle C octave: C4 = MIDI 60.
 * Formula: base = root + (octave + 1) * 12
 */
export function getChordNotes(root: number, type: ChordDef['type'], octave: number): number[] {
  const intervals = CHORD_INTERVALS[type]
  const base = root + (octave + 1) * 12
  return intervals.map(i => base + i)
}

/**
 * Snap pitch to nearest scale note (any octave).
 * Works across all octaves by normalizing pitch class.
 */
export function nearestScaleNote(pitch: number, root: number, scale: ScaleType): number {
  const intervals = SCALE_INTERVALS[scale]
  // Check multiple octaves around the pitch to find nearest scale note
  // Use absolute octave offsets (0-indexed from MIDI 0)
  const approxOctave = Math.floor(pitch / 12)
  let bestPitch = pitch
  let bestDist = Infinity
  for (let oct = approxOctave - 2; oct <= approxOctave + 2; oct++) {
    for (const interval of intervals) {
      const candidate = root + oct * 12 + interval
      const dist = Math.abs(candidate - pitch)
      if (dist < bestDist) {
        bestDist = dist
        bestPitch = candidate
      }
    }
  }
  return bestPitch
}

/**
 * Get a chord progression fitting the given bars (in beats).
 */
export function getProgression(
  key: { root: number; mode: 'major' | 'minor' },
  style: ProgressionStyle,
  bars: number,
): ChordDef[] {
  const { root, mode } = key
  const totalBeats = bars

  type ProgDef = { degreeRoot: number; type: ChordDef['type'] }[]

  // Helper: scale degree root in semitones
  const majorDeg = [0, 2, 4, 5, 7, 9, 11] // I II III IV V VI VII
  const minorDeg = [0, 2, 3, 5, 7, 8, 10] // i ii III iv v VI VII

  function makeChord(degree: number, chordType: ChordDef['type']): ProgDef[number] {
    return { degreeRoot: degree, type: chordType }
  }

  let progDefs: ProgDef = []

  if (mode === 'major') {
    switch (style) {
      case 'house':
        // I-IV-V-IV
        progDefs = [
          makeChord(majorDeg[0], 'major'),
          makeChord(majorDeg[3], 'major'),
          makeChord(majorDeg[4], 'major'),
          makeChord(majorDeg[3], 'major'),
        ]
        break
      case 'ambient':
        // I-III-IV-I
        progDefs = [
          makeChord(majorDeg[0], 'major'),
          makeChord(majorDeg[2], 'minor'),
          makeChord(majorDeg[3], 'major'),
          makeChord(majorDeg[0], 'major'),
        ]
        break
      case 'pop':
        // I-V-vi-IV
        progDefs = [
          makeChord(majorDeg[0], 'major'),
          makeChord(majorDeg[4], 'major'),
          makeChord(majorDeg[5], 'minor'),
          makeChord(majorDeg[3], 'major'),
        ]
        break
      case 'jazz':
        // ii-V-I-vi
        progDefs = [
          makeChord(majorDeg[1], 'minor7'),
          makeChord(majorDeg[4], 'dominant7'),
          makeChord(majorDeg[0], 'major7'),
          makeChord(majorDeg[5], 'minor7'),
        ]
        break
      default:
        progDefs = [makeChord(majorDeg[0], 'major')]
        break
    }
  } else {
    // minor
    switch (style) {
      case 'techno':
        // i-VII-VI-VII
        progDefs = [
          makeChord(minorDeg[0], 'minor'),
          makeChord(minorDeg[6], 'major'),
          makeChord(minorDeg[5], 'major'),
          makeChord(minorDeg[6], 'major'),
        ]
        break
      case 'house':
        // i-VI-III-VII
        progDefs = [
          makeChord(minorDeg[0], 'minor'),
          makeChord(minorDeg[5], 'major'),
          makeChord(minorDeg[2], 'major'),
          makeChord(minorDeg[6], 'major'),
        ]
        break
      case 'hip-hop':
        // i-bVII-bVI-bVII
        progDefs = [
          makeChord(minorDeg[0], 'minor'),
          makeChord(minorDeg[6], 'major'),
          makeChord(minorDeg[5], 'major'),
          makeChord(minorDeg[6], 'major'),
        ]
        break
      case 'ambient':
        // i-III-VI-VII
        progDefs = [
          makeChord(minorDeg[0], 'minor'),
          makeChord(minorDeg[2], 'major'),
          makeChord(minorDeg[5], 'major'),
          makeChord(minorDeg[6], 'major'),
        ]
        break
      default:
        progDefs = [makeChord(minorDeg[0], 'minor')]
        break
    }
  }

  if (progDefs.length === 0) {
    progDefs = [makeChord(0, mode === 'major' ? 'major' : 'minor')]
  }

  const numChords = progDefs.length
  const durEach = totalBeats / numChords

  const result: ChordDef[] = progDefs.map(def => ({
    root: (root + def.degreeRoot) % 12,
    type: def.type,
    duration: durEach,
  }))

  return result
}

/**
 * Map MusicalStyle + mode to a ScaleType.
 */
export function styleToScale(style: MusicalStyle, mode: 'major' | 'minor'): ScaleType {
  if (style === 'techno' && mode === 'minor') return 'dorian'
  if (style === 'house' && mode === 'major') return 'mixolydian'
  if (style === 'ambient') return 'lydian'
  if (style === 'hip-hop' && mode === 'minor') return 'pentatonic_minor'
  if (mode === 'minor') return 'natural_minor'
  return 'major'
}
