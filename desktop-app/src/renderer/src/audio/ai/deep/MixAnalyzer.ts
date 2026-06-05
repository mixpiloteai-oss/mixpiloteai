// ─── MixAnalyzer.ts ───────────────────────────────────────────────────────────
// Analyzes mix balance, frequency distribution, and provides suggestions.

import type { AnalysisTrack, FrequencyBand } from './AnalysisTypes'

export interface MixAnalysis {
  trackBalance: Map<string, number>
  frequencyDistribution: FrequencyBand
  percussionRatio: number
  harmonicDensity: number
  stereoBalance: number
  headroomScore: number
  suggestions: string[]
}

/**
 * Analyze mix characteristics from track data.
 */
export function analyzeMix(tracks: AnalysisTrack[], totalNotes: number): MixAnalysis {
  const trackBalance = new Map<string, number>()
  const freqCounts = { sub: 0, low: 0, mid: 0, high: 0 }
  let totalVelocity = 0
  let noteCount = 0
  let percussionTracks = 0
  let pannedTracks = 0

  // Per-track note density for balance
  const trackNoteCounts: Map<string, number> = new Map()
  for (const track of tracks) {
    let count = 0
    for (const clip of track.clips) {
      for (const note of clip.notes) {
        count++
        totalVelocity += note.velocity
        noteCount++

        // Frequency distribution based on MIDI pitch ranges
        if (note.pitch < 36) freqCounts.sub++
        else if (note.pitch < 60) freqCounts.low++
        else if (note.pitch < 84) freqCounts.mid++
        else freqCounts.high++
      }
    }
    trackNoteCounts.set(track.id, count)

    // Count percussion
    if (track.type === 'drum') percussionTracks++
  }

  // Normalize track balance 0-1
  const maxTrackNotes = Math.max(1, ...Array.from(trackNoteCounts.values()))
  for (const [id, count] of trackNoteCounts) {
    trackBalance.set(id, count / maxTrackNotes)
  }

  // Frequency distribution normalized
  const freqTotal = Math.max(1, freqCounts.sub + freqCounts.low + freqCounts.mid + freqCounts.high)
  const frequencyDistribution: FrequencyBand = {
    sub: freqCounts.sub / freqTotal,
    low: freqCounts.low / freqTotal,
    mid: freqCounts.mid / freqTotal,
    high: freqCounts.high / freqTotal,
  }

  const percussionRatio = tracks.length > 0 ? percussionTracks / tracks.length : 0

  // Harmonic density: average notes per bar across tracks
  // Simplified: total notes / (tracks * estimated bars)
  const harmonicDensity = tracks.length > 0 ? totalNotes / Math.max(1, tracks.length) / 16 : 0

  // Stereo balance heuristic: panned = lead/pad/chord tracks (simplified)
  for (const track of tracks) {
    if (track.type === 'lead' || track.type === 'pad' || track.type === 'chord' || track.type === 'fx') {
      pannedTracks++
    }
  }
  const stereoBalance = tracks.length > 0 ? Math.min(1, pannedTracks / tracks.length) : 0

  // Headroom: 1 - (avg velocity / 127)
  const avgVelocity = noteCount > 0 ? totalVelocity / noteCount : 0
  const headroomScore = 1 - (avgVelocity / 127)

  // Generate mix suggestions (up to 3)
  const suggestions: string[] = []

  if (headroomScore < 0.1) {
    suggestions.push('Average velocity is very high — reduce master limiter threshold or lower track velocities to improve headroom.')
  }

  if (frequencyDistribution.sub > 0.4) {
    suggestions.push('Sub-bass frequency overload detected. Apply high-pass filters to non-bass elements below 80Hz.')
  } else if (frequencyDistribution.high < 0.1 && noteCount > 0) {
    suggestions.push('Lack of high-frequency content. Add hi-hats, cymbals, or high-pass synths to add air and presence.')
  }

  if (frequencyDistribution.mid > 0.6) {
    suggestions.push('Mid-frequency congestion. Use EQ to carve out space for each instrument in the 500Hz-4kHz range.')
  }

  if (percussionRatio < 0.1 && tracks.length > 2) {
    suggestions.push('No percussion tracks detected. Adding drums or rhythm elements would enhance the groove.')
  }

  if (stereoBalance < 0.2 && tracks.length > 3) {
    suggestions.push('Mix appears mostly mono. Pan some elements left/right for a wider stereo field.')
  }

  return {
    trackBalance,
    frequencyDistribution,
    percussionRatio,
    harmonicDensity,
    stereoBalance,
    headroomScore,
    suggestions: suggestions.slice(0, 3),
  }
}
