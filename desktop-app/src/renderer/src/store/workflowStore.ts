// ─── workflowStore ────────────────────────────────────────────────────────────
// Zustand store for the AI Workflow Assistant.

import { create } from 'zustand'
import { analyzeWorkflow } from '../audio/workflow/WorkflowAnalyzer'
import type { WorkflowAnalysis } from '../audio/workflow/WorkflowAnalyzer'
import { WorkflowActionQueue } from '../audio/workflow/WorkflowActionQueue'
import type { WorkflowAction } from '../audio/workflow/WorkflowActionQueue'
import { useProjectStore } from './projectStore'

interface WorkflowState {
  enabled:        boolean
  analysis:       WorkflowAnalysis | null
  pendingActions: WorkflowAction[]
  analyzing:      boolean
  error:          string | null
  tipIndex:       number

  setEnabled:            (v: boolean) => void
  runAnalysis:           () => Promise<void>
  enqueueAction:         (a: Omit<WorkflowAction, 'id' | 'status' | 'createdAt'>) => void
  confirmAction:         (id: string) => void
  dismissAction:         (id: string) => void
  nextTip:               () => void
  clearActions:          () => void
  applyColorSuggestions: () => void
  applyNameSuggestions:  () => void
}

const _queue = new WorkflowActionQueue()

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  enabled:        true,
  analysis:       null,
  pendingActions: [],
  analyzing:      false,
  error:          null,
  tipIndex:       0,

  setEnabled: (v) => set({ enabled: v }),

  runAnalysis: async () => {
    set({ analyzing: true, error: null })
    try {
      await Promise.resolve()
      const project  = useProjectStore.getState().project
      const analysis = analyzeWorkflow(project)
      set({ analysis, analyzing: false, pendingActions: _queue.getPending() })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      set({ error: errorMsg, analyzing: false })
    }
  },

  enqueueAction: (a) => {
    _queue.enqueue(a)
    set({ pendingActions: _queue.getPending() })
  },

  confirmAction: (id) => {
    const action = _queue.confirm(id)
    if (!action) return

    const store = useProjectStore.getState()

    switch (action.type) {
      case 'set_track_color': {
        if (action.trackId) {
          // Update color via track name (using setTrackGain as a proxy — we update track directly)
          const color = action.payload['color']
          if (typeof color === 'string') {
            const project = store.project
            const updatedTracks = project.tracks.map(t =>
              t.id === action.trackId ? { ...t, color } : t
            )
            useProjectStore.setState({ project: { ...project, tracks: updatedTracks } })
          }
        }
        break
      }

      case 'set_track_name': {
        if (action.trackId) {
          const name = action.payload['name']
          if (typeof name === 'string') {
            const project = store.project
            const updatedTracks = project.tracks.map(t =>
              t.id === action.trackId ? { ...t, name } : t
            )
            useProjectStore.setState({ project: { ...project, tracks: updatedTracks } })
          }
        }
        break
      }

      case 'set_track_gain': {
        if (action.trackId) {
          const db = action.payload['gainDb']
          if (typeof db === 'number') {
            store.setTrackGain(action.trackId, db)
          }
        }
        break
      }

      case 'set_master_gain': {
        const db = action.payload['gainDb']
        if (typeof db === 'number') {
          const project = store.project
          useProjectStore.setState({ project: { ...project, masterGainDb: db } })
        }
        break
      }

      case 'set_track_pan': {
        if (action.trackId) {
          const pan = action.payload['panCenter']
          if (typeof pan === 'number') {
            store.setTrackPan(action.trackId, pan)
          }
        }
        break
      }

      case 'unsolo_track': {
        if (action.trackId) {
          const project = store.project
          const track = project.tracks.find(t => t.id === action.trackId)
          if (track?.soloed) {
            store.toggleSolo(action.trackId)
          }
        }
        break
      }

      case 'unmute_track': {
        if (action.trackId) {
          const project = store.project
          const track = project.tracks.find(t => t.id === action.trackId)
          if (track?.muted) {
            store.toggleMute(action.trackId)
          }
        }
        break
      }
    }

    set({ pendingActions: _queue.getPending() })
  },

  dismissAction: (id) => {
    _queue.dismiss(id)
    set({ pendingActions: _queue.getPending() })
  },

  nextTip: () => {
    const { analysis, tipIndex } = get()
    const tipCount = analysis?.tips.length ?? 0
    if (tipCount > 0) {
      set({ tipIndex: (tipIndex + 1) % tipCount })
    }
  },

  clearActions: () => {
    _queue.clear()
    set({ pendingActions: [] })
  },

  applyColorSuggestions: () => {
    const { analysis } = get()
    if (!analysis) return

    for (const suggestion of analysis.organization.colors) {
      void useProjectStore.getState().project.tracks.find(t => t.id === suggestion.trackId)
      _queue.enqueue({
        type:          'set_track_color',
        description:   `Change '${suggestion.trackName}' color to ${suggestion.suggestedColor}`,
        trackId:       suggestion.trackId,
        payload:       { color: suggestion.suggestedColor },
        previousValue: suggestion.currentColor,
      })
    }

    set({ pendingActions: _queue.getPending() })
  },

  applyNameSuggestions: () => {
    const { analysis } = get()
    if (!analysis) return

    for (const suggestion of analysis.organization.names) {
      _queue.enqueue({
        type:          'set_track_name',
        description:   `Rename '${suggestion.currentName}' to '${suggestion.suggestedName}'`,
        trackId:       suggestion.trackId,
        payload:       { name: suggestion.suggestedName },
        previousValue: suggestion.currentName,
      })
    }

    set({ pendingActions: _queue.getPending() })
  },
}))
