// ─── mixAssistantStore ────────────────────────────────────────────────────────
// Zustand store for AI-assisted mix/master intelligence system.

import { create } from 'zustand'
import { FrequencyAnalyzer } from '../audio/analysis/FrequencyAnalyzer'
import { DynamicsAnalyzer } from '../audio/analysis/DynamicsAnalyzer'
import { StereoAnalyzer } from '../audio/analysis/StereoAnalyzer'
import { GainStagingAnalyzer } from '../audio/analysis/GainStagingAnalyzer'
import { FrequencyCollisionDetector } from '../audio/analysis/FrequencyCollisionDetector'
import { EQSuggestionEngine } from '../audio/mixing/EQSuggestionEngine'
import { CompressionSuggestionEngine } from '../audio/mixing/CompressionSuggestionEngine'
import { MixBalanceSuggestionEngine } from '../audio/mixing/MixBalanceSuggestionEngine'
import { MasteringAssistant } from '../audio/mixing/MasteringAssistant'
import type { SpectrumData } from '../audio/analysis/FrequencyAnalyzer'
import type { DynamicsResult } from '../audio/analysis/DynamicsAnalyzer'
import type { StereoResult } from '../audio/analysis/StereoAnalyzer'
import type { GainStagingResult } from '../audio/analysis/GainStagingAnalyzer'
import type { FrequencyCollision } from '../audio/analysis/FrequencyCollisionDetector'
import type { EQSuggestion } from '../audio/mixing/EQSuggestionEngine'
import type { CompressionSuggestion } from '../audio/mixing/CompressionSuggestionEngine'
import type { MixBalanceSuggestion } from '../audio/mixing/MixBalanceSuggestionEngine'
import type { MasteringReport } from '../audio/mixing/MasteringAssistant'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FullMixAnalysis {
  spectrum:     SpectrumData
  dynamics:     DynamicsResult
  stereo:       StereoResult
  analyzedAt:   number
}

export interface MixTrack {
  id:         string
  name:       string
  buffer:     Float32Array
  leftBuffer?: Float32Array
  rightBuffer?: Float32Array
}

export interface AppliedSuggestion {
  id:        string
  type:      'eq' | 'compression' | 'mastering'
  trackId:   string | null
  suggestion: EQSuggestion | CompressionSuggestion | string
  appliedAt: number
  reverted:  boolean
}

// ─── State ────────────────────────────────────────────────────────────────────

interface MixAssistantState {
  // Audio data
  masterBuffer:   Float32Array | null
  sampleRate:     number
  tracks:         MixTrack[]

  // Analysis results
  currentAnalysis:        FullMixAnalysis | null
  masteringReport:        MasteringReport | null
  eqSuggestions:          Map<string, EQSuggestion[]>
  compressionSuggestions: Map<string, CompressionSuggestion>
  frequencyCollisions:    FrequencyCollision[]
  gainStagingResult:      GainStagingResult | null
  mixBalanceSuggestion:   MixBalanceSuggestion | null

  // UI state
  isAnalyzing:     boolean
  abCompareEnabled: boolean
  abCompareLabel:  'A' | 'B'

  // Non-destructive suggestion tracking
  pendingSuggestions: AppliedSuggestion[]

  // ── Actions ────────────────────────────────────────────────────────────────

  setMasterBuffer:  (buffer: Float32Array, sampleRate: number) => void
  setTracks:        (tracks: MixTrack[]) => void
  analyzeMaster:    () => Promise<void>
  analyzeTracks:    () => Promise<void>
  runFullAnalysis:  () => Promise<void>

  // Non-destructive suggestion management
  applySuggestion:   (suggestion: AppliedSuggestion) => void
  revertSuggestion:  (id: string) => void

  toggleABCompare:  () => void
  clearAnalysis:    () => void
}

// ─── Singleton analyzers ──────────────────────────────────────────────────────

