// ─── AcidRampGenerator.ts ─────────────────────────────────────────────────────
// Generates 303-style acid basslines with filter automation curves.

import { SeededRng } from './SeededRng'

export interface AcidRampOptions {
  bars: number
  bpm: number
  rootNote: number
  scale: number[]
  rng: SeededRng
  intensity: number  // 0-1
}

export interface AutomationPoint {
  beat: number
  value: number  // normalized 0-1
}

export interface AcidAutomationCurve {
  points: AutomationPoint[]
  type: 'filter' | 'resonance' | 'volume'
}

export interface AcidNote {
  pitch: number
  startBeat: number
  duration: number
  velocity: number
  accent: boolean
  slide: boolean
}

export interface AcidPattern {
  notes: AcidNote[]
  filterAutomation: AcidAutomationCurve
  resonanceAutomation: AcidAutomationCurve
}

/**
 * Generate a 303-style acid ramp pattern with filter sweep automation.
 */
export function generateAcidRamp(options: AcidRampOptions): AcidPattern {
  const { bars, rng, intensity, rootNote, scale } = options
  const totalSteps = bars * 16  // 16th note grid (4 beats × 4 × bars)
  const notes: AcidNote[] = []
  const usedBeats = new Set<number>()

  // Generate 16th note grid
  for (let step = 0; step < totalSteps; step++) {
    // Place note with probability 0.75
    if (rng.next() >= 0.75) continue

    const startBeat = step * 0.25  // each 16th = 0.25 beats

    // Avoid duplicate beats
    const beatKey = Math.round(startBeat * 1000)
    if (usedBeats.has(beatKey)) continue
    usedBeats.add(beatKey)

    // Pick pitch: chromatic descent near root ± scale tones
    // Use scale tones and chromatic approach notes
    const scalePitches = scale.map(interval => {
      const pitch = rootNote + interval
      return pitch >= 0 && pitch <= 127 ? pitch : rootNote
    })

    // Add chromatic neighbors of root
    const candidates: number[] = [
      ...scalePitches,
      rootNote - 1,
      rootNote + 1,
      rootNote - 2,
    ].filter(p => p >= 0 && p <= 127)

    const pitch = candidates.length > 0
      ? candidates[Math.floor(rng.next() * candidates.length)]!
      : rootNote

    const accent = rng.next() < 0.2
    const slide = rng.next() < 0.15
    const velocity = accent
      ? 110
      : 75 + Math.round(rng.next() * 20)

    notes.push({
      pitch: Math.max(0, Math.min(127, pitch)),
      startBeat,
      duration: slide ? 0.5 : 0.25,
      velocity: Math.max(1, Math.min(127, velocity)),
      accent,
      slide,
    })
  }

  // Sort by start beat
  notes.sort((a, b) => a.startBeat - b.startBeat)

  const totalBeats = bars * 4

  // Filter automation: linear ramp from ~0 (200Hz) to ~1 (8000Hz) over all bars
  const filterPoints: AutomationPoint[] = []
  const filterSteps = bars * 8  // every 0.5 beats
  for (let i = 0; i < filterSteps; i++) {
    const beat = i * 0.5
    const t = filterSteps > 1 ? i / (filterSteps - 1) : 0
    // Apply intensity scaling: start low, end high
    const value = (0.025 + t * 0.975) * intensity + (1 - intensity) * 0.5
    filterPoints.push({ beat, value: Math.max(0, Math.min(1, value)) })
  }
  // Ensure last point
  if (filterSteps > 0) {
    filterPoints.push({ beat: totalBeats, value: Math.min(1, intensity) })
  }

  // Resonance automation: triangle wave (low at start, peak at 60%, back down)
  const resonancePoints: AutomationPoint[] = []
  const resSteps = bars * 8
  for (let i = 0; i < resSteps; i++) {
    const beat = i * 0.5
    const t = resSteps > 1 ? i / (resSteps - 1) : 0
    // Triangle: rises to 0.6, peaks at 0.6 position, falls back
    let value: number
    if (t <= 0.6) {
      value = t / 0.6 * 0.9
    } else {
      value = 0.9 * (1 - (t - 0.6) / 0.4)
    }
    resonancePoints.push({ beat, value: Math.max(0, Math.min(1, value)) })
  }

  return {
    notes,
    filterAutomation: {
      points: filterPoints,
      type: 'filter',
    },
    resonanceAutomation: {
      points: resonancePoints,
      type: 'resonance',
    },
  }
}
