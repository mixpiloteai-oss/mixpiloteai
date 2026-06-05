// ─── HarmonyAnalyzer ─────────────────────────────────────────────────────────
// Real Krumhansl-Schmuckler key detection algorithm.

import type { MidiNote } from '../../types/project'

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export type MusicalKey = {
  root:       number               // 0=C, 1=C#, ..., 11=B
  mode:       'major' | 'minor'
  confidence: number               // 0–1, correlation coefficient
  name:       string               // e.g. "C major", "A minor"
}

export type ChordType = 'major' | 'minor' | 'diminished' | 'augmented' | 'dominant7'

export interface DetectedChord {
  root:       number
  type:       ChordType
  startBeat:  number
  confidence: number
}

// Krumhansl-Schmuckler profiles
const MAJOR_PROFILE: readonly number[] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE: readonly number[] = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function pearsonCorrelation(a: Float32Array, b: readonly number[]): number {
  const n = a.length
  let sumA = 0, sumB = 0
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i] }
  const meanA = sumA / n
  const meanB = sumB / n
  let num = 0, denomA = 0, denomB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num    += da * db
    denomA += da * da
    denomB += db * db
  }
  const denom = Math.sqrt(denomA * denomB)
  return denom === 0 ? 0 : num / denom
}

function rotateProfile(profile: readonly number[], shift: number): number[] {
  const n = profile.length
  const rotated: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    rotated[i] = profile[(i - shift + n) % n]
  }
  return rotated
}

/**
 * Build a normalized 12-bin pitch class histogram from MIDI notes.
 * Weights each note by its lengthBeats.
 */
export function buildPitchClassProfile(notes: MidiNote[]): Float32Array {
  const pcp = new Float32Array(12)
  for (const note of notes) {
    const pc = note.pitch % 12
    pcp[pc] += note.lengthBeats > 0 ? note.lengthBeats : 1
  }
  // Normalize
  let total = 0
  for (let i = 0; i < 12; i++) total += pcp[i]
  if (total > 0) {
    for (let i = 0; i < 12; i++) pcp[i] /= total
  }
  return pcp
}

/**
 * Detect the musical key of a set of MIDI notes using Krumhansl-Schmuckler algorithm.
 */
export function detectKey(notes: MidiNote[]): MusicalKey {
  if (notes.length === 0) {
    return { root: 0, mode: 'major', confidence: 0, name: 'unknown' }
  }

  const pcp = buildPitchClassProfile(notes)

  let bestCorr = -Infinity
  let bestRoot = 0
  let bestMode: 'major' | 'minor' = 'major'

  // Try all 12 roots for both major and minor
  for (let root = 0; root < 12; root++) {
    const majorRotated = rotateProfile(MAJOR_PROFILE, root)
    const minorRotated = rotateProfile(MINOR_PROFILE, root)

    const majorCorr = pearsonCorrelation(pcp, majorRotated)
    const minorCorr = pearsonCorrelation(pcp, minorRotated)

    if (majorCorr > bestCorr) {
      bestCorr = majorCorr
      bestRoot = root
      bestMode = 'major'
    }
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr
      bestRoot = root
      bestMode = 'minor'
    }
  }

  // Normalize confidence: Pearson r is in [-1, 1], map to [0, 1]
  const confidence = Math.max(0, Math.min(1, (bestCorr + 1) / 2))
  const name = `${NOTE_NAMES[bestRoot]} ${bestMode}`

  return { root: bestRoot, mode: bestMode, confidence, name }
}

/**
 * Classify chord type from a set of pitch classes (intervals relative to root).
 */
function classifyChord(pitchClasses: number[], root: number): ChordType {
  const intervals = new Set(pitchClasses.map(pc => (pc - root + 12) % 12))

  const hasMinor3rd  = intervals.has(3)
  const hasMajor3rd  = intervals.has(4)
  const hasDim5th    = intervals.has(6)
  const hasPerfect5th = intervals.has(7)
  const hasAug5th    = intervals.has(8)
  const hasMinor7th  = intervals.has(10)

  if (hasMajor3rd && hasPerfect5th && hasMinor7th) return 'dominant7'
  if (hasMajor3rd && hasAug5th) return 'augmented'
  if (hasMinor3rd && hasDim5th) return 'diminished'
  if (hasMinor3rd && hasPerfect5th) return 'minor'
  return 'major'
}

/**
 * Group notes by beat windows and detect chords.
 */
export function detectChords(notes: MidiNote[], beatsPerBar: number): DetectedChord[] {
  if (notes.length === 0) return []

  const maxBeat = Math.max(...notes.map(n => n.startBeat + n.lengthBeats))
  const numBars = Math.ceil(maxBeat / beatsPerBar)
  const chords: DetectedChord[] = []

  for (let bar = 0; bar < numBars; bar++) {
    const startBeat = bar * beatsPerBar
    const endBeat   = startBeat + beatsPerBar

    // Find notes that overlap with this bar window
    const windowNotes = notes.filter(n =>
      n.startBeat < endBeat && n.startBeat + n.lengthBeats > startBeat
    )

    if (windowNotes.length < 2) continue

    // Get unique pitch classes
    const pitchClasses = [...new Set(windowNotes.map(n => n.pitch % 12))]
    if (pitchClasses.length < 2) continue

    // Find the most common pitch class as root
    const pcCounts = new Map<number, number>()
    for (const n of windowNotes) {
      const pc = n.pitch % 12
      pcCounts.set(pc, (pcCounts.get(pc) ?? 0) + n.lengthBeats)
    }
    let root = 0, maxCount = 0
    pcCounts.forEach((count, pc) => {
      if (count > maxCount) { maxCount = count; root = pc }
    })

    const type = classifyChord(pitchClasses, root)
    const confidence = Math.min(1, pitchClasses.length / 4)

    chords.push({ root, type, startBeat, confidence })
  }

  return chords
}
