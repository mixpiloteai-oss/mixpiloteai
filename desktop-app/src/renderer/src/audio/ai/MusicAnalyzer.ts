// ─── MusicAnalyzer ───────────────────────────────────────────────────────────
// Real project analysis. Extracts musical features from the project state.

import type { Project, MidiNote } from '../../types/project'
import { detectKey } from './HarmonyAnalyzer'
import type { MusicalKey } from './HarmonyAnalyzer'

export type MusicalStyle = 'techno' | 'house' | 'ambient' | 'hip-hop' | 'drum-and-bass' | 'pop' | 'unknown'

export interface TrackEnergyProfile {
  trackId:      string
  trackName:    string
  type:         string
  noteCount:    number
  avgVelocity:  number
  density:      number      // notes per beat
  pitchRange:   number      // max - min pitch
  isPercussive: boolean     // true if pitch range < 12 and avgPitch < 48
  isBass:       boolean     // true if avgPitch < 48
}

export interface ProjectAnalysis {
  bpm:             number
  timeSignature:   { numerator: number; denominator: number }
  detectedKey:     MusicalKey | null
  style:           MusicalStyle
  styleConfidence: number
  energy:          number       // 0–1, overall RMS-equivalent from velocity/density
  tracks:          TrackEnergyProfile[]
  totalNotes:      number
  activeTracks:    number
  hasKick:         boolean
  hasBass:         boolean
  hasHarmony:      boolean
  loopLength:      number       // in bars
}

/**
 * Collect all notes from all clips in a midi track.
 */
function collectTrackNotes(track: { clips: { notes: MidiNote[] }[] }): MidiNote[] {
  const notes: MidiNote[] = []
  for (const clip of track.clips) {
    for (const note of clip.notes) {
      notes.push(note)
    }
  }
  return notes
}

/**
 * Build a TrackEnergyProfile from a track and its collected notes.
 */
function buildTrackProfile(
  trackId: string,
  trackName: string,
  type: string,
  notes: MidiNote[],
  totalBeats: number,
): TrackEnergyProfile {
  if (notes.length === 0) {
    return {
      trackId, trackName, type,
      noteCount: 0, avgVelocity: 0, density: 0,
      pitchRange: 0, isPercussive: false, isBass: false,
    }
  }

  const velocities = notes.map(n => n.velocity)
  const pitches    = notes.map(n => n.pitch)
  const avgVelocity = velocities.reduce((s, v) => s + v, 0) / velocities.length
  const minPitch    = Math.min(...pitches)
  const maxPitch    = Math.max(...pitches)
  const pitchRange  = maxPitch - minPitch
  const avgPitch    = pitches.reduce((s, p) => s + p, 0) / pitches.length
  const density     = totalBeats > 0 ? notes.length / totalBeats : 0

  const isPercussive = pitchRange < 12 && avgPitch < 48
  const isBass       = avgPitch < 48

  return {
    trackId, trackName, type,
    noteCount: notes.length,
    avgVelocity,
    density,
    pitchRange,
    isPercussive,
    isBass,
  }
}

/**
 * Detect musical style from project characteristics.
 * Pure rule-based heuristics — no randomness.
 */
function detectStyle(
  bpm: number,
  hasKick: boolean,
  hasBass: boolean,
  tracks: TrackEnergyProfile[],
): { style: MusicalStyle; confidence: number } {
  // drum-and-bass: very fast
  if (bpm > 160) {
    return { style: 'drum-and-bass', confidence: 0.85 }
  }

  // techno: 128-160 BPM with kick and bass
  if (bpm >= 128 && bpm < 160 && hasKick && hasBass) {
    return { style: 'techno', confidence: 0.80 }
  }

  // house: 120-128 BPM
  if (bpm >= 120 && bpm < 128) {
    return { style: 'house', confidence: 0.75 }
  }

  // slow: ambient or hip-hop
  if (bpm < 90) {
    const avgVelocity = tracks.length > 0
      ? tracks.reduce((s, t) => s + t.avgVelocity, 0) / tracks.length
      : 80

    const percussiveTracks = tracks.filter(t => t.isPercussive)
    const highDensityKick  = percussiveTracks.some(t => t.density > 1)

    if (highDensityKick) {
      return { style: 'hip-hop', confidence: 0.70 }
    }
    if (avgVelocity < 70) {
      return { style: 'ambient', confidence: 0.70 }
    }
    return { style: 'hip-hop', confidence: 0.55 }
  }

  // 90-120: pop or unknown
  if (bpm >= 90 && bpm < 120) {
    return { style: 'pop', confidence: 0.60 }
  }

  return { style: 'unknown', confidence: 0.30 }
}

/**
 * Analyze the full project and return a ProjectAnalysis.
 */
export function analyzeProject(project: Project): ProjectAnalysis {
  const beatsPerBar = project.timeSignatureNumerator
  const totalBeats  = project.totalBars * beatsPerBar

  const tracks: TrackEnergyProfile[] = []
  let allNotes: MidiNote[] = []

  for (const track of project.tracks) {
    if (track.type !== 'midi') continue

    const notes = collectTrackNotes(track)
    allNotes = allNotes.concat(notes)

    const profile = buildTrackProfile(track.id, track.name, track.type, notes, totalBeats)
    tracks.push(profile)
  }

  const totalNotes   = allNotes.length
  const activeTracks = tracks.filter(t => t.noteCount > 0).length

  // Key detection
  const detectedKey = totalNotes > 0 ? detectKey(allNotes) : null

  // Presence detection
  const KICK_PITCHES = new Set([35, 36, 38])
  const hasKick = tracks.some(t =>
    t.isPercussive && project.tracks
      .find(tr => tr.id === t.trackId)
      ?.clips.some(c => c.notes.some(n => KICK_PITCHES.has(n.pitch))) === true
  )
  const hasBass    = tracks.some(t => t.isBass)
  const hasHarmony = tracks.some(t => t.pitchRange > 12 && !t.isPercussive)

  // Style detection
  const { style, confidence: styleConfidence } = detectStyle(project.bpm, hasKick, hasBass, tracks)

  // Energy: average of (avgVelocity / 127) * density, normalized
  let energy = 0
  if (activeTracks > 0) {
    const energyValues = tracks
      .filter(t => t.noteCount > 0)
      .map(t => (t.avgVelocity / 127) * Math.min(1, t.density))
    energy = energyValues.length > 0
      ? energyValues.reduce((s, e) => s + e, 0) / energyValues.length
      : 0
  }
  energy = Math.max(0, Math.min(1, energy))

  const loopLength = project.loopEnd - project.loopStart

  return {
    bpm:           project.bpm,
    timeSignature: { numerator: project.timeSignatureNumerator, denominator: project.timeSignatureDenominator },
    detectedKey,
    style,
    styleConfidence,
    energy,
    tracks,
    totalNotes,
    activeTracks,
    hasKick,
    hasBass,
    hasHarmony,
    loopLength,
  }
}
