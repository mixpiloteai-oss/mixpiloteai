// ─── AutomationEngine.ts ──────────────────────────────────────────────────────
// Realtime automation engine for MixpilotAI / Neurotek Studio.

import type {
  AutomationCurveType,
  AutomationPoint,
  AutomationTarget,
  AutomationLane,
  AutomationClip,
  AutomationChange,
  RecordedAutomation,
} from './AutomationTypes'
import {
  evaluateLaneAt,
  smoothPoints,
  scaleValues,
  randomizeValues,
  invertValues,
} from './AutomationCurve'
import { SeededRng } from '../ai/SeededRng'

export type AutomationListener = (
  value: number,
  denormalized: number,
  target: AutomationTarget
) => void

export type SerializedAutomationState = {
  version: 1
  lanes: AutomationLane[]
  clips: AutomationClip[]
}

class AutomationEngine {
  private _lanes = new Map<string, AutomationLane>()
  private _clips = new Map<string, AutomationClip>()
  private _listeners = new Map<string, Set<AutomationListener>>()
  private _intervalId: ReturnType<typeof setInterval> | null = null
  private _lastValues = new Map<string, number>()
  private _isRecording = false
  private _recordBuffer: AutomationChange[] = []

  static readonly LANE_COLORS = [
    '#10b981',
    '#3b82f6',
    '#f59e0b',
    '#ec4899',
    '#8b5cf6',
    '#ef4444',
    '#06b6d4',
    '#84cc16',
  ]

  // ── Lane management ──────────────────────────────────────────────────────────

  addLane(target: AutomationTarget): AutomationLane {
    const id = `lane_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const color =
      AutomationEngine.LANE_COLORS[this._lanes.size % AutomationEngine.LANE_COLORS.length] ??
      '#10b981'
    const lane: AutomationLane = {
      id,
      target,
      points: [],
      color,
      visible: true,
      folded: false,
      height: 64,
      enabled: true,
      recordArmed: false,
    }
    this._lanes.set(id, lane)
    return lane
  }

  removeLane(laneId: string): void {
    this._lanes.delete(laneId)
    this._listeners.delete(laneId)
  }

  getLane(laneId: string): AutomationLane | undefined {
    return this._lanes.get(laneId)
  }

  getAllLanes(): AutomationLane[] {
    return Array.from(this._lanes.values())
  }

  getLanesForTrack(trackId: string): AutomationLane[] {
    return Array.from(this._lanes.values()).filter((l) => l.target.trackId === trackId)
  }

  setLaneEnabled(laneId: string, enabled: boolean): void {
    const lane = this._lanes.get(laneId)
    if (lane) lane.enabled = enabled
  }

  setLaneVisible(laneId: string, v: boolean): void {
    const lane = this._lanes.get(laneId)
    if (lane) lane.visible = v
  }

  setLaneFolded(laneId: string, v: boolean): void {
    const lane = this._lanes.get(laneId)
    if (lane) lane.folded = v
  }

  setLaneRecordArmed(laneId: string, v: boolean): void {
    const lane = this._lanes.get(laneId)
    if (lane) lane.recordArmed = v
  }

  // ── Point management ─────────────────────────────────────────────────────────

  addPoint(
    laneId: string,
    beat: number,
    value: number,
    curveType: AutomationCurveType = 'linear'
  ): AutomationPoint | null {
    const lane = this._lanes.get(laneId)
    if (!lane) return null

    // Check for existing point within 0.001 beats
    const existing = lane.points.find((p) => Math.abs(p.beat - beat) < 0.001)
    if (existing) {
      existing.value = value
      return existing
    }

    const id = `pt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const point: AutomationPoint = {
      id,
      beat,
      value,
      curveType,
      inHandle: { dx: -0.2, dy: 0 },
      outHandle: { dx: 0.2, dy: 0 },
    }

    // Insert in sorted order
    const insertIdx = lane.points.findIndex((p) => p.beat > beat)
    if (insertIdx === -1) {
      lane.points.push(point)
    } else {
      lane.points.splice(insertIdx, 0, point)
    }

    return point
  }

