// ─── aiAssistantStore ─────────────────────────────────────────────────────────
// Zustand store for AI assistant state.

import { create } from 'zustand'
import { aiAssistant } from '../audio/ai/AIAssistantEngine'
import type { ProjectAnalysis } from '../audio/ai/MusicAnalyzer'
import { useProjectStore } from './projectStore'

interface ConversationEntry {
  id:        string
  role:      'user' | 'assistant'
  text:      string
  timestamp: number
  source:    'local' | 'cloud'
}

interface AIAssistantState {
  enabled:      boolean
  processing:   boolean
  history:      ConversationEntry[]
  lastAnalysis: ProjectAnalysis | null
  error:        string | null
  // Actions
  setEnabled:   (v: boolean) => void
  sendCommand:  (text: string) => Promise<void>
  clearHistory: () => void
  runAnalysis:  () => void
}

export const useAIAssistantStore = create<AIAssistantState>((set) => ({
  enabled:      true,
  processing:   false,
  history:      [],
  lastAnalysis: null,
  error:        null,

  setEnabled: (v) => set({ enabled: v }),

  sendCommand: async (text: string) => {
    set({ processing: true, error: null })

    const userEntry: ConversationEntry = {
      id:        `user-${Date.now()}`,
      role:      'user',
      text,
      timestamp: Date.now(),
      source:    'local',
    }

    set(s => ({ history: [...s.history, userEntry] }))

    try {
      const project  = useProjectStore.getState().project
      const response = await aiAssistant.processCommand(text, project)

      const assistantEntry: ConversationEntry = {
        id:        `assistant-${Date.now()}`,
        role:      'assistant',
        text:      response.text,
        timestamp: Date.now(),
        source:    response.source,
      }

      set(s => ({
        history:      [...s.history, assistantEntry],
        lastAnalysis: response.analysis,
        processing:   false,
      }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue'
      set(s => ({
        error:      errorMsg,
        processing: false,
        history:    [
          ...s.history,
          {
            id:        `error-${Date.now()}`,
            role:      'assistant',
            text:      `Erreur: ${errorMsg}`,
            timestamp: Date.now(),
            source:    'local',
          },
        ],
      }))
    }
  },

  clearHistory: () => set({ history: [], error: null }),

  runAnalysis: () => {
    const project  = useProjectStore.getState().project
    const analysis = aiAssistant.analyzeProject(project)
    set({ lastAnalysis: analysis })
  },
}))
