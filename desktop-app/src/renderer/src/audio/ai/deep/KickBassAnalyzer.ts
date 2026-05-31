// ─── KickBassAnalyzer.ts ──────────────────────────────────────────────────────
// Analyzes kick and bass note relationships, overlap and sidechain detection.

import type { AnalysisTrack, NotePosition } from './AnalysisTypes'

export interface KickBassAnalysis {
  kickNotes: NotePosition[]
  bassNotes: NotePosition[]
  overlapCount: number
  overlapRatio: number
  sidechainDetected: boolean
  frequencyClashRisk: 'low' | 'medium' | 'high'
  recommendation: string
}

/**
 * Identify kick track by name pattern.
 */
function isKickTrack(name: string): boolean {
  return /kick|bd|bass.?drum/i.test(name)
}

/**
 * Identify bass track by name pattern.
 */
function isBassTrack(name: string): boolean {
  return /bass|sub/i.test(name)
}

/**
 * Analyze kick and bass note overlap and frequency clash risk.
 */
export function analyzeKickBass(tracks: AnalysisTrack[]): KickBassAnalysis {
  const kickNotes: NotePosition[] = []
  const bassNotes: NotePosition[] = []

  for (const track of tracks) {
    const isKick = isKickTrack(track.name)
    const isBass = isBassTrack(track.name) && !isKickTrack(track.name)

    for (const clip of track.clips) {
      for (const note of clip.notes) {
        const globalBeat = clip.startBeat + note.startBeat
        if (isKick) {
          kickNotes.push({ beat: globalBeat, velocity: note.velocity })
        } else if (isBass) {
          bassNotes.push({ beat: globalBeat, pitch: note.pitch, velocity: note.velocity })
        }
      }
    }
  }

  // Count overlaps: kick+bass notes within 0.1 beats of each other
  let overlapCount = 0
  for (const kick of kickNotes) {
    for (const bass of bassNotes) {
      if (Math.abs(kick.beat - bass.beat) < 0.1) {
        overlapCount++
        break // count each kick note at most once
      }
    }
  }

  const maxNotes = Math.max(kickNotes.length, bassNotes.length)
  const overlapRatio = maxNotes > 0 ? overlapCount / maxNotes : 0
  const sidechainDetected = overlapRatio > 0.3

  let frequencyClashRisk: 'low' | 'medium' | 'high'
  if (overlapRatio < 0.2) {
    frequencyClashRisk = 'low'
  } else if (overlapRatio < 0.5) {
    frequencyClashRisk = 'medium'
  } else {
    frequencyClashRisk = 'high'
  }

  let recommendation: string
  if (frequencyClashRisk === 'high') {
    recommendation = 'High frequency clash risk. Apply sidechain compression on bass triggered by kick to create space and punch.'
  } else if (frequencyClashRisk === 'medium') {
    recommendation = 'Moderate kick/bass overlap. Consider sidechain compression or EQ to reduce 60-120Hz clash.'
  } else {
    recommendation = 'Kick and bass have good separation. Minimal frequency clash detected.'
  }

  return {
    kickNotes,
    bassNotes,
    overlapCount,
    overlapRatio,
    sidechainDetected,
    frequencyClashRisk,
    recommendation,
  }
}
