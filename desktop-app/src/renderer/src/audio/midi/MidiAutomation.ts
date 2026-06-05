// ─── MIDI Automation ──────────────────────────────────────────────────────────
// Record, playback, and edit MIDI CC automation
//
// Features:
// - Record CC events with high-resolution timing
// - Smooth interpolation between automation points
// - Curve types (linear, exponential, S-curve, step)
// - Multiple lanes per track (CC1, CC74, pitch bend, etc.)
// - Smart point reduction (removes redundant points)

export type CurveType = 'linear' | 'exp' | 'log' | 'scurve' | 'step' | 'hold'

export interface AutomationPoint {
  time:  number       // ticks
  value: number       // 0-1 (normalized)
  curve: CurveType
}

export interface AutomationLane {
  id:        string
  ccNumber:  number       // 0-127, or -1 for pitch-bend
  channel:   number       // 0-15
  name:      string       // e.g. "Mod Wheel"
  points:    AutomationPoint[]
  enabled:   boolean
}

// ─── Curve interpolation ──────────────────────────────────────────────────────

function interpolate(t: number, curve: CurveType): number {
  // t is 0..1
  switch (curve) {
    case 'linear': return t
    case 'exp':    return t * t
    case 'log':    return Math.sqrt(t)
    case 'scurve': return t * t * (3 - 2 * t)  // smoothstep
    case 'step':   return t < 1.0 ? 0 : 1
    case 'hold':   return 0  // value stays at point.value until next
  }
}

// ─── MIDI Automation Engine ───────────────────────────────────────────────────

export class MidiAutomation {
  private lanes: Map<string, AutomationLane> = new Map()
  private recording = false
  private recordingLane: string | null = null

  /**
   * Create a new automation lane.
   */
  createLane(id: string, ccNumber: number, channel: number, name: string): AutomationLane {
    const lane: AutomationLane = {
      id,
      ccNumber,
      channel,
      name,
      points:  [],
      enabled: true,
    }
    this.lanes.set(id, lane)
    return lane
  }

  /**
   * Get lane by ID.
   */
  getLane(id: string): AutomationLane | undefined {
    return this.lanes.get(id)
  }

  /**
   * Get all lanes.
   */
  getLanes(): AutomationLane[] {
    return Array.from(this.lanes.values())
  }

  /**
   * Add a point to a lane. Auto-sorts by time.
   */
  addPoint(laneId: string, point: AutomationPoint): void {
    const lane = this.lanes.get(laneId)
    if (!lane) return

    // Insert in time-sorted position
    let insertIdx = lane.points.findIndex(p => p.time >= point.time)
    if (insertIdx === -1) insertIdx = lane.points.length

    // Replace if exact time match
    if (insertIdx < lane.points.length && lane.points[insertIdx].time === point.time) {
      lane.points[insertIdx] = point
    } else {
      lane.points.splice(insertIdx, 0, point)
    }
  }

  /**
   * Remove a point from a lane.
   */
  removePoint(laneId: string, pointIndex: number): void {
    const lane = this.lanes.get(laneId)
    if (!lane || pointIndex < 0 || pointIndex >= lane.points.length) return
    lane.points.splice(pointIndex, 1)
  }

  /**
   * Get value at a specific time (interpolated).
   * Returns null if lane has no points or is disabled.
   */
  getValueAt(laneId: string, tick: number): number | null {
    const lane = this.lanes.get(laneId)
    if (!lane || !lane.enabled || lane.points.length === 0) return null

    // Before first point
    if (tick <= lane.points[0].time) return lane.points[0].value

    // After last point
    if (tick >= lane.points[lane.points.length - 1].time) {
      return lane.points[lane.points.length - 1].value
    }

    // Find surrounding points
    for (let i = 0; i < lane.points.length - 1; i++) {
      const a = lane.points[i]
      const b = lane.points[i + 1]
      if (tick >= a.time && tick <= b.time) {
        const t = (tick - a.time) / (b.time - a.time)
        const eased = interpolate(t, a.curve)
        return a.value + (b.value - a.value) * eased
      }
    }

    return null
  }

  /**
   * Start recording CC events into a lane.
   */
  startRecording(laneId: string, _currentTick: number): void {
    this.recording = true
    this.recordingLane = laneId
  }

  /**
   * Record a CC event during playback.
   */
  recordCC(currentTick: number, value: number, curve: CurveType = 'linear'): void {
    if (!this.recording || !this.recordingLane) return
    this.addPoint(this.recordingLane, {
      time:  currentTick,
      value: Math.max(0, Math.min(1, value / 127)),
      curve,
    })
  }

  /**
   * Stop recording and optionally simplify the recorded points.
   */
  stopRecording(simplify = true): void {
    this.recording = false
    if (simplify && this.recordingLane) {
      this.simplifyLane(this.recordingLane)
    }
    this.recordingLane = null
  }

  /**
   * Reduce redundant points using Douglas-Peucker-style simplification.
   * Removes points that are within epsilon of the line through their neighbors.
   */
  simplifyLane(laneId: string, epsilon = 0.02): void {
    const lane = this.lanes.get(laneId)
    if (!lane || lane.points.length < 3) return

    const simplified: AutomationPoint[] = [lane.points[0]]

    for (let i = 1; i < lane.points.length - 1; i++) {
      const prev = simplified[simplified.length - 1]
      const curr = lane.points[i]
      const next = lane.points[i + 1]

      // Interpolated value at curr.time if we removed it
      const t = (curr.time - prev.time) / (next.time - prev.time)
      const interpolated = prev.value + (next.value - prev.value) * t
      const error = Math.abs(curr.value - interpolated)

      if (error > epsilon) {
        simplified.push(curr)
      }
    }

    simplified.push(lane.points[lane.points.length - 1])
    lane.points = simplified
  }

  /**
   * Clear all points in a lane.
   */
  clearLane(laneId: string): void {
    const lane = this.lanes.get(laneId)
    if (lane) lane.points = []
  }

  /**
   * Export lanes as JSON.
   */
  serialize(): string {
    return JSON.stringify(Array.from(this.lanes.values()))
  }

  /**
   * Import lanes from JSON.
   */
  deserialize(json: string): void {
    try {
      const lanes = JSON.parse(json) as AutomationLane[]
      this.lanes.clear()
      for (const lane of lanes) {
        this.lanes.set(lane.id, lane)
      }
    } catch (e) {
      console.error('[midi-automation] deserialize failed:', e)
    }
  }
}

export const midiAutomation = new MidiAutomation()
