// ─── AutomationTypes.ts ───────────────────────────────────────────────────────
// Shared types for the new automation system (Ableton/Bitwig-style).
// NOTE: AutomationGenerator.ts already defines AutomationPoint and AutomationCurve
// with different semantics. These types use the prefix Automation* to remain distinct.

export type AutomationCurveType =
  | 'linear'
  | 'step'
  | 'exponential'
  | 'logarithmic'
  | 'sine'
  | 'bezier'

export interface AutomationPoint {
  id: string
  beat: number            // position in beats
  value: number           // normalized 0-1
  curveType: AutomationCurveType
  // Bezier handles (relative to this point, in beats and normalized value units):
  inHandle: { dx: number; dy: number }    // left handle — ignored for first point
  outHandle: { dx: number; dy: number }   // right handle — ignored for last point
}

export type AutomationTargetType =
  | 'track-volume'
  | 'track-pan'
  | 'track-send'
  | 'vst-param'
  | 'bpm'
  | 'macro'
  | 'fx-param'

export interface AutomationTarget {
  type: AutomationTargetType
  trackId?: string
  instanceId?: string     // VST instance
  paramIndex?: number     // VST parameter index
  sendIndex?: number      // send bus index
  macroId?: string
  paramName: string       // display name
  minValue: number        // real-world min
  maxValue: number        // real-world max
  defaultValue: number    // normalized default (0-1)
  unit?: string           // e.g., 'dB', '%', 'Hz'
}

export interface AutomationLane {
  id: string
  target: AutomationTarget
  points: AutomationPoint[]
  color: string            // hex color
  visible: boolean
  folded: boolean
  height: number           // px, default 64, min 32, max 256
  enabled: boolean         // if false, automation is bypassed
  recordArmed: boolean
}

export interface AutomationClip {
  id: string
  laneId: string
  startBeat: number
  endBeat: number
  points: AutomationPoint[]   // relative beats within clip (0 = clip start)
  loopLength?: number          // if set, clip loops with this period
}

export interface AutomationChange {
  pointId?: string       // if modifying existing point
  beat: number
  value: number
  laneId: string
  timestamp: number      // Date.now() — for recording
}

export interface RecordedAutomation {
  laneId: string
  changes: AutomationChange[]
  startBeat: number
  endBeat: number
}
