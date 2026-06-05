// ─── Music Theory Module ──────────────────────────────────────────────────────
// Complete music theory utilities: scales, chords, progressions, melody generation.

// ─── Scale Types ──────────────────────────────────────────────────────────────

export type ScaleMode =
  | 'major'
  | 'minor'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'pentatonic-major'
  | 'pentatonic-minor'
  | 'blues'

export type ScaleRoot =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

// ─── Scale Root MIDI Numbers ──────────────────────────────────────────────────

export const SCALE_ROOT_MIDI: Record<ScaleRoot, number> = {
  'C':  0,
  'C#': 1,
  'D':  2,
  'D#': 3,
  'E':  4,
  'F':  5,
  'F#': 6,
  'G':  7,
  'G#': 8,
  'A':  9,
  'A#': 10,
  'B':  11,
}

// ─── Scale Intervals ──────────────────────────────────────────────────────────

export const SCALE_INTERVALS: Record<ScaleMode, number[]> = {
  'major':           [0, 2, 4, 5, 7, 9, 11],
  'minor':           [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor':  [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor':   [0, 2, 3, 5, 7, 9, 11],
  'dorian':          [0, 2, 3, 5, 7, 9, 10],
  'phrygian':        [0, 1, 3, 5, 7, 8, 10],
  'lydian':          [0, 2, 4, 6, 7, 9, 11],
  'mixolydian':      [0, 2, 4, 5, 7, 9, 10],
  'locrian':         [0, 1, 3, 5, 6, 8, 10],
  'pentatonic-major':[0, 2, 4, 7, 9],
  'pentatonic-minor':[0, 3, 5, 7, 10],
  'blues':           [0, 3, 5, 6, 7, 10],
}

// ─── Scale Display Names ──────────────────────────────────────────────────────

export const SCALE_NAMES: Record<ScaleMode, string> = {
  'major':           'Major',
  'minor':           'Natural Minor',
  'harmonic-minor':  'Harmonic Minor',
  'melodic-minor':   'Melodic Minor',
  'dorian':          'Dorian',
  'phrygian':        'Phrygian',
  'lydian':          'Lydian',
  'mixolydian':      'Mixolydian',
  'locrian':         'Locrian',
  'pentatonic-major':'Pentatonic Major',
  'pentatonic-minor':'Pentatonic Minor',
  'blues':           'Blues',
}

// ─── Chord Types ──────────────────────────────────────────────────────────────

export type ChordType =
  | 'maj' | 'min' | '7' | 'maj7' | 'min7'
  | 'dim' | 'aug' | 'sus2' | 'sus4'
  | '9' | 'min9' | 'maj9' | 'add9'

export const CHORD_INTERVALS: Record<ChordType, number[]> = {
  'maj':  [0, 4, 7],
  'min':  [0, 3, 7],
  '7':    [0, 4, 7, 10],
  'maj7': [0, 4, 7, 11],
  'min7': [0, 3, 7, 10],
  'dim':  [0, 3, 6],
  'aug':  [0, 4, 8],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
  '9':    [0, 4, 7, 10, 14],
  'min9': [0, 3, 7, 10, 14],
  'maj9': [0, 4, 7, 11, 14],
  'add9': [0, 4, 7, 14],
}

// ─── Chord Definition ─────────────────────────────────────────────────────────

export interface ChordDef {
  /** MIDI note 0-127 (root of chord) */
  root: number
  type: ChordType
  /** Human-readable name e.g. "Cm7" */
  name: string
  /** All MIDI notes in chord */
  pitches: number[]
}

// ─── Note Names ───────────────────────────────────────────────────────────────

const NOTE_NAMES: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

function midiToNoteName(midi: number): string {
  return NOTE_NAMES[midi % 12] ?? 'C'
}

// ─── Scale Functions ──────────────────────────────────────────────────────────

/**
 * Returns all MIDI pitches (0-127) that belong to the given scale.
 */
export function getScalePitches(root: ScaleRoot, mode: ScaleMode): number[] {
  const rootMidi = SCALE_ROOT_MIDI[root]
  const intervals = SCALE_INTERVALS[mode]
  const pitches: number[] = []

  for (let midi = 0; midi <= 127; midi++) {
    const semitone = ((midi - rootMidi) % 12 + 12) % 12
    if (intervals.includes(semitone)) {
      pitches.push(midi)
    }
  }

  return pitches
}

/**
 * Snaps a pitch to the nearest scale degree.
 */
export function snapPitchToScale(pitch: number, root: ScaleRoot, mode: ScaleMode): number {
  const scalePitches = getScalePitches(root, mode)
  if (scalePitches.length === 0) return pitch

  let nearest = scalePitches[0]!
  let minDist = Math.abs(pitch - nearest)

  for (const p of scalePitches) {
    const dist = Math.abs(pitch - p)
    if (dist < minDist) {
      minDist = dist
      nearest = p
    }
  }

  return nearest
}

/**
 * Returns true if the pitch belongs to the given scale.
 */
export function isInScale(pitch: number, root: ScaleRoot, mode: ScaleMode): boolean {
  const rootMidi = SCALE_ROOT_MIDI[root]
  const intervals = SCALE_INTERVALS[mode]
  const semitone = ((pitch - rootMidi) % 12 + 12) % 12
  return intervals.includes(semitone)
}

// ─── Chord Functions ──────────────────────────────────────────────────────────

/**
 * Builds a ChordDef from a MIDI root note and chord type.
 * rootMidi is the bass note (0-127). Chord is voiced in the same octave.
 */
export function buildChord(rootMidi: number, type: ChordType): ChordDef {
  const intervals = CHORD_INTERVALS[type]
  const pitches = intervals
    .map(i => rootMidi + i)
    .filter(p => p >= 0 && p <= 127)

  const noteName = midiToNoteName(rootMidi)
  const typeSuffix: Record<ChordType, string> = {
    'maj':  '',
    'min':  'm',
    '7':    '7',
    'maj7': 'maj7',
    'min7': 'm7',
    'dim':  'dim',
    'aug':  'aug',
    'sus2': 'sus2',
    'sus4': 'sus4',
    '9':    '9',
    'min9': 'm9',
    'maj9': 'maj9',
    'add9': 'add9',
  }

  return {
    root: rootMidi,
    type,
    name: `${noteName}${typeSuffix[type]}`,
    pitches,
  }
}

// ─── Diatonic Chord Qualities ─────────────────────────────────────────────────

/**
 * For each scale degree, determine the chord quality based on the interval
 * structure of that degree within the scale.
 */
function getChordQualityForDegree(intervals: number[], degree: number): ChordType {
  const len = intervals.length
  const root = intervals[degree % len]!
  const third = intervals[(degree + 2) % len]!
  const fifth = intervals[(degree + 4) % len]!

  const rootVal = root % 12
  const thirdVal = ((third - root + 12) % 12 + 12) % 12
  const fifthVal  = ((fifth - root + 12) % 12 + 12) % 12

  // Determine third: 3 = minor, 4 = major
  if (thirdVal === 4 && fifthVal === 8) return 'aug'
  if (thirdVal === 3 && fifthVal === 6) return 'dim'
  if (thirdVal === 4 && fifthVal === 7) return 'maj'
  if (thirdVal === 3 && fifthVal === 7) return 'min'

  // Fallback: use third only
  if (thirdVal === 4) return 'maj'
  if (thirdVal === 3) return 'min'

  // Pentatonic/blues: no standard 3rd spacing
  // Treat as major by default
  void rootVal
  return 'maj'
}

/**
 * Returns diatonic chords for a scale — one per scale degree.
 * For heptatonic scales 7 chords, for pentatonic/blues 5-6.
 * Standard major/minor overrides are applied for quality.
 */
export function getDiatonicChords(root: ScaleRoot, mode: ScaleMode): ChordDef[] {
  const rootMidi = SCALE_ROOT_MIDI[root]
  const intervals = SCALE_INTERVALS[mode]

  // Octave 4 (middle C region) base
  const baseOctave = 4
  const baseMidi = rootMidi + (baseOctave + 1) * 12

  // Standard quality overrides for common scales
  const majorQualities: ChordType[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
  const minorQualities: ChordType[] = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj']

  return intervals.map((interval, degree) => {
    let quality: ChordType

    if (mode === 'major') {
      quality = majorQualities[degree % majorQualities.length]!
    } else if (mode === 'minor') {
      quality = minorQualities[degree % minorQualities.length]!
    } else {
      quality = getChordQualityForDegree(intervals, degree)
    }

    const chordRoot = baseMidi + interval
    return buildChord(chordRoot, quality)
  })
}

// ─── Progressions ─────────────────────────────────────────────────────────────

export interface Progression {
  name: string
  /** Scale degree indices 0-6 */
  degrees: number[]
}

export const PROGRESSIONS: Progression[] = [
  { name: 'I-V-vi-IV (Pop)',       degrees: [0, 4, 5, 3] },
  { name: 'I-IV-V-I (Blues)',      degrees: [0, 3, 4, 0] },
  { name: 'ii-V-I (Jazz)',         degrees: [1, 4, 0, 0] },
  { name: 'i-VI-III-VII (Epic)',   degrees: [0, 5, 2, 6] },
  { name: 'I-vi-IV-V (Oldies)',    degrees: [0, 5, 3, 4] },
  { name: 'i-iv-VII-III (Minor)',  degrees: [0, 3, 6, 2] },
  { name: 'vi-IV-I-V (Anthem)',    degrees: [5, 3, 0, 4] },
  { name: 'I-III-IV-iv (Mixture)', degrees: [0, 2, 3, 3] },
  { name: 'I-V-IV-I (Rock)',       degrees: [0, 4, 3, 0] },
]

// ─── LCG Random ───────────────────────────────────────────────────────────────

/**
 * Linear Congruential Generator — deterministic pseudo-random.
 * Returns a value in [0, 1) and the next seed.
 */
export function lcgRand(seed: number): { value: number; next: number } {
  const next = (seed * 1664525 + 1013904223) & 0x7fffffff
  return { value: next / 0x7fffffff, next }
}

// ─── Melody Generation ────────────────────────────────────────────────────────

export interface MelodyNote {
  beat: number
  pitch: number
  velocity: number
  lengthBeats: number
}

/** Note length options by density */
const DENSITY_LENGTHS: Record<'sparse' | 'medium' | 'dense', number[]> = {
  sparse: [1, 1, 2, 0.5],
  medium: [0.5, 0.5, 1, 1, 0.25, 2],
  dense:  [0.25, 0.25, 0.5, 0.5, 0.5, 1],
}

/**
 * Generates a melody over a given number of bars using deterministic LCG.
 * Notes are snapped to the provided scale, within octave range [octave*12, (octave+2)*12].
 */
export function generateMelody(
  root: ScaleRoot,
  mode: ScaleMode,
  bars: number,
  timeSigTop: number,
  density: 'sparse' | 'medium' | 'dense',
  octave: number,
  seed: number,
): MelodyNote[] {
  const scalePitches = getScalePitches(root, mode)
  const minPitch = octave * 12
  const maxPitch = (octave + 2) * 12

  // Filter scale pitches to the desired octave range
  const rangePitches = scalePitches.filter(p => p >= minPitch && p <= maxPitch)
  if (rangePitches.length === 0) return []

  const totalBeats = bars * timeSigTop
  const lengths = DENSITY_LENGTHS[density]
  const notes: MelodyNote[] = []

  let currentSeed = seed
  let beat = 0

  // Rest probability by density
  const restProb: Record<'sparse' | 'medium' | 'dense', number> = {
    sparse: 0.35,
    medium: 0.2,
    dense:  0.08,
  }
  const pRest = restProb[density]

  while (beat < totalBeats) {
    // Pick a random note length
    let r = lcgRand(currentSeed)
    currentSeed = r.next
    const lengthIndex = Math.floor(r.value * lengths.length)
    const length = lengths[Math.min(lengthIndex, lengths.length - 1)]!

    // Clamp length to remaining beats
    const actualLength = Math.min(length, totalBeats - beat)
    if (actualLength <= 0) break

    // Decide rest or note
    r = lcgRand(currentSeed)
    currentSeed = r.next
    const isRest = r.value < pRest

    if (!isRest) {
      // Pick pitch
      r = lcgRand(currentSeed)
      currentSeed = r.next
      const pitchIndex = Math.floor(r.value * rangePitches.length)
      const pitch = rangePitches[Math.min(pitchIndex, rangePitches.length - 1)]!

      // Pick velocity (70-110 with humanization)
      r = lcgRand(currentSeed)
      currentSeed = r.next
      const velocity = Math.round(70 + r.value * 40)

      notes.push({
        beat,
        pitch,
        velocity: Math.max(1, Math.min(127, velocity)),
        lengthBeats: actualLength * 0.9, // slight articulation gap
      })
    }

    beat += actualLength
  }

  return notes
}
