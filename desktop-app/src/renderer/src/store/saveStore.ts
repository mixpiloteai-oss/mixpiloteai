import { create } from 'zustand'
import type { SaveStatus } from '../audio/save/types'

interface SaveStore {
  status: SaveStatus
  historyOpen: boolean
  setStatus: (s: SaveStatus) => void
  toggleHistory: () => void
}

export const useSaveStore = create<SaveStore>((set) => ({
  status: {
    state:       'idle',
    lastSavedAt: null,
    lastError:   null,
    autoSaveIn:  30,
    isDirty:     false,
  },
  historyOpen: false,

  setStatus:     (s) => set({ status: s }),
  toggleHistory: () => set(s => ({ historyOpen: !s.historyOpen })),
}))
