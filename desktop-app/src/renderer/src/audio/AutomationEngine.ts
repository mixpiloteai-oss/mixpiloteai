/**
 * AutomationEngine — parameter automation recording and playback
 *
 * Each AutomationLane targets a specific (track, param) pair and holds
 * a sorted list of AutomationPoints. During playback the engine evaluates
 * each active lane at the current beat and applies the value to the
 * corresponding Web Audio AudioParam.
 *
 * Supported curves: linear, smooth (cosine), step (hold-then-jump), hold, bezier (cubic).
 * Automation modes: read, write, touch, latch.
 */

import type { BeatPosition } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CurveType = 'linear' | 'smooth' | 'step' | 'hold' | 'bezier'
export type AutomationMode = 'read' | 'write' | 'touch' | 'latch'

export interface BezierHandle {
  dx: number  // offset in beats from the point
  dy: number  // offset in value units
}

export interface AutomationPoint {
  beat:       number     // beats from project start
  value:      number     // raw value in the lane's min–max range
  curve:      CurveType
  inHandle?:  BezierHandle  // control handle arriving at this point
  outHandle?: BezierHandle  // control handle leaving this point
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
  mode:      AutomationMode
}

// Callback the engine calls to apply a value to the actual audio param
export type ParamApplicator = (trackId: string, paramName: string, value: number) => void

// ─── Bezier cubic helpers ─────────────────────────────────────────────────────

function cubicBez(x0: number, x1: number, x2: number, x3: number, t: number): number {
  const mt = 1 - t
  return mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3
}

/**
 * Evaluate cubic bezier in (beat, value) space at a given beat.
 * Finds t via bisection (16 iterations ≈ 0.001% error).
 */
function evalBezier(
  pa: AutomationPoint,
  pb: AutomationPoint,
  beat: number
): number {
  const span = pb.beat - pa.beat
  if (span <= 0) return pa.value

  // Control points in beat-space (x) and value-space (y)
  const c0x = pa.beat  + (pa.outHandle?.dx ?? span * 0.333)
  const c0y = pa.value + (pa.outHandle?.dy ?? 0)
  const c1x = pb.beat  + (pb.inHandle?.dx  ?? -span * 0.333)
  const c1y = pb.value + (pb.inHandle?.dy  ?? 0)

  // Bisect to find t such that bezier_x(t) == beat
  let lo = 0, hi = 1
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5
    const x = cubicBez(pa.beat, c0x, c1x, pb.beat, mid)
    if (x < beat) lo = mid
    else hi = mid
  }
  return cubicBez(pa.value, c0y, c1y, pb.value, (lo + hi) * 0.5)
}

// ─── Curve interpolation ──────────────────────────────────────────────────────

function interpolate(a: AutomationPoint, b: AutomationPoint, beat: number): number {
  if (beat <= a.beat) return a.value
  if (beat >= b.beat) return b.value
  const t = (beat - a.beat) / (b.beat - a.beat)

  switch (a.curve) {
    case 'linear': return a.value + (b.value - a.value) * t
    case 'smooth': {
      const s = (1 - Math.cos(t * Math.PI)) * 0.5
      return a.value + (b.value - a.value) * s
    }
    case 'step':   return a.value
    case 'hold':   return a.value
    case 'bezier': return evalBezier(a, b, beat)
    default:       return a.value + (b.value - a.value) * t
  }
}

// ─── AutomationEngine ────────────────────────────────────────────────────────

export class AutomationEngine {
  private lanes:        Map<string, AutomationLane>     = new Map()
  private recordBuffer: Map<string, AutomationPoint[]>  = new Map()
  private applicator:   ParamApplicator | null          = null
  // Touch/Latch mode: tracks whether the user is currently holding a value
  private touchActive:  Map<string, boolean>            = new Map()

  /** Wire up the callback that writes values to actual audio params. */
  setApplicator(fn: ParamApplicator): void { this.applicator = fn }

  // ── Lane management ───────────────────────────────────────────────────────

  addLane(cfg: AutomationLaneConfig): AutomationLane {
    const lane: AutomationLane = { ...cfg, points: [], recording: false, mode: 'read' }
    this.lanes.set(cfg.id, lane)
    return lane
  }

