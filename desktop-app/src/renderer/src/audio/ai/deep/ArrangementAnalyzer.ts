// ─── ArrangementAnalyzer.ts ───────────────────────────────────────────────────
// Analyzes arrangement structure: sections, energy curve, peak, dynamic range.

import type { AnalysisTrack, SectionRegion, SectionLabel } from './AnalysisTypes'

export interface ArrangementAnalysis {
  sections: SectionRegion[]
  energyCurve: Float32Array
  peakBar: number
  averageEnergy: number
  dynamicRange: number
  hasDropStructure: boolean
  hasBridgeSection: boolean
}

// Track type weights for energy calculation
const TRACK_WEIGHT: Record<string, number> = {
  drum: 1.5,
  bass: 1.2,
  lead: 1.0,
  chord: 1.0,
  pad: 0.8,
  fx: 0.7,
  vocal: 1.0,
  unknown: 1.0,
}

/**
 * Check if a clip overlaps a given bar (0-based).
 * Clip startBeat is beat-based; 1 bar = 4 beats (4/4).
 */
function clipOverlapsBar(clipStartBeat: number, clipEndBeat: number, bar: number): boolean {
  const barStartBeat = bar * 4
  const barEndBeat = barStartBeat + 4
  return clipStartBeat < barEndBeat && clipEndBeat > barStartBeat
}

/**
 * Analyze arrangement structure from track data.
 */
export function analyzeArrangement(
  tracks: AnalysisTrack[],
  _bpm: number,
  totalBars: number,
): ArrangementAnalysis {
  if (totalBars <= 0) {
    return {
      sections: [],
      energyCurve: new Float32Array(0),
      peakBar: 0,
      averageEnergy: 0,
      dynamicRange: 0,
      hasDropStructure: false,
      hasBridgeSection: false,
    }
  }

  // Build energy per bar
  const rawEnergy = new Float32Array(totalBars)

  for (const track of tracks) {
    const weight = TRACK_WEIGHT[track.type] ?? 1.0
    for (const clip of track.clips) {
      // Compute clip duration from notes
      let clipEndBeat = clip.startBeat + 4 // default 1 bar
      if (clip.notes.length > 0) {
        const lastNote = Math.max(...clip.notes.map(n => n.startBeat + n.duration))
        clipEndBeat = clip.startBeat + Math.max(4, lastNote)
      }

      for (let bar = 0; bar < totalBars; bar++) {
        if (clipOverlapsBar(clip.startBeat, clipEndBeat, bar)) {
          rawEnergy[bar] += weight
        }
      }
    }
  }

  // Normalize 0-1
  let maxRaw = 0
  for (let i = 0; i < totalBars; i++) {
    if (rawEnergy[i] > maxRaw) maxRaw = rawEnergy[i]
  }

  const energyCurve = new Float32Array(totalBars)
  if (maxRaw > 0) {
    for (let i = 0; i < totalBars; i++) {
      energyCurve[i] = rawEnergy[i] / maxRaw
    }
  }

  // Peak bar
  let peakBar = 0
  let peakVal = -1
  for (let i = 0; i < totalBars; i++) {
    if (energyCurve[i] > peakVal) {
      peakVal = energyCurve[i]
      peakBar = i
    }
  }

  // Average energy
  let sumEnergy = 0
  for (let i = 0; i < totalBars; i++) sumEnergy += energyCurve[i]
  const averageEnergy = totalBars > 0 ? sumEnergy / totalBars : 0

  // Dynamic range
  let minEnergy = Infinity
  let maxEnergy = -Infinity
  for (let i = 0; i < totalBars; i++) {
    if (energyCurve[i] < minEnergy) minEnergy = energyCurve[i]
    if (energyCurve[i] > maxEnergy) maxEnergy = energyCurve[i]
  }
  if (!isFinite(minEnergy)) minEnergy = 0
  if (!isFinite(maxEnergy)) maxEnergy = 0
  const dynamicRange = maxEnergy - minEnergy

  // Section detection using threshold-crossing with hysteresis
  const sections = detectSections(energyCurve, totalBars)

  // Structure flags
  const hasDropStructure = checkDropStructure(sections)
  const hasBridgeSection = sections.some(s => s.label === 'bridge')

  return {
    sections,
    energyCurve,
    peakBar,
    averageEnergy,
    dynamicRange,
    hasDropStructure,
    hasBridgeSection,
  }
}

