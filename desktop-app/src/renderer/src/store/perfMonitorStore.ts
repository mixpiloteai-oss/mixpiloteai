import { create } from 'zustand'
import { performanceMonitor } from '../audio/perf/PerformanceMonitor'
import { audioLatencyManager } from '../audio/perf/AudioLatencyManager'
import type { PerformanceSnapshot } from '../audio/perf/PerformanceMonitor'
import type { LatencyMode } from '../audio/perf/AudioLatencyManager'

const HISTORY_SIZE = 60

let _unsubSnapshot: (() => void) | null = null

interface PerfMonitorState {
  snapshot:        PerformanceSnapshot | null
  monitoring:      boolean
  latencyMode:     LatencyMode
  historyFps:      number[]
  historyMemoryMb: number[]

  startMonitoring: (audioCtx?: AudioContext) => void
  stopMonitoring:  () => void
  setLatencyMode:  (mode: LatencyMode) => void
  clearHistory:    () => void
}

export const usePerfMonitorStore = create<PerfMonitorState>()((set, get) => ({
  snapshot:        null,
  monitoring:      false,
  latencyMode:     'balanced',
  historyFps:      [],
  historyMemoryMb: [],

  startMonitoring(audioCtx) {
    if (get().monitoring) return
    performanceMonitor.start(audioCtx)
    _unsubSnapshot = performanceMonitor.onSnapshot(snap => {
      set(s => {
        const fps = [...s.historyFps, snap.fps].slice(-HISTORY_SIZE)
        const mem = [...s.historyMemoryMb, snap.memoryMb].slice(-HISTORY_SIZE)
        return { snapshot: snap, historyFps: fps, historyMemoryMb: mem }
      })
    })
    set({ monitoring: true })
  },

  stopMonitoring() {
    performanceMonitor.stop()
    _unsubSnapshot?.()
    _unsubSnapshot = null
    set({ monitoring: false })
  },

  setLatencyMode(mode) {
    audioLatencyManager.applyMode(mode)
    set({ latencyMode: mode })
  },

  clearHistory() {
    set({ historyFps: [], historyMemoryMb: [] })
  },
}))
