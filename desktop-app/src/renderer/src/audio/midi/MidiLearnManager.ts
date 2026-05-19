// ─── Types ────────────────────────────────────────────────────────────────────

export interface LearnTarget {
  id:      string              // unique param ID e.g. "track-tk-kick-volume"
  label:   string              // display name
  onValue: (v: number) => void // callback when CC received, value 0-1 normalized
}

export interface MidiAssignment {
  targetId:   string
  cc:         number
  channel:    number    // -1 = any channel
  minIn:      number    // raw MIDI range (0-127 usually)
  maxIn:      number
  minOut:     number    // output normalized range
  maxOut:     number
  pickupMode: boolean   // prevent value jump on first touch
}

// ─── Internal key helper ──────────────────────────────────────────────────────

/** Build a lookup key from cc + channel. Channel -1 acts as wildcard. */
function assignmentKey(ccNum: number, channel: number): string {
  return `${ccNum}:${channel}`
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isMidiAssignment(item: unknown): item is MidiAssignment {
  if (typeof item !== 'object' || item === null) return false
  const obj = item as Record<string, unknown>
  return (
    typeof obj['targetId'] === 'string' &&
    typeof obj['cc']       === 'number' &&
    typeof obj['channel']  === 'number'
  )
}

// ─── MidiLearnManager ─────────────────────────────────────────────────────────

export class MidiLearnManager {
  private armed:       LearnTarget | null          = null
  private assignments: Map<string, MidiAssignment> = new Map() // targetId → assignment
  private ccIndex:     Map<string, MidiAssignment> = new Map() // "cc:ch" → assignment
  private lastValues:  Map<string, number>         = new Map() // targetId → last normalized value

  // Callbacks — components or engines can attach these
  onLearnComplete: ((assignment: MidiAssignment) => void) | null = null
  onLearnArmed:    ((target: LearnTarget) => void) | null        = null

  // ── Arm / disarm ─────────────────────────────────────────────────────────────

  arm(target: LearnTarget): void {
    this.armed = target
    this.onLearnArmed?.(target)
  }

  disarm(): void {
    this.armed = null
  }

  isArmed(): boolean {
    return this.armed !== null
  }

  getArmedTarget(): LearnTarget | null {
    return this.armed
  }

  // ── Message processing ────────────────────────────────────────────────────────

  processMessage(data: Uint8Array): void {
    if (data.length < 3) return

    const statusByte = data[0]
    const byte1      = data[1]
    const byte2      = data[2]

    if (statusByte === undefined || byte1 === undefined || byte2 === undefined) return

    // Status nibbles: 0xB = CC (status bytes 0xB0-0xBF)
    const statusNibble = (statusByte & 0xF0) >> 4
    const channel      = statusByte & 0x0F

    if (statusNibble !== 0xB) return // not a CC message

    const ccNum = byte1 & 0x7F
    const value = byte2 & 0x7F

    // ── Learn mode: arm → assign ────────────────────────────────────────────────
    if (this.armed !== null) {
      const target = this.armed
      this.disarm()

      const assignment: MidiAssignment = {
        targetId:   target.id,
        cc:         ccNum,
        channel,
        minIn:      0,
        maxIn:      127,
        minOut:     0,
        maxOut:     1,
        pickupMode: false,
      }

      this._storeAssignment(assignment, target.onValue)
      this.onLearnComplete?.(assignment)
      return
    }

    // ── Normal mode: route CC to registered targets ──────────────────────────────

    const exactKey    = assignmentKey(ccNum, channel)
    const wildcardKey = assignmentKey(ccNum, -1)

    const assignment = this.ccIndex.get(exactKey) ?? this.ccIndex.get(wildcardKey)
    if (!assignment) return

    const { targetId, minIn, maxIn, minOut, maxOut, pickupMode } = assignment

    const callback = this._callbacks.get(targetId)
    if (!callback) return

    // Pickup mode: skip until hardware crosses the last known param position
    if (pickupMode) {
      const lastNorm = this.lastValues.get(targetId)
      if (lastNorm !== undefined) {
        const inRange  = maxIn - minIn || 1
        const outRange = maxOut - minOut || 1
        const rawLast  = ((lastNorm - minOut) / outRange) * inRange + minIn
        const absDiff  = Math.abs(value - rawLast)
        // Skip if more than 4 raw steps away from last recorded position
        if (absDiff > 4) return
      }
    }

    const normalized = this._normalize(value, minIn, maxIn, minOut, maxOut)
    this.lastValues.set(targetId, normalized)
    callback(normalized)
  }

  // ── Assignment management ─────────────────────────────────────────────────────

  removeAssignment(targetId: string): void {
    const assignment = this.assignments.get(targetId)
    if (!assignment) return

    const exactKey    = assignmentKey(assignment.cc, assignment.channel)
    const wildcardKey = assignmentKey(assignment.cc, -1)

    if (this.ccIndex.get(exactKey)?.targetId === targetId) {
      this.ccIndex.delete(exactKey)
    }
    if (this.ccIndex.get(wildcardKey)?.targetId === targetId) {
      this.ccIndex.delete(wildcardKey)
    }

    this.assignments.delete(targetId)
    this.lastValues.delete(targetId)
    this._callbacks.delete(targetId)
  }

  getAssignment(targetId: string): MidiAssignment | undefined {
    return this.assignments.get(targetId)
  }

  getAllAssignments(): MidiAssignment[] {
    return [...this.assignments.values()]
  }

  setAssignmentRange(targetId: string, minOut: number, maxOut: number): void {
    const a = this.assignments.get(targetId)
    if (!a) return
    const updated: MidiAssignment = { ...a, minOut, maxOut }
    this.assignments.set(targetId, updated)
    const key = assignmentKey(a.cc, a.channel)
    this.ccIndex.set(key, updated)
  }

  setPickupMode(targetId: string, enabled: boolean): void {
    const a = this.assignments.get(targetId)
    if (!a) return
    const updated: MidiAssignment = { ...a, pickupMode: enabled }
    this.assignments.set(targetId, updated)
    const key = assignmentKey(a.cc, a.channel)
    this.ccIndex.set(key, updated)
  }

  // ── Import / export ───────────────────────────────────────────────────────────

  exportAssignments(): string {
    return JSON.stringify(this.getAllAssignments(), null, 2)
  }

  /**
   * Parse a JSON string of assignments, store them internally, and return
   * the valid assignment objects so callers can sync them to a store.
   */
  importAssignments(json: string): MidiAssignment[] {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      return []
    }

    if (!Array.isArray(parsed)) return []

    const valid: MidiAssignment[] = []

    for (const item of parsed) {
      if (isMidiAssignment(item)) {
        this.assignments.set(item.targetId, item)
        const key = assignmentKey(item.cc, item.channel)
        this.ccIndex.set(key, item)
        // Callbacks are reconnected by the engine after import
        valid.push(item)
      }
    }

    return valid
  }

  // ── Direct assignment (used by MidiMappingEngine) ─────────────────────────────

  directAssign(assignment: MidiAssignment, callback: (v: number) => void): void {
    this._storeAssignment(assignment, callback)
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private _callbacks: Map<string, (v: number) => void> = new Map()

  private _storeAssignment(
    assignment: MidiAssignment,
    callback: (v: number) => void,
  ): void {
    this.removeAssignment(assignment.targetId)
    this.assignments.set(assignment.targetId, assignment)
    this._callbacks.set(assignment.targetId, callback)
    const key = assignmentKey(assignment.cc, assignment.channel)
    this.ccIndex.set(key, assignment)
  }

  private _normalize(
    raw:    number,
    minIn:  number,
    maxIn:  number,
    minOut: number,
    maxOut: number,
  ): number {
    const inRange  = maxIn - minIn   || 1
    const outRange = maxOut - minOut
    const clamped  = Math.max(minIn, Math.min(maxIn, raw))
    return minOut + ((clamped - minIn) / inRange) * outRange
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: MidiLearnManager | null = null

export function getMidiLearnManager(): MidiLearnManager {
  if (!_instance) _instance = new MidiLearnManager()
  return _instance
}