  removePoint(laneId: string, pointId: string): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    const idx = lane.points.findIndex((p) => p.id === pointId)
    if (idx !== -1) lane.points.splice(idx, 1)
  }

  movePoint(laneId: string, pointId: string, newBeat: number, newValue: number): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    const point = lane.points.find((p) => p.id === pointId)
    if (!point) return
    point.beat = newBeat
    point.value = Math.max(0, Math.min(1, newValue))
    lane.points.sort((a, b) => a.beat - b.beat)
  }

  updatePointCurve(laneId: string, pointId: string, curveType: AutomationCurveType): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    const point = lane.points.find((p) => p.id === pointId)
    if (point) point.curveType = curveType
  }

  updatePointHandles(
    laneId: string,
    pointId: string,
    inHandle: { dx: number; dy: number },
    outHandle: { dx: number; dy: number }
  ): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    const point = lane.points.find((p) => p.id === pointId)
    if (point) {
      point.inHandle = inHandle
      point.outHandle = outHandle
    }
  }

  clearLane(laneId: string): void {
    const lane = this._lanes.get(laneId)
    if (lane) lane.points = []
  }

  // ── Evaluation ───────────────────────────────────────────────────────────────

  evaluateAt(laneId: string, beat: number): number {
    const lane = this.getLane(laneId)
    if (!lane || !lane.enabled) return 0.5
    return evaluateLaneAt(lane.points, beat)
  }

  evaluateDenormalized(laneId: string, beat: number): number {
    const normalized = this.evaluateAt(laneId, beat)
    const lane = this.getLane(laneId)
    if (!lane) return 0
    const t = lane.target
    return t.minValue + normalized * (t.maxValue - t.minValue)
  }

  // ── Playback ─────────────────────────────────────────────────────────────────

  startPlayback(getBeat: () => number): void {
    this._intervalId = setInterval(() => {
      const beat = getBeat()
      for (const [laneId, lane] of this._lanes) {
        if (!lane.enabled || lane.points.length === 0) continue
        const val = evaluateLaneAt(lane.points, beat)
        const last = this._lastValues.get(laneId) ?? -999
        if (Math.abs(val - last) > 0.0001) {
          this._lastValues.set(laneId, val)
          const denorm = lane.target.minValue + val * (lane.target.maxValue - lane.target.minValue)
          this._listeners.get(laneId)?.forEach((cb) => cb(val, denorm, lane.target))
        }
      }
    }, 16)
  }

  stopPlayback(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId)
      this._intervalId = null
    }
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  onLaneValue(laneId: string, listener: AutomationListener): () => void {
    if (!this._listeners.has(laneId)) {
      this._listeners.set(laneId, new Set())
    }
    this._listeners.get(laneId)!.add(listener)
    return () => {
      this._listeners.get(laneId)?.delete(listener)
    }
  }

  // ── Recording ────────────────────────────────────────────────────────────────

  startRecording(): void {
    this._isRecording = true
    this._recordBuffer = []
  }

  stopRecording(): RecordedAutomation[] {
    this._isRecording = false
    const groups = new Map<string, AutomationChange[]>()
    for (const change of this._recordBuffer) {
      if (!groups.has(change.laneId)) groups.set(change.laneId, [])
      groups.get(change.laneId)!.push(change)
    }
    const result: RecordedAutomation[] = []
    for (const [laneId, changes] of groups) {
      const beats = changes.map((c) => c.beat)
      result.push({
        laneId,
        changes,
        startBeat: Math.min(...beats),
        endBeat: Math.max(...beats),
      })
    }
    return result
  }

  recordValue(laneId: string, beat: number, value: number): void {
    if (this._isRecording) {
      this._recordBuffer.push({ beat, value, laneId, timestamp: Date.now() })
    }
  }

  flushRecording(laneId: string): void {
    const relevant = this._recordBuffer.filter((c) => c.laneId === laneId)
    // Deduplicate: keep only points spaced >= 0.0625 beats
    const deduped: AutomationChange[] = []
    let lastBeat = -Infinity
    for (const change of relevant) {
      if (change.beat - lastBeat >= 0.0625) {
        deduped.push(change)
        lastBeat = change.beat
      }
    }
    for (const change of deduped) {
      this.addPoint(laneId, change.beat, change.value)
    }
  }

  // ── Clips ────────────────────────────────────────────────────────────────────

  createClip(laneId: string, startBeat: number, endBeat: number): AutomationClip {
    const lane = this._lanes.get(laneId)
    const pointsInRange = lane
      ? lane.points
          .filter((p) => p.beat >= startBeat && p.beat <= endBeat)
          .map((p) => ({ ...p, beat: p.beat - startBeat }))
      : []
    const id = `clip_${Date.now()}`
    const clip: AutomationClip = {
      id,
      laneId,
      startBeat,
      endBeat,
      points: pointsInRange,
    }
    this._clips.set(id, clip)
    return clip
  }

  pasteClip(clip: AutomationClip, targetLaneId: string, targetStartBeat: number): void {
    for (const point of clip.points) {
      this.addPoint(targetLaneId, point.beat + targetStartBeat, point.value, point.curveType)
    }
  }

  // ── Range operations ─────────────────────────────────────────────────────────

  scaleRange(laneId: string, startBeat: number, endBeat: number, factor: number): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    const outside = lane.points.filter((p) => p.beat < startBeat || p.beat > endBeat)
    const inside = lane.points.filter((p) => p.beat >= startBeat && p.beat <= endBeat)
    const scaled = scaleValues(inside, factor)
    lane.points = [...outside, ...scaled].sort((a, b) => a.beat - b.beat)
  }

  smoothRange(laneId: string, startBeat: number, endBeat: number, windowBeats: number): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    const smoothed = smoothPoints(lane.points, windowBeats)
    lane.points = lane.points.map((p, i) => {
      if (p.beat >= startBeat && p.beat <= endBeat) {
        return { ...p, value: smoothed[i]!.value }
      }
      return p
    })
  }

  randomizeRange(
    laneId: string,
    startBeat: number,
    endBeat: number,
    amount: number,
    seed: number
  ): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    const rng = new SeededRng(seed)
    const outside = lane.points.filter((p) => p.beat < startBeat || p.beat > endBeat)
    const inside = lane.points.filter((p) => p.beat >= startBeat && p.beat <= endBeat)
    const randomized = randomizeValues(inside, amount, rng)
    lane.points = [...outside, ...randomized].sort((a, b) => a.beat - b.beat)
  }

  invertRange(laneId: string, startBeat: number, endBeat: number): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    const outside = lane.points.filter((p) => p.beat < startBeat || p.beat > endBeat)
    const inside = lane.points.filter((p) => p.beat >= startBeat && p.beat <= endBeat)
    const inverted = invertValues(inside)
    lane.points = [...outside, ...inverted].sort((a, b) => a.beat - b.beat)
  }

  stretchRange(laneId: string, startBeat: number, endBeat: number, factor: number): void {
    const lane = this._lanes.get(laneId)
    if (!lane) return
    lane.points = lane.points
      .map((p) => {
        if (p.beat >= startBeat && p.beat <= endBeat) {
          return { ...p, beat: startBeat + (p.beat - startBeat) * factor }
        }
        return p
      })
      .sort((a, b) => a.beat - b.beat)
  }

  mergeFromLane(sourceLaneId: string, targetLaneId: string): void {
    const source = this._lanes.get(sourceLaneId)
    if (!source) return
    for (const point of source.points) {
      this.addPoint(targetLaneId, point.beat, point.value, point.curveType)
    }
  }

  // ── Lasso selection ──────────────────────────────────────────────────────────

  getPointsInRange(
    laneId: string,
    startBeat: number,
    endBeat: number,
    minValue: number,
    maxValue: number
  ): AutomationPoint[] {
    const lane = this._lanes.get(laneId)
    if (!lane) return []
    return lane.points.filter(
      (p) => p.beat >= startBeat && p.beat <= endBeat && p.value >= minValue && p.value <= maxValue
    )
  }

  // ── AI suggestions ───────────────────────────────────────────────────────────

  suggestAutomation(
    _target: AutomationTarget,
    style: string,
    bars: number,
    _bpm: number,
    seed: number
  ): AutomationPoint[] {
    const rng = new SeededRng(seed)
    const totalBeats = bars * 4

    const makePt = (
      i: number,
      beat: number,
      value: number,
      curveType: AutomationCurveType = 'linear'
    ): AutomationPoint => ({
      id: `sug_${i}`,
      beat,
      value,
      curveType,
      inHandle: { dx: -0.2, dy: 0 },
      outHandle: { dx: 0.2, dy: 0 },
    })

    switch (style) {
      case 'build':
        return [makePt(0, 0, 0, 'linear'), makePt(1, totalBeats, 1, 'linear')]

      case 'drop':
        return [
          makePt(0, 0, 1, 'linear'),
          makePt(1, 0.1, 0, 'linear'),
          makePt(2, totalBeats, 0.6, 'linear'),
        ]

      case 'lfo': {
        const pts: AutomationPoint[] = []
        const step = 0.5
        const count = Math.floor(totalBeats / step)
        for (let i = 0; i <= count; i++) {
          const beat = i * step
          const value = 0.5 + 0.4 * Math.sin((i * Math.PI) / (totalBeats / 2))
          pts.push(makePt(i, beat, value, 'sine'))
        }
        return pts
      }

      case 'sidechain': {
        const pts: AutomationPoint[] = []
        let i = 0
        for (let beat = 0; beat < totalBeats; beat++) {
          pts.push(makePt(i++, beat, 0.85, 'linear'))
          pts.push(makePt(i++, beat + 0.05, 0.1, 'linear'))
          pts.push(makePt(i++, beat + 0.3, 0.85, 'linear'))
        }
        return pts
      }

      case 'random': {
        const pts: AutomationPoint[] = []
        const step = 0.5
        const count = Math.floor(totalBeats / step)
        for (let i = 0; i <= count; i++) {
          pts.push(makePt(i, i * step, rng.next(), 'linear'))
        }
        return pts
      }

      default:
        return [makePt(0, 0, 0.5, 'linear')]
    }
  }

  // ── Serialization ────────────────────────────────────────────────────────────

  serializeAll(): SerializedAutomationState {
    return {
      version: 1,
      lanes: Array.from(this._lanes.values()),
      clips: Array.from(this._clips.values()),
    }
  }

  deserializeAll(data: SerializedAutomationState): void {
    this._lanes.clear()
    this._clips.clear()
    for (const lane of data.lanes) {
      this._lanes.set(lane.id, lane)
    }
    for (const clip of data.clips) {
      this._clips.set(clip.id, clip)
    }
  }
}

export { AutomationEngine }
export const automationEngine = new AutomationEngine()