  removeLane(id: string): void { this.lanes.delete(id) }

  getLane(id: string): AutomationLane | undefined { return this.lanes.get(id) }

  getLanesForTrack(trackId: string): AutomationLane[] {
    return [...this.lanes.values()].filter(l => l.trackId === trackId)
  }

  /** Look up a lane by (trackId, paramName) and evaluate at the given beat. */
  getValueAtBeat(trackId: string, paramName: string, beat: number): number {
    const lane = [...this.lanes.values()].find(l => l.trackId === trackId && l.paramName === paramName)
    return lane ? this.evaluate(lane.id, beat) : 0
  }

  getAllLanes(): AutomationLane[] { return [...this.lanes.values()] }

  setLaneMode(laneId: string, mode: AutomationMode): void {
    const lane = this.lanes.get(laneId)
    if (lane) lane.mode = mode
  }

  // ── Point editing ─────────────────────────────────────────────────────────

  addPoint(laneId: string, point: AutomationPoint): void {
    const lane = this.lanes.get(laneId)
    if (!lane) return
    const idx = lane.points.findIndex(p => p.beat >= point.beat)
    if (idx === -1) {
      lane.points.push(point)
    } else if (Math.abs(lane.points[idx].beat - point.beat) < 0.01) {
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

  movePoint(laneId: string, oldBeat: number, newBeat: number, newValue: number, tolerance = 0.05): void {
    const lane = this.lanes.get(laneId)
    if (!lane) return
    const idx = lane.points.findIndex(p => Math.abs(p.beat - oldBeat) <= tolerance)
    if (idx === -1) return
    const point = { ...lane.points[idx], beat: newBeat, value: newValue }
    lane.points.splice(idx, 1)
    const insertIdx = lane.points.findIndex(p => p.beat >= newBeat)
    if (insertIdx === -1) lane.points.push(point)
    else lane.points.splice(insertIdx, 0, point)
  }

  setCurveType(laneId: string, beat: number, curve: CurveType, tolerance = 0.05): void {
    const lane = this.lanes.get(laneId)
    if (!lane) return
    const point = lane.points.find(p => Math.abs(p.beat - beat) <= tolerance)
    if (point) point.curve = curve
  }

  clearPoints(laneId: string): void {
    const lane = this.lanes.get(laneId)
    if (lane) lane.points = []
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  evaluate(laneId: string, beat: number): number {
    const lane = this.lanes.get(laneId)
    if (!lane || lane.points.length === 0) return lane?.defaultValue ?? 0

    const { points } = lane

    if (beat <= points[0].beat) return points[0].value
    if (beat >= points[points.length - 1].beat) return points[points.length - 1].value

    let lo = 0, hi = points.length - 2
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (points[mid + 1].beat <= beat) lo = mid + 1
      else hi = mid
    }
    return interpolate(points[lo], points[lo + 1], beat)
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  process(pos: BeatPosition, timeSigTop: number): void {
    if (!this.applicator) return
    const beat = (pos.bar - 1) * timeSigTop + (pos.beat - 1) + pos.tick / 480

    for (const lane of this.lanes.values()) {
      if (!lane.enabled || lane.points.length === 0) continue
      // Write/Touch/Latch modes only apply during recording — read mode always reads back
      if (lane.mode !== 'read' && !lane.recording) continue
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
    if (buf.length > 0) {
      const startBeat = buf[0].beat
      const endBeat   = buf[buf.length - 1].beat
      lane.points = [
        ...lane.points.filter(p => p.beat < startBeat || p.beat > endBeat),
        ...buf,
      ].sort((a, b) => a.beat - b.beat)
    }
    this.recordBuffer.delete(laneId)
    this.touchActive.delete(laneId)
  }

  recordPoint(laneId: string, beat: number, value: number): void {
    const buf = this.recordBuffer.get(laneId)
    if (!buf) return
    buf.push({ beat, value, curve: 'linear' })
  }

  /** Touch mode: mark as held (write while held, hold on release) */
  setTouchHeld(laneId: string, held: boolean): void {
    this.touchActive.set(laneId, held)
  }

  isTouchHeld(laneId: string): boolean {
    return this.touchActive.get(laneId) ?? false
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
    this.touchActive.clear()
    this.applicator = null
  }
}
