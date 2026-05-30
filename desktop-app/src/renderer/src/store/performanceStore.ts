import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PerformanceMode = 'low-pc' | 'studio' | 'performance'

export interface ModeConfig {
  label:          string
  description:    string
  maxTracks:      number
  maxRamMB:       number
  bufferSize:     number    // audio buffer size in samples
  workerCount:    number
  fftSize:        number
  streamChunkSec: number
  gpuAccel:       boolean
  analyzerFps:    number    // how many times/sec the analyser polls
  autoFreeze:     boolean   // auto-freeze idle tracks
  autoFreezeAfterSec: number
}

function hardwareWorkers(): number {
  return Math.max(1, (navigator.hardwareConcurrency ?? 4) - 1)
}

export const MODE_CONFIGS: Record<PerformanceMode, ModeConfig> = {
  'low-pc': {
    label:          'Low PC',
    description:    'Optimised for older or low-power machines. Limits tracks, RAM and CPU.',
    maxTracks:      8,
    maxRamMB:       256,
    bufferSize:     1024,
    workerCount:    1,
    fftSize:        1024,
    streamChunkSec: 30,
    gpuAccel:       false,
    analyzerFps:    5,
    autoFreeze:     true,
    autoFreezeAfterSec: 30,
  },
  'studio': {
    label:          'Studio',
    description:    'Maximum quality. Unlimited tracks, high RAM budget, full GPU acceleration.',
    maxTracks:      64,
    maxRamMB:       2048,
    bufferSize:     256,
    workerCount:    hardwareWorkers(),
    fftSize:        4096,
    streamChunkSec: 10,
    gpuAccel:       true,
    analyzerFps:    30,
    autoFreeze:     false,
    autoFreezeAfterSec: 120,
  },
  'performance': {
    label:          'Performance',
    description:    'Balanced for live sets. Low latency, moderate tracks, smart caching.',
    maxTracks:      24,
    maxRamMB:       512,
    bufferSize:     512,
    workerCount:    Math.max(1, Math.floor((navigator.hardwareConcurrency ?? 4) / 2)),
    fftSize:        2048,
    streamChunkSec: 15,
    gpuAccel:       true,
    analyzerFps:    15,
    autoFreeze:     true,
    autoFreezeAfterSec: 60,
  },
}

export interface PerformanceStats {
  cpuPct:   number
  ramMB:    number
  xruns:    number
  frozenTracks: number
  cachedBuffers: number
  cacheUsedMB:  number
}

interface PerformanceStore {
  mode:   PerformanceMode
  config: ModeConfig
  stats:  PerformanceStats
  setMode:   (m: PerformanceMode) => void
  setStats:  (s: Partial<PerformanceStats>) => void
}

export const usePerformanceStore = create<PerformanceStore>()(
  persist(
    (set) => ({
      mode:   'studio',
      config: MODE_CONFIGS['studio'],
      stats: { cpuPct: 0, ramMB: 0, xruns: 0, frozenTracks: 0, cachedBuffers: 0, cacheUsedMB: 0 },

      setMode: (m) => set({ mode: m, config: MODE_CONFIGS[m] }),
      setStats: (s) => set(st => ({ stats: { ...st.stats, ...s } })),
    }),
    {
      name: 'neurotek-performance-mode',
      partialize: (s) => ({ mode: s.mode }),
    },
  ),
)
