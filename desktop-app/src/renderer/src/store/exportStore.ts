import { create } from 'zustand'
import type { ExportFormat, ExportQualityPreset, ExportResult } from '../audio/export/ExportPipeline'

export type ExportPhase = 'rendering' | 'gpu' | 'normalizing' | 'encoding'
export type ExportStatus = 'idle' | 'running' | 'done' | 'error'

export interface ExportHistoryEntry {
  id:          string
  filename:    string
  format:      ExportFormat
  preset:      ExportQualityPreset
  sizeMB:      number
  lufs:        number
  truePeakDB:  number
  peakdBFS:    number
  gpuUsed:     boolean
  renderMs:    number
  timestamp:   number
  blob:        Blob
}

interface ExportStore {
  // Current job
  status:      ExportStatus
  phase:       ExportPhase
  progress:    number           // 0–100
  error:       string | null
  lastResult:  ExportResult | null

  // Stems progress
  stemsDone:   number
  stemsTotal:  number
  stemsCurrent: string

  // History (last 20 exports)
  history:     ExportHistoryEntry[]

  // Actions
  setRunning:  (phase: ExportPhase, pct: number) => void
  setDone:     (result: ExportResult) => void
  setError:    (msg: string) => void
  reset:       () => void
  setStemsProgress: (done: number, total: number, current: string) => void
  pushHistory: (entry: ExportHistoryEntry) => void
  removeHistory: (id: string) => void
}

export const useExportStore = create<ExportStore>((set) => ({
  status:       'idle',
  phase:        'rendering',
  progress:     0,
  error:        null,
  lastResult:   null,
  stemsDone:    0,
  stemsTotal:   0,
  stemsCurrent: '',
  history:      [],

  setRunning: (phase, pct) => set({ status: 'running', phase, progress: pct, error: null }),
  setDone:    (result)     => set({ status: 'done', progress: 100, lastResult: result }),
  setError:   (msg)        => set({ status: 'error', error: msg }),
  reset:      ()           => set({ status: 'idle', progress: 0, error: null, lastResult: null,
                                    stemsDone: 0, stemsTotal: 0, stemsCurrent: '' }),
  setStemsProgress: (done, total, current) => set({ stemsDone: done, stemsTotal: total, stemsCurrent: current }),
  pushHistory: (entry) => set(s => ({ history: [entry, ...s.history].slice(0, 20) })),
  removeHistory: (id)  => set(s => ({ history: s.history.filter(h => h.id !== id) })),
}))
