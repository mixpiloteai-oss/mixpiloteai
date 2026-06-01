// ─── automationStore.ts ───────────────────────────────────────────────────────
// Zustand store for automation lane state, synced with AutomationEngine.

import { create } from 'zustand'
import type { AutomationCurveType, AutomationLane, AutomationPoint, AutomationTarget } from '../audio/automation/AutomationTypes'
import { automationEngine } from '../audio/automation/AutomationEngine'
import { automationRecorder } from '../audio/automation/AutomationRecorder'
import { shiftPoints } from '../audio/automation/AutomationCurve'

interface AutomationState {
  lanes: AutomationLane[]
  selectedLaneId: string | null
  selectedPointIds: string[]
  editMode: 'draw' | 'select' | 'erase'
  snapEnabled: boolean
  snapBeats: number
  zoom: number
  scrollBeat: number
  isRecording: boolean
  clipboard: AutomationPoint[] | null

  syncFromEngine(): void
  addLane(target: AutomationTarget): string
  removeLane(laneId: string): void
  selectLane(id: string | null): void

  addPoint(laneId: string, beat: number, value: number, curveType?: AutomationCurveType): void
  removePoint(laneId: string, pointId: string): void
  movePoint(laneId: string, pointId: string, beat: number, value: number): void
  updateCurve(laneId: string, pointId: string, curveType: AutomationCurveType): void
  setLaneEnabled(laneId: string, enabled: boolean): void
  setLaneVisible(laneId: string, v: boolean): void
  setLaneFolded(laneId: string, v: boolean): void
  setLaneRecordArmed(laneId: string, v: boolean): void
  clearLane(laneId: string): void

  scaleRange(laneId: string, startBeat: number, endBeat: number, factor: number): void
  smoothRange(laneId: string, startBeat: number, endBeat: number, windowBeats: number): void
  randomizeRange(laneId: string, startBeat: number, endBeat: number, amount: number): void
  invertRange(laneId: string, startBeat: number, endBeat: number): void
  stretchRange(laneId: string, startBeat: number, endBeat: number, factor: number): void

  suggestAutomation(laneId: string, style: string, bars: number, bpm?: number): void

  copyPoints(pointIds: string[], laneId: string): void
  pastePoints(targetLaneId: string, beatOffset: number): void

  startRecording(): void
  stopRecording(): void

  setEditMode(mode: 'draw' | 'select' | 'erase'): void
  setSnapEnabled(v: boolean): void
  setSnapBeats(v: number): void
  setZoom(v: number): void
  setScrollBeat(v: number): void
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  lanes: [],
  selectedLaneId: null,
  selectedPointIds: [],
  editMode: 'draw',
  snapEnabled: true,
  snapBeats: 0.25,
  zoom: 80,
  scrollBeat: 0,
  isRecording: false,
  clipboard: null,

  syncFromEngine(): void {
    set({ lanes: automationEngine.getAllLanes() })
  },

  addLane(target: AutomationTarget): string {
    const lane = automationEngine.addLane(target)
    get().syncFromEngine()
    return lane.id
  },

  removeLane(laneId: string): void {
    automationEngine.removeLane(laneId)
    get().syncFromEngine()
  },

  selectLane(id: string | null): void {
    set({ selectedLaneId: id })
  },

  addPoint(laneId: string, beat: number, value: number, curveType?: AutomationCurveType): void {
    automationEngine.addPoint(laneId, beat, value, curveType)
    get().syncFromEngine()
  },

  removePoint(laneId: string, pointId: string): void {
    automationEngine.removePoint(laneId, pointId)
    get().syncFromEngine()
  },

  movePoint(laneId: string, pointId: string, beat: number, value: number): void {
    automationEngine.movePoint(laneId, pointId, beat, value)
    get().syncFromEngine()
  },

  updateCurve(laneId: string, pointId: string, curveType: AutomationCurveType): void {
    automationEngine.updatePointCurve(laneId, pointId, curveType)
    get().syncFromEngine()
  },

  setLaneEnabled(laneId: string, enabled: boolean): void {
    automationEngine.setLaneEnabled(laneId, enabled)
    get().syncFromEngine()
  },

  setLaneVisible(laneId: string, v: boolean): void {
    automationEngine.setLaneVisible(laneId, v)
    get().syncFromEngine()
  },

  setLaneFolded(laneId: string, v: boolean): void {
    automationEngine.setLaneFolded(laneId, v)
    get().syncFromEngine()
  },

  setLaneRecordArmed(laneId: string, v: boolean): void {
    automationEngine.setLaneRecordArmed(laneId, v)
    get().syncFromEngine()
  },

  clearLane(laneId: string): void {
    automationEngine.clearLane(laneId)
    get().syncFromEngine()
  },

  scaleRange(laneId: string, startBeat: number, endBeat: number, factor: number): void {
    automationEngine.scaleRange(laneId, startBeat, endBeat, factor)
    get().syncFromEngine()
  },

  smoothRange(laneId: string, startBeat: number, endBeat: number, windowBeats: number): void {
    automationEngine.smoothRange(laneId, startBeat, endBeat, windowBeats)
    get().syncFromEngine()
  },

  randomizeRange(laneId: string, startBeat: number, endBeat: number, amount: number): void {
    automationEngine.randomizeRange(laneId, startBeat, endBeat, amount, Date.now())
    get().syncFromEngine()
  },

  invertRange(laneId: string, startBeat: number, endBeat: number): void {
    automationEngine.invertRange(laneId, startBeat, endBeat)
    get().syncFromEngine()
  },

  stretchRange(laneId: string, startBeat: number, endBeat: number, factor: number): void {
    automationEngine.stretchRange(laneId, startBeat, endBeat, factor)
    get().syncFromEngine()
  },

  suggestAutomation(laneId: string, style: string, bars: number, bpm?: number): void {
    const bpm_ = bpm ?? 120
    const lane = automationEngine.getLane(laneId)
    if (!lane) return
    const pts = automationEngine.suggestAutomation(lane.target, style, bars, bpm_, Date.now())
    for (const p of pts) {
      automationEngine.addPoint(laneId, p.beat, p.value, p.curveType)
    }
    get().syncFromEngine()
  },

  copyPoints(pointIds: string[], laneId: string): void {
    const lane = automationEngine.getLane(laneId)
    if (!lane) return
    const pts = lane.points.filter((p) => pointIds.includes(p.id))
    set({ clipboard: pts })
  },

  pastePoints(targetLaneId: string, beatOffset: number): void {
    const { clipboard } = get()
    if (!clipboard) return
    const shifted = shiftPoints(clipboard, beatOffset)
    for (const p of shifted) {
      automationEngine.addPoint(targetLaneId, p.beat, p.value, p.curveType)
    }
    get().syncFromEngine()
  },

  startRecording(): void {
    automationRecorder.start(0)
    set({ isRecording: true })
  },

  stopRecording(): void {
    const data = automationRecorder.stop()
    for (const [laneId, changes] of data) {
      automationRecorder.mergeIntoLane(laneId, changes, automationEngine)
    }
    set({ isRecording: false })
    get().syncFromEngine()
  },

  setEditMode(mode: 'draw' | 'select' | 'erase'): void {
    set({ editMode: mode })
  },

  setSnapEnabled(v: boolean): void {
    set({ snapEnabled: v })
  },

  setSnapBeats(v: number): void {
    set({ snapBeats: v })
  },

  setZoom(v: number): void {
    set({ zoom: v })
  },

  setScrollBeat(v: number): void {
    set({ scrollBeat: v })
  },
}))
