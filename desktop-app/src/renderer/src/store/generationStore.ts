// ─── generationStore.ts ───────────────────────────────────────────────────────
// Zustand store for AI generation state.

import { create } from 'zustand'
import type { GeneratedPattern } from '../audio/ai/PatternGenerator'
import type { AutomationCurve } from '../audio/ai/AutomationGenerator'
import type { GenerationEntry } from '../audio/ai/GenerationHistory'
import type { GenerationRequest } from '../audio/ai/MidiGenerationEngine'
import { midiGenerationEngine, generationHistory } from '../audio/ai/MidiGenerationEngine'
import { useAIAssistantStore } from './aiAssistantStore'

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
  applyToTrack:    (trackId: string, clipId: string) => void
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

  applyToTrack: (trackId: string, clipId: string) => {
    // Integration point for future project store wiring
    console.log(`apply to track: trackId=${trackId}, clipId=${clipId}`)
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
