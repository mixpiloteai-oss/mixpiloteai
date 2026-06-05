// ─── generationStore.ts ───────────────────────────────────────────────────────
// Zustand store for AI generation state.

import { create } from 'zustand'
import type { GeneratedPattern } from '../audio/ai/PatternGenerator'
import type { AutomationCurve } from '../audio/ai/AutomationGenerator'
import type { GenerationEntry } from '../audio/ai/GenerationHistory'
import type { GenerationRequest } from '../audio/ai/MidiGenerationEngine'
import { midiGenerationEngine, generationHistory } from '../audio/ai/MidiGenerationEngine'
import { useAIAssistantStore } from './aiAssistantStore'
import type { ExecutionResult } from '../audio/ai/MusicCommandExecutor'
import { useProjectStore } from './projectStore'
import { useTransportStore } from './transportStore'
import type { Clip, Track } from '../types/project'

interface GenerationState {
  generating:        boolean
  previewPattern:    GeneratedPattern | null
  previewAutomation: AutomationCurve | null
  history:           GenerationEntry[]
  lastRequest:       GenerationRequest | null
  suggestions:       GenerationRequest[]
  error:             string | null

  // Actions
  generate:        (req: GenerationRequest) => Promise<void>
  acceptPreview:   () => void
  rejectPreview:   () => void
  regenerate:      () => Promise<void>
  /**
   * Insert an ExecutionResult's notes into the project as a new Clip.
   * If trackId doesn't match an existing track, a new MIDI track is created first.
   */
  applyToTrack:    (trackId: string, result: ExecutionResult) => void
  loadSuggestions: () => void
  clearHistory:    () => void
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  generating:        false,
  previewPattern:    null,
  previewAutomation: null,
  history:           [],
  lastRequest:       null,
  suggestions:       [],
  error:             null,

  generate: async (req: GenerationRequest) => {
    set({ generating: true, error: null })
    try {
      const result = midiGenerationEngine.generate(req)
      set({
        previewPattern:    result.pattern,
        previewAutomation: result.automation,
        lastRequest:       req,
        history:           generationHistory.list(),
        generating:        false,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      set({ error: msg, generating: false })
    }
  },

  acceptPreview: () => {
    const last = generationHistory.last()
    if (last) generationHistory.accept(last.id)
    set({ history: generationHistory.list() })
  },

  rejectPreview: () => {
    const last = generationHistory.last()
    if (last) generationHistory.reject(last.id)
    set({
      previewPattern:    null,
      previewAutomation: null,
      history:           generationHistory.list(),
    })
  },

  regenerate: async () => {
    const { lastRequest, generate } = get()
    if (lastRequest) {
      await generate({ ...lastRequest, seed: undefined })
    }
  },

  applyToTrack: (trackId: string, result: ExecutionResult) => {
    if (!result.notes || result.notes.length === 0) return

    const projectStore = useProjectStore.getState()
    const { project }  = projectStore

    // Ensure the target track exists; create it if not
    const trackExists = project.tracks.some(t => t.id === trackId)
    if (!trackExists) {
      const newTrack: Track = {
        id:        trackId,
        name:      result.trackName ?? `AI ${result.patternType ?? 'Pattern'}`,
        type:      'midi',
        color:     '#7c3aed',
        clips:     [],
        gainDb:    0,
        panCenter: 0,
        muted:     false,
        soloed:    false,
        armed:     false,
        sends:     [],
        height:    64,
      }
      projectStore.addTrack(newTrack)
    }

    // Determine start bar: current playhead position rounded up to next bar boundary
    const positionBar = useTransportStore.getState().positionBar
    const startBar    = Math.max(1, Math.ceil(positionBar))

    // Derive clip length from note data
    const timeSigTop  = project.timeSignatureNumerator
    const maxBeat     = result.notes.reduce(
      (max, n) => Math.max(max, n.startBeat + n.lengthBeats),
      0,
    )
    const lengthBars  = Math.max(1, Math.ceil(maxBeat / timeSigTop))

    const clip: Clip = {
      id:         `ai-clip-${Date.now()}`,
      trackId,
      name:       result.message.slice(0, 40) || 'AI Pattern',
      startBar,
      lengthBars,
      color:      '#7c3aed',
      muted:      false,
      notes:      result.notes,
    }

    projectStore.addClip(clip)
  },

  loadSuggestions: () => {
    const analysis = useAIAssistantStore.getState().lastAnalysis
    if (analysis) {
      set({ suggestions: midiGenerationEngine.getSuggestions(analysis) })
    } else {
      set({ suggestions: [] })
    }
  },

  clearHistory: () => {
    generationHistory.clear()
    set({ history: [] })
  },
}))
