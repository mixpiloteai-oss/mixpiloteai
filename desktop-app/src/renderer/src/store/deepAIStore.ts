// ─── deepAIStore.ts ───────────────────────────────────────────────────────────
// Zustand store for Deep AI assistant state.

import { create } from 'zustand'
import { musicContextEngine } from '../audio/ai/MusicContextEngine'
import type { MusicContext, ProjectSnapshot } from '../audio/ai/MusicContextEngine'
import { deepAIAssistant } from '../audio/ai/DeepAIAssistant'
import type { DeepAIResult } from '../audio/ai/DeepAIAssistant'
import { liveSuggestionEngine } from '../audio/ai/LiveSuggestionEngine'
import type { AISuggestion } from '../audio/ai/LiveSuggestionEngine'
import type { ActionPlan } from '../audio/ai/CommandActionPlanner'

interface DeepAIState {
  context: MusicContext | null
  suggestions: AISuggestion[]
  isAnalyzing: boolean
  isLiveAssistantActive: boolean
  lastCommand: string
  commandHistory: DeepAIResult[]
  plan: ActionPlan | null
  // Actions
  analyzeProject: (snapshot: ProjectSnapshot) => Promise<void>
  processCommand: (text: string, snapshot: ProjectSnapshot) => Promise<DeepAIResult>
  startLiveAssistant: (getSnapshot: () => ProjectSnapshot) => void
  stopLiveAssistant: () => void
  clearHistory: () => void
}

export const useDeepAIStore = create<DeepAIState>((set, get) => ({
  context: null,
  suggestions: [],
  isAnalyzing: false,
  isLiveAssistantActive: false,
  lastCommand: '',
  commandHistory: [],
  plan: null,

  analyzeProject: async (snapshot: ProjectSnapshot) => {
    set({ isAnalyzing: true })
    try {
      const context = await musicContextEngine.buildContext(snapshot)
      const suggestions = liveSuggestionEngine.generateSuggestions(context)
      set({ context, suggestions, isAnalyzing: false })
    } catch {
      set({ isAnalyzing: false })
    }
  },

  processCommand: async (text: string, snapshot: ProjectSnapshot) => {
    set({ lastCommand: text })
    const result = await deepAIAssistant.processCommand(text, snapshot)
    set(state => {
      const newHistory = [...state.commandHistory, result].slice(-20)
      return {
        context: result.context,
        suggestions: result.suggestions,
        plan: result.plan,
        commandHistory: newHistory,
      }
    })
    return result
  },

  startLiveAssistant: (getSnapshot: () => ProjectSnapshot) => {
    liveSuggestionEngine.start(getSnapshot)
    const unsubscribe = liveSuggestionEngine.onSuggestions(suggestions => {
      set({ suggestions })
    })
    set({ isLiveAssistantActive: true })

    // Store unsubscribe so we can call it on stop (stored in closure)
    const originalStop = get().stopLiveAssistant
    set({
      stopLiveAssistant: () => {
        unsubscribe()
        liveSuggestionEngine.stop()
        set({ isLiveAssistantActive: false, stopLiveAssistant: originalStop })
      },
    })
  },

  stopLiveAssistant: () => {
    liveSuggestionEngine.stop()
    set({ isLiveAssistantActive: false })
  },

  clearHistory: () => {
    set({ commandHistory: [], lastCommand: '' })
  },
}))
