/**
 * AutomationEngine — parameter automation recording and playback
 *
 * Each AutomationLane targets a specific (track, param) pair and holds
 * a sorted list of AutomationPoints. During playback the engine evaluates
 * each active lane at the current beat and applies the value to the
 * corresponding Web Audio AudioParam.
 *
 * Supported curves: linear, smooth (cosine), step (hold-then-jump), hold.
 */

import type { BeatPosition } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CurveType = 'linear' | 'smooth' | 'step' | 'hold'

export interface AutomationPoint {
  beat:  number   // beats from clip start
  value: number   // normalised 0–1 within the param's range, OR raw units
  curve: CurveType
}

export interface AutomationLaneConfig {
  id:        string
  trackId:   string
  paramName: string          // 'gainDb' | 'pan' | 'send:busId' | custom
  minValue:  number
  maxValue:  number
  defaultValue: number
  enabled:   boolean
  color?:    string
}

export interface AutomationLane extends AutomationLaneConfig {
  points:    AutomationPoint[]
  recording: boolean
}

// Callback the engine calls to apply a value to the actual audio param
export type ParamApplicator = (trackId: string, paramName: string, value: number) => void

// ─── Curve interpolation ──────────────────────────────────────────────────────

function interpolate(a: AutomationPoint, b: AutomationPoint, beat: number): number {
  if (beat <= a.beat) return a.value
  if (beat >= b.beat) return b.value
  const t = (beat - a.beat) / (b.beat - a.beat)

  switch (a.curve) {
    case 'linear': return a.value + (b.value - a.value) * t
    case 'smooth': {
      // Cosine interpolation
      const s = (1 - Math.cos(t * Math.PI)) * 0.5
      return a.value + (b.value - a.value) * s
    }
    case 'step':   return a.value               // hold until next point
    case 'hold':   return a.value               // explicit hold
    default:       return a.value + (b.value - a.value) * t
  }
}

// ─── AutomationEngine ────────────────────────────────────────────────────────

export class AutomationEngine {
  private lanes:        Map<string, AutomationLane>     = new Map()
  private recordBuffer: Map<string, AutomationPoint[]>  = new Map()
  private applicator:   ParamApplicator | null          = null

  /** Wire up the callback that writes values to actual audio params. */
  setApplicator(fn: ParamApplicator): void { this.applicator = fn }

  // ── Lane management ───────────────────────────────────────────────────────

  addLane(cfg: AutomationLaneConfig): AutomationLane {
    const lane: AutomationLane = { ...cfg, points: [], recording: false }
    this.lanes.set(cfg.id, lane)
    return lane
  }

  removeLane(id: string): void { this.lanes.delete(id) }

  getLane(id: string): AutomationLane | undefined { return this.lanes.get(id) }

  getLanesForTrack(trackId: string): AutomationLane[] {
    return [...this.lanes.values()].filter(l => l.trackId === trackId)
  }

  getAllLanes(): AutomationLane[] { return [...this.lanes.values()] }

  // ── Point editing ─────────────────────────────────────────────────────────

  addPoint(laneId: string, point: AutomationPoint): void {
    const lane = this.lanes.get(laneId)
    if (!lane) return
    // Insert sorted by beat, replace if at same beat
    const idx = lane.points.findIndex(p => p.beat >= point.beat)
    if (idx === -1) {
      lane.points.push(point)
    } else if (lane.points[idx].beat === point.beat) {
      lane.points[idx] = point
    } else {
      lane.points.splice(idx, 0, point)
    }
  }

  removePoint(laneId: string, beat: number, tolerance = 0.01): void {
    const lane = this.lanes.get(laneId)
    if (!lane) return
    lane.points = lane.points.filter(p => Math.abs(p.beat - beat) > tolerance)
  }

  clearPoints(laneId: string): void {
    const lane = this.lanes.get(laneId)
    if (lane) lane.points = []
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  /**
   * Evaluate a single lane at the given beat position.
   * Returns the param value (in the lane's min–max range).
   */
  evaluate(laneId: string, beat: number): number {
    const lane = this.lanes.get(laneId)
    if (!lane || lane.points.length === 0) return lane?.defaultValue ?? 0

    const { points } = lane

    // Before first point
    if (beat <= points[0].beat) return points[0].value
    // After last point
    if (beat >= points[points.length - 1].beat) return points[points.length - 1].value

    // Binary search for the segment
    let lo = 0, hi = points.length - 2
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (points[mid + 1].beat <= beat) lo = mid + 1
      else hi = mid
    }
    return interpolate(points[lo], points[lo + 1], beat)
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  /**
   * Called from the rAF/transport loop while playing.
   * Evaluates all enabled lanes and applies values via the applicator.
   */
  process(pos: BeatPosition, timeSigTop: number): void {
    if (!this.applicator) return
    const beat = (pos.bar - 1) * timeSigTop + (pos.beat - 1) + pos.tick / 480

    for (const lane of this.lanes.values()) {
      if (!lane.enabled || lane.points.length === 0) continue
      const value = this.evaluate(lane.id, beat)
      this.applicator(lane.trackId, lane.paramName, value)
    }
  }

  // ── Recording ────────────────────────────────────────────────────────────

  startRecord(laneId: string): void {
    const lane = this.lanes.get(laneId)
    if (!lane) return
    lane.recording = true
    this.recordBuffer.set(laneId, [])
  }

  stopRecord(laneId: string): void {
    const lane = this.lanes.get(laneId)
    if (!lane) return
    lane.recording = false
    const buf = this.recordBuffer.get(laneId) ?? []
    // Merge recorded points into lane (replace range)
    if (buf.length > 0) {
      const startBeat = buf[0].beat
      const endBeat   = buf[buf.length - 1].beat
      lane.points = [
        ...lane.points.filter(p => p.beat < startBeat || p.beat > endBeat),
        ...buf,
      ].sort((a, b) => a.beat - b.beat)
    }
    this.recordBuffer.delete(laneId)
  }

  recordPoint(laneId: string, beat: number, value: number): void {
    const buf = this.recordBuffer.get(laneId)
    if (!buf) return
    buf.push({ beat, value, curve: 'linear' })
  }

  stopAllRecording(): void {
    for (const laneId of [...this.lanes.keys()]) {
      if (this.lanes.get(laneId)?.recording) this.stopRecord(laneId)
    }
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  exportLane(laneId: string): AutomationLane | null {
    const lane = this.lanes.get(laneId)
    return lane ? { ...lane, points: [...lane.points] } : null
  }

  importLane(lane: AutomationLane): void {
    this.lanes.set(lane.id, { ...lane })
  }

  dispose(): void {
    this.lanes.clear()
    this.recordBuffer.clear()
    this.applicator = null
  }
}
