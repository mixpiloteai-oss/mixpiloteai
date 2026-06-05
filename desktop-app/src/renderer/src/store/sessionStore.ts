import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SessionState {
  sessionId:         string
  startedAt:         number
  lastSavedAt:       number | null
  isDirty:           boolean
  lastProjectPath:   string | null
  recentProjects:    string[]

  markDirty:         () => void
  markSaved:         () => void
  setLastProjectPath:(path: string) => void
  addRecentProject:  (path: string) => void
  resetSession:      () => void
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId:       generateId(),
      startedAt:       Date.now(),
      lastSavedAt:     null,
      isDirty:         false,
      lastProjectPath: null,
      recentProjects:  [],

      markDirty:   () => set({ isDirty: true }),
      markSaved:   () => set({ isDirty: false, lastSavedAt: Date.now() }),
      setLastProjectPath: (path) => set({ lastProjectPath: path }),
      addRecentProject: (path) => set(s => ({
        recentProjects: [path, ...s.recentProjects.filter(p => p !== path)].slice(0, 10),
      })),
      resetSession: () => set({ isDirty: false, lastSavedAt: null }),
    }),
    {
      name:      'neurotek-session',
      partialize: (state) => ({
        lastProjectPath: state.lastProjectPath,
        recentProjects:  state.recentProjects,
        lastSavedAt:     state.lastSavedAt,
      }),
    }
  )
)
