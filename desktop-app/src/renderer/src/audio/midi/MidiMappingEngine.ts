import { getMidiLearnManager } from './MidiLearnManager'
import { getMidiDeviceManager } from './MidiDeviceManager'
import type { MidiAssignment }  from './MidiLearnManager'

// ─── Config types ─────────────────────────────────────────────────────────────

export interface MappingConfig {
  id:          string
  name:        string
  assignments: MidiAssignment[]
  createdAt:   number
}

// ─── MidiMappingEngine ────────────────────────────────────────────────────────

export class MidiMappingEngine {
  private learnMgr     = getMidiLearnManager()
  private deviceMgr    = getMidiDeviceManager()
  private activeConfig: MappingConfig | null = null
  private configs:      MappingConfig[]      = []
  private unsubDevice:  (() => void) | null  = null

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  init(): void {
    if (this.unsubDevice) return

    this.unsubDevice = this.deviceMgr.onMessage((_deviceId, data) => {
      this.learnMgr.processMessage(data)
    })
  }

  destroy(): void {
    this.unsubDevice?.()
    this.unsubDevice = null
  }

  // ── MIDI Learn ───────────────────────────────────────────────────────────────

  /**
   * Arm a parameter for MIDI learn.
   * `onValue` is stored as the parameter's value callback — it receives
   * normalized 0-1 values during normal playback after the assignment is made.
   * Use `learnMgr.onLearnComplete` to react to the capture event itself.
   */
  armParam(
    id:      string,
    label:   string,
    onValue: (v: number) => void,
  ): void {
    this.learnMgr.arm({ id, label, onValue })
  }

  disarm(): void {
    this.learnMgr.disarm()
  }

  isArmed(): boolean {
    return this.learnMgr.isArmed()
  }

  // ── Direct assignment ─────────────────────────────────────────────────────────

  /**
   * Directly assign a CC to a parameter without going through learn mode.
   * `onValue` receives a 0-1 normalized value on each CC message.
   */
  assignCC(
    targetId: string,
    cc:       number,
    channel:  number,
    onValue:  (v: number) => void,
  ): void {
    const assignment: MidiAssignment = {
      targetId,
      cc,
      channel,
      minIn:      0,
      maxIn:      127,
      minOut:     0,
      maxOut:     1,
      pickupMode: false,
    }
    this.learnMgr.directAssign(assignment, onValue)
  }

  removeAssignment(targetId: string): void {
    this.learnMgr.removeAssignment(targetId)
  }

  getAllAssignments(): MidiAssignment[] {
    return this.learnMgr.getAllAssignments()
  }

  // ── Config management ─────────────────────────────────────────────────────────

  saveConfig(name: string): MappingConfig {
    const config: MappingConfig = {
      id:          `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      assignments: this.learnMgr.getAllAssignments(),
      createdAt:   Date.now(),
    }
    this.configs.push(config)
    this.activeConfig = config
    return config
  }

  loadConfig(config: MappingConfig): void {
    for (const a of this.learnMgr.getAllAssignments()) {
      this.learnMgr.removeAssignment(a.targetId)
    }
    this.learnMgr.importAssignments(JSON.stringify(config.assignments))
    this.activeConfig = config
  }

  deleteConfig(id: string): void {
    this.configs = this.configs.filter(c => c.id !== id)
    if (this.activeConfig?.id === id) {
      this.activeConfig = null
    }
  }

  getConfigs(): MappingConfig[] {
    return [...this.configs]
  }

  // ── Value normalization ───────────────────────────────────────────────────────

  normalize(raw: number, assignment: MidiAssignment): number {
    const inRange  = assignment.maxIn - assignment.minIn || 1
    const outRange = assignment.maxOut - assignment.minOut
    const clamped  = Math.max(assignment.minIn, Math.min(assignment.maxIn, raw))
    return assignment.minOut + ((clamped - assignment.minIn) / inRange) * outRange
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: MidiMappingEngine | null = null

export function getMidiMappingEngine(): MidiMappingEngine {
  if (!_instance) _instance = new MidiMappingEngine()
  return _instance
}
