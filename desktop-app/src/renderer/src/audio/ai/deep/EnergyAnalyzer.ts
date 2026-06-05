// ─── EnergyAnalyzer.ts ────────────────────────────────────────────────────────
// Analyzes energy per track and globally, detects buildup/drop points.

import type { AnalysisTrack } from './AnalysisTypes'

export interface EnergyAnalysis {
  perTrackEnergy: Map<string, Float32Array>
  globalEnergy: Float32Array
  buildupPoints: number[]
  dropPoints: number[]
  sustainedPeaks: Array<{ startBar: number; endBar: number; avgEnergy: number }>
}

/**
 * Analyze energy across all tracks per bar.
 */
export function analyzeEnergy(
  tracks: AnalysisTrack[],
  _bpm: number,
  totalBars: number,
): EnergyAnalysis {
  const perTrackEnergy = new Map<string, Float32Array>()

  if (totalBars <= 0) {
    return {
      perTrackEnergy,
      globalEnergy: new Float32Array(0),
      buildupPoints: [],
      dropPoints: [],
      sustainedPeaks: [],
    }
  }

  // Per-track energy: count notes × velocity / 127 per bar, normalize by track max
  for (const track of tracks) {
    const rawEnergy = new Float32Array(totalBars)

    for (const clip of track.clips) {
      for (const note of clip.notes) {
        // note.startBeat is global beat position (clip.startBeat + note offset)
        const globalBeat = clip.startBeat + note.startBeat
        const bar = Math.floor(globalBeat / 4)
        if (bar >= 0 && bar < totalBars) {
          rawEnergy[bar] += note.velocity / 127
        }
      }
    }

    // Normalize by track max
    let trackMax = 0
    for (let i = 0; i < totalBars; i++) {
      if (rawEnergy[i] > trackMax) trackMax = rawEnergy[i]
    }

    const trackEnergy = new Float32Array(totalBars)
    if (trackMax > 0) {
      for (let i = 0; i < totalBars; i++) {
        trackEnergy[i] = rawEnergy[i] / trackMax
      }
    }

    perTrackEnergy.set(track.id, trackEnergy)
  }

  // Global energy: sum of all tracks, normalized
  const globalRaw = new Float32Array(totalBars)
  for (const trackEnergy of perTrackEnergy.values()) {
    for (let i = 0; i < totalBars; i++) {
      globalRaw[i] += trackEnergy[i]
    }
  }

  let globalMax = 0
  for (let i = 0; i < totalBars; i++) {
    if (globalRaw[i] > globalMax) globalMax = globalRaw[i]
  }

  const globalEnergy = new Float32Array(totalBars)
  if (globalMax > 0) {
    for (let i = 0; i < totalBars; i++) {
      globalEnergy[i] = globalRaw[i] / globalMax
    }
  }

  // Detect buildup points: bars where energy increases by > 0.3 over 4 bars
  const buildupPoints: number[] = []
  for (let bar = 4; bar < totalBars; bar++) {
    const delta = globalEnergy[bar] - globalEnergy[bar - 4]
    if (delta > 0.3) {
      buildupPoints.push(bar)
    }
  }

  // Detect drop points: bars where energy drops by > 0.4 after a peak
  const dropPoints: number[] = []
  for (let bar = 4; bar < totalBars; bar++) {
    const delta = globalEnergy[bar - 4] - globalEnergy[bar]
    // Previous was a local peak
    const prevPeak = globalEnergy[bar - 4]
    if (delta > 0.4 && prevPeak > 0.5) {
      dropPoints.push(bar)
    }
  }

  // Sustained peaks: contiguous regions with energy > 0.7
  const sustainedPeaks: Array<{ startBar: number; endBar: number; avgEnergy: number }> = []
  let peakStart = -1
  let peakSum = 0
  let peakCount = 0

  for (let bar = 0; bar <= totalBars; bar++) {
    const e = bar < totalBars ? globalEnergy[bar] : 0
    if (e > 0.7) {
      if (peakStart < 0) {
        peakStart = bar
        peakSum = 0
        peakCount = 0
      }
      peakSum += e
      peakCount++
    } else {
      if (peakStart >= 0 && peakCount >= 2) {
        sustainedPeaks.push({
          startBar: peakStart,
          endBar: bar,
          avgEnergy: peakSum / peakCount,
        })
      }
      peakStart = -1
    }
  }

  return {
    perTrackEnergy,
    globalEnergy,
    buildupPoints,
    dropPoints,
    sustainedPeaks,
  }
}
