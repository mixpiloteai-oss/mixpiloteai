import { create } from 'zustand'
import type { AutomationLane, AutomationPoint, AutomationMode, CurveType } from '../../audio/AutomationEngine'

type LaneConfig = Omit<AutomationLane, 'points' | 'recording' | 'mode'>

interface AutomationStoreState {
  lanes: AutomationLane[]
}

interface AutomationStoreActions {
  addLane(cfg: LaneConfig): AutomationLane
  removeLane(id: string): void
  addPoint(laneId: string, point: AutomationPoint): void
  removePoint(laneId: string, beat: number): void
  movePoint(laneId: string, oldBeat: number, newBeat: number, newValue: number): void
  setLaneMode(laneId: string, mode: AutomationMode): void
  toggleLaneEnabled(laneId: string): void
  setCurveType(laneId: string, beat: number, curve: CurveType): void
  getLanesForTrack(trackId: string): AutomationLane[]
}

// Demo automation: volume envelope on the kick track
const seedLanes: AutomationLane[] = [
  {
    id: 'auto-kick-vol',
    trackId: 'tk-kick',
    paramName: 'gainDb',
    minValue: -60,
    maxValue: 12,
    defaultValue: 0,
    enabled: true,
    color: '#7c3aed',
    points: [
      { beat: 0,  value: 0,   curve: 'bezier', outHandle: { dx: 4, dy: 0 } },
      { beat: 16, value: -8,  curve: 'bezier', inHandle: { dx: -4, dy: 0 }, outHandle: { dx: 4, dy: 4 } },
      { beat: 32, value: 0,   curve: 'bezier', inHandle: { dx: -4, dy: 0 } },
    ],
    recording: false,
    mode: 'read',
  },
]

function insertSorted(points: AutomationPoint[], point: AutomationPoint): AutomationPoint[] {
  const next = [...points]
  const idx = next.findIndex(p => p.beat >= point.beat)
  if (idx === -1) {
    next.push(point)
  } else if (Math.abs(next[idx].beat - point.beat) < 0.01) {
    next[idx] = point
  } else {
    next.splice(idx, 0, point)
  }
  return next
}

export const useAutomationStore = create<AutomationStoreState & AutomationStoreActions>((set, get) => ({
  lanes: seedLanes,

  addLane: (cfg) => {
    const lane: AutomationLane = { ...cfg, points: [], recording: false, mode: 'read' }
    set(s => ({ lanes: [...s.lanes, lane] }))
    return lane
  },

  removeLane: (id) => set(s => ({ lanes: s.lanes.filter(l => l.id !== id) })),

  addPoint: (laneId, point) => set(s => ({
    lanes: s.lanes.map(l =>
      l.id !== laneId ? l : { ...l, points: insertSorted(l.points, point) }
    ),
  })),

  removePoint: (laneId, beat) => set(s => ({
    lanes: s.lanes.map(l =>
      l.id !== laneId ? l
        : { ...l, points: l.points.filter(p => Math.abs(p.beat - beat) > 0.05) }
    ),
  })),

  movePoint: (laneId, oldBeat, newBeat, newValue) => set(s => ({
    lanes: s.lanes.map(l => {
      if (l.id !== laneId) return l
      const original = l.points.find(p => Math.abs(p.beat - oldBeat) <= 0.05)
      if (!original) return l
      const filtered = l.points.filter(p => Math.abs(p.beat - oldBeat) > 0.05)
      const moved = { ...original, beat: newBeat, value: newValue }
      return { ...l, points: insertSorted(filtered, moved) }
    }),
  })),

  setLaneMode: (laneId, mode) => set(s => ({
    lanes: s.lanes.map(l => l.id !== laneId ? l : { ...l, mode }),
  })),

  toggleLaneEnabled: (laneId) => set(s => ({
    lanes: s.lanes.map(l => l.id !== laneId ? l : { ...l, enabled: !l.enabled }),
  })),

  setCurveType: (laneId, beat, curve) => set(s => ({
    lanes: s.lanes.map(l => {
      if (l.id !== laneId) return l
      return { ...l, points: l.points.map(p => Math.abs(p.beat - beat) <= 0.05 ? { ...p, curve } : p) }
    }),
  })),

  getLanesForTrack: (trackId) => get().lanes.filter(l => l.trackId === trackId),
}))
