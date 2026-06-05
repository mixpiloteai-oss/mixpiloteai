// ─── GrooveAnalyzer.ts ────────────────────────────────────────────────────────
// Analyzes groove, swing, timing and style characteristics.

import type { AnalysisTrack, GrooveTemplate } from './AnalysisTypes'

export type StyleHint = 'house' | 'techno' | 'dnb' | 'jazz' | 'funk' | 'tribal' | 'trap' | 'latin' | 'straight'

export interface GrooveAnalysis {
  swingAmount: number           // 0=straight, 1=full swing
  grooveTemplate: GrooveTemplate
  velocityVariance: number      // std dev of velocities, normalized 0-1
  timingDeviation: number       // avg absolute deviation from grid in beats
  dominantSubdivision: '4th' | '8th' | '16th' | '32nd'
  styleHint: StyleHint
}

/**
 * Analyze groove and timing characteristics across all tracks.
 */
export function analyzeGroove(tracks: AnalysisTrack[], bpm: number): GrooveAnalysis {
  const beatDuration = 60 / bpm // seconds per beat (for context)
  void beatDuration // used for conceptual clarity

  // Collect all note beat positions and velocities
  const allBeats: number[] = []
  const allVelocities: number[] = []
  const allDurations: number[] = []

  for (const track of tracks) {
    for (const clip of track.clips) {
      for (const note of clip.notes) {
        const globalBeat = clip.startBeat + note.startBeat
        allBeats.push(globalBeat)
        allVelocities.push(note.velocity)
        allDurations.push(note.duration)
      }
    }
  }

  if (allBeats.length === 0) {
    return {
      swingAmount: 0,
      grooveTemplate: 'straight',
      velocityVariance: 0,
      timingDeviation: 0,
      dominantSubdivision: '8th',
      styleHint: 'straight',
    }
  }

  // Calculate timing deviation from grid
  // For each note, find nearest 8th note grid position
  const timingDeviations: number[] = []
  const offBeatDeviations: number[] = [] // deviations of off-beats only

  for (const beat of allBeats) {
    // Nearest 8th note
    const eighthNote = 0.5
    const quantized = Math.round(beat / eighthNote) * eighthNote
    const deviation = beat - quantized
    timingDeviations.push(Math.abs(deviation))

    // Check if this is an off-beat (should be at 0.5 positions)
    const isOffBeat = Math.abs((beat % 1.0) - 0.5) < 0.15
    if (isOffBeat) {
      offBeatDeviations.push(deviation) // signed, for swing detection
    }
  }

  const timingDeviation = timingDeviations.reduce((a, b) => a + b, 0) / timingDeviations.length

  // Swing amount: measure avg off-beat deviation from quantized 0.5 position
  // In swing, off-beats are consistently late (positive deviation)
  let swingAmount = 0
  if (offBeatDeviations.length > 0) {
    const avgOffBeatDev = offBeatDeviations.reduce((a, b) => a + b, 0) / offBeatDeviations.length
    // Normalize: max swing shifts off-beat by 0.166 beats (triplet feel: 0.333 instead of 0.5)
    // We measure from the 0.5 beat position, max late shift ≈ 0.166
    swingAmount = Math.max(0, Math.min(1, avgOffBeatDev / 0.166))
  }

  // Velocity variance: std dev normalized 0-1
  const avgVelocity = allVelocities.reduce((a, b) => a + b, 0) / allVelocities.length
  const variance = allVelocities.reduce((sum, v) => sum + (v - avgVelocity) ** 2, 0) / allVelocities.length
  const stdDev = Math.sqrt(variance)
  const velocityVariance = Math.min(1, stdDev / 63.5) // 127/2 = 63.5 max possible std dev

  // Dominant subdivision: find most common note duration bucket
  const buckets: Record<string, number> = { '4th': 0, '8th': 0, '16th': 0, '32nd': 0 }
  for (const dur of allDurations) {
    if (dur >= 1.5) buckets['4th']++
    else if (dur >= 0.4) buckets['8th']++
    else if (dur >= 0.15) buckets['16th']++
    else buckets['32nd']++
  }

  // Also count by beat positions for subdivision detection
  for (const beat of allBeats) {
    const sub = beat % 1.0
    if (Math.abs(sub % 0.125) < 0.05 && Math.abs(sub % 0.25) >= 0.05) buckets['32nd']++
    else if (Math.abs(sub % 0.25) < 0.05 && Math.abs(sub % 0.5) >= 0.05) buckets['16th']++
    else if (Math.abs(sub % 0.5) < 0.05 && Math.abs(sub) >= 0.05) buckets['8th']++
  }

  let dominantSubdivision: '4th' | '8th' | '16th' | '32nd' = '8th'
  let maxCount = 0
  for (const [key, count] of Object.entries(buckets)) {
    if (count > maxCount) {
      maxCount = count
      dominantSubdivision = key as '4th' | '8th' | '16th' | '32nd'
    }
  }

  // Style hint
  const styleHint = detectStyleHint(swingAmount, dominantSubdivision, timingDeviation, velocityVariance)

  // Groove template
  const grooveTemplate = detectGrooveTemplate(swingAmount, timingDeviation, allBeats)

  return {
    swingAmount,
    grooveTemplate,
    velocityVariance,
    timingDeviation,
    dominantSubdivision,
    styleHint,
  }
}

function detectStyleHint(
  swingAmount: number,
  subdivision: string,
  timingDeviation: number,
  velocityVariance: number,
): StyleHint {
  // Jazz: swing > 0.4 and 8th subdivision
  if (swingAmount > 0.4 && subdivision === '8th') return 'jazz'
  // Funk: swing > 0.2 and 16th subdivision
  if (swingAmount > 0.2 && subdivision === '16th') return 'funk'
  // Techno: 16th subdivision + low timing deviation
  if (subdivision === '16th' && timingDeviation < 0.02) return 'techno'
  // Trap: 16th + high velocity variance
  if (subdivision === '16th' && velocityVariance > 0.3) return 'trap'
  // DNB: 32nd subdivision
  if (subdivision === '32nd') return 'dnb'
  // Latin: 16th + moderate swing
  if (subdivision === '16th' && swingAmount > 0.1 && swingAmount <= 0.3) return 'latin'
  // House: 4th-based with low timing deviation
  if (subdivision === '4th' && timingDeviation < 0.03) return 'house'
  // Tribal: high velocity variance
  if (velocityVariance > 0.4) return 'tribal'
  return 'straight'
}

function detectGrooveTemplate(
  swingAmount: number,
  timingDeviation: number,
  allBeats: number[],
): GrooveTemplate {
  if (swingAmount > 0.4) return 'swing'
  if (swingAmount > 0.15) return 'shuffled'

  // Check if all off-beats are consistently late (laid-back)
  const offBeats = allBeats.filter(b => {
    const sub = b % 1.0
    return Math.abs(sub - 0.5) < 0.15
  })

  if (offBeats.length > 0) {
    const avgSub = offBeats.reduce((sum, b) => {
      const quantized = Math.round(b / 0.5) * 0.5
      return sum + (b - quantized)
    }, 0) / offBeats.length

    if (avgSub > 0.01 && timingDeviation < 0.04) return 'laid-back'
    if (avgSub < -0.01 && timingDeviation < 0.04) return 'pushed'
  }

  if (timingDeviation > 0.03) return 'humanized'
  return 'straight'
}
