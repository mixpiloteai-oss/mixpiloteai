// ─── aiAssistantStore ─────────────────────────────────────────────────────────
// Zustand store for AI assistant state.

import { create } from 'zustand'
import { aiAssistant } from '../audio/ai/AIAssistantEngine'
import type { ProjectAnalysis } from '../audio/ai/MusicAnalyzer'
import { useProjectStore } from './projectStore'
import { useGenerationStore } from './generationStore'
import { useHistoryStore } from './historyStore'

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

      // If the result produced notes, insert them into the project (undoable)
      if (response.result?.notes && response.result.notes.length > 0) {
        const result = response.result

        // Determine target track: prefer a track named after the pattern type,
        // fall back to first MIDI track, otherwise create a new one
        const tracks   = useProjectStore.getState().project.tracks
        const midiTrack = tracks.find(t => t.type === 'midi')
        const trackId  = result.trackName
          ? (tracks.find(t => t.name === result.trackName)?.id
              ?? `ai-track-${result.patternType ?? 'pattern'}-${Date.now()}`)
          : (midiTrack?.id ?? `ai-track-${Date.now()}`)

        // Wrap insertion in history so Ctrl+Z undoes it
        useHistoryStore.getState().push({
          label:  `AI: ${result.patternType ?? 'pattern'} inserted`,
          domain: 'arrangement',
          undo: () => {
            // The clip id was set before push; capture snapshot of project state
            const afterState = useProjectStore.getState().project
            const inserted   = afterState.tracks
              .flatMap(t => t.clips)
              .filter(c => c.id.startsWith('ai-clip-'))
              .sort((a, b) => b.startBar - a.startBar)[0]
            if (inserted) {
              useProjectStore.getState().deleteClips([inserted.id])
            }
          },
          redo: () => {
            useGenerationStore.getState().applyToTrack(trackId, result)
          },
        })

        useGenerationStore.getState().applyToTrack(trackId, result)
      }

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
