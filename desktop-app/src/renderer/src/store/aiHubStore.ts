// ─── aiHubStore.ts ────────────────────────────────────────────────────────────
// Central Zustand store integrating all AI systems (chat + context + actions + suggestions).
// Does NOT replace aiAssistantStore or deepAIStore — it is a new hub store.

import { create } from 'zustand'
import { aiActionManager } from '../audio/ai/AIActionManager'
import type { AIAction } from '../audio/ai/AIActionManager'
import { deepAIAssistant } from '../audio/ai/DeepAIAssistant'
import type { ProjectSnapshot } from '../audio/ai/MusicContextEngine'
import type { AISuggestion } from '../audio/ai/LiveSuggestionEngine'

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  actionId?: string
  source: 'local' | 'cloud' | 'system'
}

interface AIHubState {
  // Chat
  chatMessages: AIChatMessage[]
  inputText: string
  isProcessing: boolean

  // Actions
  pendingActions: AIAction[]
  actionHistory: AIAction[]
  previewingActionId: string | null

  // Context
  contextSummary: string
  isContextStale: boolean
  lastAnalyzedAt: number | null

  // Suggestions
  liveSuggestions: AISuggestion[]

  // Settings
  enabled: boolean
  autoAnalyze: boolean
  showPreviewModal: boolean

  // Actions / methods
  sendMessage: (text: string, getProjectSnapshot: () => ProjectSnapshot) => Promise<void>
  previewAction: (id: string) => void
  applyAction: (id: string) => void
  rejectAction: (id: string) => void
  undoAction: (id: string) => void
  syncActions: () => void
  updateSuggestions: (suggestions: AISuggestion[]) => void
  setEnabled: (v: boolean) => void
  setAutoAnalyze: (v: boolean) => void
  setContextSummary: (s: string, stale: boolean, analyzedAt: number) => void
  clearChat: () => void
  setInputText: (t: string) => void
}

export const useAIHubStore = create<AIHubState>((set, get) => ({
  // Initial state
  chatMessages: [],
  inputText: '',
  isProcessing: false,

  pendingActions: [],
  actionHistory: [],
  previewingActionId: null,

  contextSummary: '',
  isContextStale: true,
  lastAnalyzedAt: null,

  liveSuggestions: [],

  enabled: true,
  autoAnalyze: true,
  showPreviewModal: false,

  // ── Chat ────────────────────────────────────────────────────────────────────

  sendMessage: async (text: string, getProjectSnapshot: () => ProjectSnapshot) => {
    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      source: 'local',
    }

    set(state => ({
      chatMessages: [...state.chatMessages, userMsg],
      isProcessing: true,
    }))

    try {
      const snapshot = getProjectSnapshot()
      const result = await deepAIAssistant.processCommand(text, snapshot)

      let actionId: string | undefined
      if (result.plan.actions.length > 0) {
        const action = aiActionManager.createAction(
          'suggest-only',
          `AI: ${text.slice(0, 40)}`,
          result.plan.description,
          text,
          { textSuggestion: result.plan.description },
          result.parsedCommand.confidence,
        )
        actionId = action.id
      }

      const assistantMsg: AIChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.responseText,
        timestamp: Date.now(),
        actionId,
        source: result.source,
      }

      set(state => ({
        chatMessages: [...state.chatMessages, assistantMsg],
        isProcessing: false,
      }))

      get().syncActions()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue'
      const errMsg: AIChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Erreur: ${errorMsg}`,
        timestamp: Date.now(),
        source: 'system',
      }
      set(state => ({
        chatMessages: [...state.chatMessages, errMsg],
        isProcessing: false,
      }))
    }
  },

  // ── Actions ─────────────────────────────────────────────────────────────────

  previewAction: (id: string) => {
    aiActionManager.previewAction(id)
    set({ previewingActionId: id })
    get().syncActions()
  },

  applyAction: (id: string) => {
    aiActionManager.applyAction(id)
    set({ previewingActionId: null })
    get().syncActions()
  },

  rejectAction: (id: string) => {
    aiActionManager.rejectAction(id)
    get().syncActions()
  },

  undoAction: (id: string) => {
    aiActionManager.undoAction(id)
    get().syncActions()
  },

  syncActions: () => {
    set({
      pendingActions: aiActionManager.getPendingActions(),
      actionHistory: aiActionManager.getHistory(),
    })
  },

  // ── Suggestions ─────────────────────────────────────────────────────────────

  updateSuggestions: (suggestions: AISuggestion[]) => {
    set({ liveSuggestions: suggestions })
  },

  // ── Settings ────────────────────────────────────────────────────────────────

  setEnabled: (v: boolean) => set({ enabled: v }),
  setAutoAnalyze: (v: boolean) => set({ autoAnalyze: v }),

  setContextSummary: (s: string, stale: boolean, analyzedAt: number) => {
    set({
      contextSummary: s,
      isContextStale: stale,
      lastAnalyzedAt: analyzedAt,
    })
  },

  clearChat: () => set({ chatMessages: [] }),
  setInputText: (t: string) => set({ inputText: t }),
}))
