// ─── TransitionBuilder.ts ─────────────────────────────────────────────────────
// Builds buildup, drop, and breakdown transition events and automation.

import type { MusicStyle, TrackType } from './deep/AnalysisTypes'
import type { AcidAutomationCurve, AutomationPoint } from './AcidRampGenerator'
import { SeededRng } from './SeededRng'

export interface BuildupOptions {
  bars: number
  bpm: number
  startBar: number
  style: MusicStyle
  intensity: number
  rng: SeededRng
}

export interface DropOptions {
  bars: number
  bpm: number
  startBar: number
  style: MusicStyle
  rng: SeededRng
}

export interface BreakdownOptions {
  bars: number
  bpm: number
  startBar: number
  style: MusicStyle
  rng: SeededRng
}

export interface TransitionEvent {
  type: 'add_note' | 'remove_clip' | 'add_clip' | 'set_velocity'
  trackHint: TrackType
  beat: number
  params: Record<string, number | string>
}

export interface TransitionResult {
  events: TransitionEvent[]
  automationCurves: AcidAutomationCurve[]
  description: string
}

/**
 * Build a buildup transition.
 */
export function buildBuildup(options: BuildupOptions): TransitionResult {
  const { bars, startBar, rng, intensity } = options
  void rng
  const events: TransitionEvent[] = []
  const automationCurves: AcidAutomationCurve[] = []
  const startBeat = startBar * 4
  const totalBeats = bars * 4

  // Exponential density increase: notes per bar doubles each 2 bars
  for (let bar = 0; bar < bars; bar++) {
    const barStart = startBeat + bar * 4
    const density = Math.pow(2, bar / 2)  // doubles every 2 bars
    const notesPerBar = Math.round(4 * density)

    for (let i = 0; i < notesPerBar; i++) {
      const beat = barStart + (i / notesPerBar) * 4
      events.push({
        type: 'add_note',
        trackHint: 'drum',
        beat,
        params: { velocity: Math.round(60 + (bar / bars) * 67), pitch: 38 },
      })
    }
  }

  // Rising pitch element: chromatic ascent on synth
  for (let bar = 0; bar < bars; bar++) {
    events.push({
      type: 'add_note',
      trackHint: 'lead',
      beat: startBeat + bar * 4,
      params: {
        pitch: 48 + bar * 2,
        velocity: Math.round(80 + (bar / bars) * 47),
        duration: 4,
      },
    })
  }

  // Snare roll on last bar: 32nd notes
  const lastBarStart = startBeat + (bars - 1) * 4
  for (let i = 0; i < 32; i++) {
    events.push({
      type: 'add_note',
      trackHint: 'drum',
      beat: lastBarStart + i * 0.125,
      params: {
        pitch: 38,
        velocity: Math.round(60 + (i / 32) * 67),
        duration: 0.125,
      },
    })
  }

  // Filter sweep: low-pass opens from ~0 (400Hz) to ~1 (18kHz)
  const filterPoints: AutomationPoint[] = []
  const steps = bars * 8
  for (let i = 0; i < steps; i++) {
    const beat = startBeat + i * 0.5
    const t = steps > 1 ? i / (steps - 1) : 0
    filterPoints.push({ beat, value: 0.02 + t * 0.98 * intensity })
  }

  automationCurves.push({
    points: filterPoints,
    type: 'filter',
  })

  return {
    events,
    automationCurves,
    description: `${bars}-bar buildup with exponential density increase, chromatic ascent, filter sweep, and snare roll`,
  }
}

/**
 * Build a drop transition.
 */
export function buildDrop(options: DropOptions): TransitionResult {
  const { bars, startBar, rng } = options
  void rng
  const events: TransitionEvent[] = []
  const startBeat = startBar * 4

  // Bar 0 beat 0: silence (1 beat)
  // Bar 0 beat 1: kick + bass stab at full velocity
  events.push({
    type: 'add_note',
    trackHint: 'drum',
    beat: startBeat + 1,
    params: { pitch: 36, velocity: 127, duration: 0.5 },
  })
  events.push({
    type: 'add_note',
    trackHint: 'bass',
    beat: startBeat + 1,
    params: { pitch: 36, velocity: 127, duration: 0.5 },
  })

  // Remove pad/chord clips
  events.push({
    type: 'remove_clip',
    trackHint: 'pad',
    beat: startBeat,
    params: { startBar: String(startBar), endBar: String(startBar + bars) },
  })
  events.push({
    type: 'remove_clip',
    trackHint: 'chord',
    beat: startBeat,
    params: { startBar: String(startBar), endBar: String(startBar + bars) },
  })

  // Add 4-on-floor kick pattern for remaining bars
  for (let bar = 0; bar < bars; bar++) {
    const barStart = startBeat + bar * 4
    for (let beat = 0; beat < 4; beat++) {
      // Skip first beat of first bar (silence)
      if (bar === 0 && beat === 0) continue
      events.push({
        type: 'add_note',
        trackHint: 'drum',
        beat: barStart + beat,
        params: { pitch: 36, velocity: 120, duration: 0.5 },
      })
    }
  }

  return {
    events,
    automationCurves: [],
    description: `${bars}-bar drop with 1-beat silence, full-velocity kick+bass stab, four-on-floor pattern`,
  }
}

/**
 * Build a breakdown transition.
 */
export function buildBreakdown(options: BreakdownOptions): TransitionResult {
  const { bars, startBar, rng } = options
  void rng
  const events: TransitionEvent[] = []
  const startBeat = startBar * 4

  // Remove drums
  events.push({
    type: 'remove_clip',
    trackHint: 'drum',
    beat: startBeat,
    params: { startBar: String(startBar), endBar: String(startBar + bars) },
  })

  // Add reverb hint on melody
  events.push({
    type: 'add_clip',
    trackHint: 'lead',
    beat: startBeat,
    params: { effect: 'reverb', amount: '0.8' },
  })

  // Reduce note density by 75%: set_velocity to 0 on 75% of notes (simplified hint)
  for (let bar = 0; bar < bars; bar++) {
    const barStart = startBeat + bar * 4
    // Keep only notes on main beats (reduce density 75%)
    for (let step = 0; step < 16; step++) {
      if (step % 4 !== 0) {
        events.push({
          type: 'set_velocity',
          trackHint: 'unknown',
          beat: barStart + step * 0.25,
          params: { velocity: 0 },
        })
      }
    }
  }

  return {
    events,
    automationCurves: [],
    description: `${bars}-bar breakdown: remove drums, add reverb on melody, reduce note density by 75%`,
  }
}