const freqAnalyzer   = new FrequencyAnalyzer()
const dynAnalyzer    = new DynamicsAnalyzer()
const stereoAnalyzer = new StereoAnalyzer()
const gainAnalyzer   = new GainStagingAnalyzer()
const collisionDetector = new FrequencyCollisionDetector()
const eqEngine       = new EQSuggestionEngine()
const compEngine     = new CompressionSuggestionEngine()
const balanceEngine  = new MixBalanceSuggestionEngine()
const masteringAssist = new MasteringAssistant()

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMixAssistantStore = create<MixAssistantState>((set, get) => ({
  // Initial state
  masterBuffer:           null,
  sampleRate:             44100,
  tracks:                 [],
  currentAnalysis:        null,
  masteringReport:        null,
  eqSuggestions:          new Map(),
  compressionSuggestions: new Map(),
  frequencyCollisions:    [],
  gainStagingResult:      null,
  mixBalanceSuggestion:   null,
  isAnalyzing:            false,
  abCompareEnabled:       false,
  abCompareLabel:         'A',
  pendingSuggestions:     [],

  setMasterBuffer: (buffer, sampleRate) => set({ masterBuffer: buffer, sampleRate }),
  setTracks:       (tracks) => set({ tracks }),

  analyzeMaster: async () => {
    const { masterBuffer, sampleRate } = get()
    if (!masterBuffer) return

    set({ isAnalyzing: true })

    try {
      const spectrum  = freqAnalyzer.analyzeSpectrum(masterBuffer, sampleRate)
      const dynamics  = dynAnalyzer.analyzeDynamics(masterBuffer, sampleRate)
      const stereo    = stereoAnalyzer.analyzeStereo(masterBuffer, masterBuffer)
      const balance   = balanceEngine.analyzeBalance(spectrum, sampleRate)
      const mastering = masteringAssist.analyzeMaster(masterBuffer, sampleRate)

      set({
        currentAnalysis: {
          spectrum,
          dynamics,
          stereo,
          analyzedAt: Date.now(),
        },
        mixBalanceSuggestion: balance,
        masteringReport:      mastering,
      })
    } finally {
      set({ isAnalyzing: false })
    }
  },

  analyzeTracks: async () => {
    const { tracks, sampleRate } = get()
    if (tracks.length === 0) return

    set({ isAnalyzing: true })

    try {
      const eqSugs  = new Map<string, EQSuggestion[]>()
      const compSugs = new Map<string, CompressionSuggestion>()

      for (const track of tracks) {
        const spectrum  = freqAnalyzer.analyzeSpectrum(track.buffer, sampleRate)
        const dynamics  = dynAnalyzer.analyzeDynamics(track.buffer, sampleRate)

        eqSugs.set(track.id, eqEngine.suggestEQ(spectrum, track.name))
        compSugs.set(track.id, compEngine.suggestCompression(dynamics))
      }

      // Gain staging
      const gainResult = gainAnalyzer.analyzeGainStaging(
        tracks.map((t) => ({ id: t.id, name: t.name, buffer: t.buffer })),
      )

      // Frequency collisions
      const collisions = collisionDetector.detectCollisions(
        tracks.map((t) => ({ id: t.id, name: t.name, buffer: t.buffer })),
        sampleRate,
      )

      set({
        eqSuggestions:          eqSugs,
        compressionSuggestions: compSugs,
        gainStagingResult:      gainResult,
        frequencyCollisions:    collisions,
      })
    } finally {
      set({ isAnalyzing: false })
    }
  },

  runFullAnalysis: async () => {
    await get().analyzeMaster()
    await get().analyzeTracks()
  },

  // Non-destructive: record suggestion as "pending" — never auto-apply
  applySuggestion: (suggestion) => {
    set((state) => ({
      pendingSuggestions: [
        ...state.pendingSuggestions,
        { ...suggestion, reverted: false, appliedAt: Date.now() },
      ],
    }))
  },

  revertSuggestion: (id) => {
    set((state) => ({
      pendingSuggestions: state.pendingSuggestions.map((s) =>
        s.id === id ? { ...s, reverted: true } : s,
      ),
    }))
  },

  toggleABCompare: () => {
    set((state) => ({
      abCompareEnabled: !state.abCompareEnabled,
      abCompareLabel:   state.abCompareLabel === 'A' ? 'B' : 'A',
    }))
  },

  clearAnalysis: () => {
    set({
      currentAnalysis:        null,
      masteringReport:        null,
      eqSuggestions:          new Map(),
      compressionSuggestions: new Map(),
      frequencyCollisions:    [],
      gainStagingResult:      null,
      mixBalanceSuggestion:   null,
      pendingSuggestions:     [],
    })
  },
}))
