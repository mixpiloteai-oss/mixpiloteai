// ─── Engine Export Store ───────────────────────────────────────────────────────
// Zustand store for the audio export engine (ExportEngine / ExportQueue).
// Mirrors the ExportQueue state and provides actions for the UI.

import { create } from 'zustand'
import { exportQueue } from '../audio/export/ExportQueue'
import type { ExportJob, ExportOptions } from '../audio/export/ExportQueue'
import type { RenderJob, RenderTrack } from '../audio/export/OfflineRenderer'
import { exportEngine } from '../audio/export/ExportEngine'
import type { DitherType } from '../audio/export/DitherEngine'
import type { ExportFormat } from '../audio/export/FlacEncoderPcm'
import { exportPresets } from '../audio/export/ExportPresets'
import type { ExportPreset } from '../audio/export/ExportPresets'

// ─── Default export options ────────────────────────────────────────────────────

const DEFAULT_OPTIONS: ExportOptions = {
  format:           'wav' as ExportFormat,
  sampleRate:       44100,
  bitDepth:         24,
  ditherType:       'tpdf' as DitherType,
  normalization:    false,
  applyMasterChain: true,
  outputDirectory:  '',
  fileNameTemplate: '{projectName}_{format}_{sampleRate}Hz',
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface EngineExportStore {
  // State
  jobs:             ExportJob[]
  isRunning:        boolean
  currentJobId:     string | null
  defaultOptions:   ExportOptions
  ffmpegAvailable:  boolean
  history:          ExportJob[]
  presets:          ExportPreset[]
  selectedPresetId: string | null

  // Actions
  addExportJob:         (name: string, job: RenderJob, options: ExportOptions) => void
  cancelJob:            (id: string) => void
  removeJob:            (id: string) => void
  clearCompleted:       () => void
  startQueue:           () => Promise<void>
  updateDefaultOptions: (opts: Partial<ExportOptions>) => void

  // History
  loadHistory:  () => void
  clearHistory: () => void

  // Presets
  loadPresets:     () => void
  selectPreset:    (id: string) => void
  saveUserPreset:  (preset: Omit<ExportPreset, 'id' | 'isBuiltIn'>) => void

  // ffmpeg
  checkFfmpeg: () => Promise<void>

  // Quick-export helpers (delegates to ExportEngine)
  exportMaster:    (tracks: RenderTrack[], sampleRate: number, totalSamples: number, bpm: number) => Promise<void>
  exportStems:     (tracks: RenderTrack[], sampleRate: number, totalSamples: number, bpm: number) => Promise<void>
}

export const useEngineExportStore = create<EngineExportStore>((set, get) => {
  // Subscribe to export queue progress and sync jobs into Zustand state
  exportQueue.onProgress((updatedJob) => {
    set(state => ({
      jobs: state.jobs.map(j => j.id === updatedJob.id ? { ...updatedJob } : j),
      currentJobId: updatedJob.status === 'rendering' || updatedJob.status === 'encoding'
        ? updatedJob.id
        : state.currentJobId,
      isRunning: exportQueue.isRunning(),
    }))
  })

  return {
    jobs:             [],
    isRunning:        false,
    currentJobId:     null,
    defaultOptions:   DEFAULT_OPTIONS,
    ffmpegAvailable:  false,
    history:          [],
    presets:          exportPresets.getAllPresets(),
    selectedPresetId: null,

    addExportJob: (name, job, options) => {
      const exportJob = exportQueue.addJob(name, job, options)
      set(state => ({ jobs: [...state.jobs, exportJob] }))
    },

    cancelJob: (id) => {
      exportQueue.cancelJob(id)
      set(state => ({
        jobs: state.jobs.map(j =>
          j.id === id ? { ...j, status: 'cancelled' as const } : j
        ),
      }))
    },

    removeJob: (id) => {
      exportQueue.removeJob(id)
      set(state => ({ jobs: state.jobs.filter(j => j.id !== id) }))
    },

    clearCompleted: () => {
      exportQueue.clearCompleted()
      set(state => ({
        jobs: state.jobs.filter(j =>
          j.status !== 'done' && j.status !== 'error' && j.status !== 'cancelled'
        ),
      }))
    },

    startQueue: async () => {
      set({ isRunning: true })
      await exportQueue.start()
      set({ isRunning: false })
    },

    updateDefaultOptions: (opts) => {
      set(state => ({
        defaultOptions: { ...state.defaultOptions, ...opts },
      }))
    },

    loadHistory: () => {
      set({ history: exportQueue.getHistory() })
    },

    clearHistory: () => {
      exportQueue.clearHistory()
      set({ history: [] })
    },

    loadPresets: () => {
      set({ presets: exportPresets.getAllPresets() })
    },

    selectPreset: (id) => {
      const preset = exportPresets.getPreset(id)
      if (!preset) return
      const opts = exportPresets.applyPreset(preset)
      set(state => ({
        selectedPresetId: id,
        defaultOptions:   { ...state.defaultOptions, ...opts },
      }))
    },

    saveUserPreset: (preset) => {
      exportPresets.saveUserPreset(preset)
      set({ presets: exportPresets.getAllPresets() })
    },

    checkFfmpeg: async () => {
      const api = (globalThis as Record<string, unknown>)['electronAPI'] as
        | { exportCheckFfmpeg?: () => Promise<boolean> }
        | undefined
      const available = api?.exportCheckFfmpeg ? await api.exportCheckFfmpeg() : false
      set({ ffmpegAvailable: available })
    },

    exportMaster: async (tracks, sampleRate, totalSamples, bpm) => {
      const options = get().defaultOptions
      const job     = await exportEngine.exportMaster(options, tracks, sampleRate, totalSamples, bpm)
      set(state => ({ jobs: [...state.jobs, job], isRunning: true }))
    },

    exportStems: async (tracks, sampleRate, totalSamples, bpm) => {
      const options = get().defaultOptions
      const jobs    = await exportEngine.exportStems(options, tracks, sampleRate, totalSamples, bpm)
      set(state => ({ jobs: [...state.jobs, ...jobs], isRunning: true }))
    },
  }
})