/**
 * Segment energy curve into sections using threshold-crossing with hysteresis.
 */
function detectSections(energyCurve: Float32Array, totalBars: number): SectionRegion[] {
  if (totalBars === 0) return []

  const HIGH_THRESHOLD = 0.6
  const LOW_THRESHOLD = 0.4
  const HYSTERESIS = 0.2

  // Group consecutive bars into regions
  const regions: Array<{ startBar: number; endBar: number; avgEnergy: number }> = []

  let regionStart = 0
  let currentHigh = energyCurve[0] > (HIGH_THRESHOLD - HYSTERESIS / 2)

  for (let bar = 1; bar < totalBars; bar++) {
    const e = energyCurve[bar]
    const wasHigh = currentHigh
    if (!currentHigh && e > HIGH_THRESHOLD) currentHigh = true
    if (currentHigh && e < LOW_THRESHOLD) currentHigh = false

    if (currentHigh !== wasHigh || bar === totalBars - 1) {
      const endBar = bar === totalBars - 1 ? totalBars : bar
      let sum = 0
      for (let b = regionStart; b < endBar; b++) sum += energyCurve[b]
      const avgEnergy = endBar > regionStart ? sum / (endBar - regionStart) : 0
      regions.push({ startBar: regionStart, endBar, avgEnergy })
      regionStart = bar
    }
  }

  // Ensure last region is captured
  if (regions.length === 0 || regions[regions.length - 1].endBar < totalBars) {
    let sum = 0
    const start = regions.length > 0 ? regions[regions.length - 1].endBar : 0
    for (let b = start; b < totalBars; b++) sum += energyCurve[b]
    const avgEnergy = totalBars > start ? sum / (totalBars - start) : 0
    regions.push({ startBar: start, endBar: totalBars, avgEnergy })
  }

  // Classify each region
  return regions.map((region, idx) => {
    const positionRatio = region.startBar / totalBars
    const isFirst = idx === 0
    const isLast = idx === regions.length - 1
    const label = classifySection(region.avgEnergy, positionRatio, isFirst, isLast, regions, idx)

    // Clip density = energy * 2 (simplified heuristic)
    const clipDensity = region.avgEnergy

    return {
      label,
      startBar: region.startBar,
      endBar: region.endBar,
      energy: region.avgEnergy,
      clipDensity,
    }
  })
}

function classifySection(
  energy: number,
  positionRatio: number,
  isFirst: boolean,
  isLast: boolean,
  regions: Array<{ startBar: number; endBar: number; avgEnergy: number }>,
  idx: number,
): SectionLabel {
  // Silence
  if (energy < 0.05) return 'silence'

  // Intro: first 20% and low energy
  if (isFirst && positionRatio <= 0.2 && energy < 0.6) return 'intro'

  // Outro: last section and low-medium energy
  if (isLast && energy < 0.6) return 'outro'

  // Drop: high energy local maximum (> 0.7)
  if (energy > 0.7) {
    // Check if previous region was a buildup (rising)
    if (idx > 0) {
      const prev = regions[idx - 1]
      if (prev && prev.avgEnergy < energy) return 'drop'
    }
    return 'drop'
  }

  // Buildup: energy rising toward a drop
  if (idx < regions.length - 1) {
    const next = regions[idx + 1]
    if (next && next.avgEnergy > energy + 0.15 && next.avgEnergy > 0.7) return 'buildup'
  }

  // Breakdown: low energy after drop
  if (idx > 0) {
    const prev = regions[idx - 1]
    if (prev && prev.avgEnergy > energy + 0.2 && energy < 0.4) return 'breakdown'
  }

  // Bridge: mid-track, medium energy
  if (positionRatio > 0.3 && positionRatio < 0.7 && energy >= 0.2 && energy < 0.6) {
    // Only label one bridge
    return 'bridge'
  }

  // Verse: remaining medium sections
  if (energy < 0.6) return 'verse'

  return 'verse'
}

function checkDropStructure(sections: SectionRegion[]): boolean {
  // Has a buildup followed by a drop
  for (let i = 0; i < sections.length - 1; i++) {
    if (sections[i].label === 'buildup' && sections[i + 1]?.label === 'drop') return true
  }
  return false
}
