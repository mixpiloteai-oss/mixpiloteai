// ─── Cloud Sync Store ─────────────────────────────────────────────────────────
// Zustand store for cloud sync UI state.

import { create } from 'zustand'
import { getCloudSyncEngine } from '../services/CloudSyncEngine'
import type { SyncStatus, SyncConflict } from '../services/CloudSyncEngine'

// Re-export types for convenience
export type { SyncStatus, SyncConflict }

interface CloudSyncStore {
  status: SyncStatus
  lastSyncAt: number | null
  pendingCount: number
  conflict: SyncConflict | null
  error: string | null
  isOnline: boolean

  setStatus: (s: SyncStatus) => void
  setLastSyncAt: (ts: number) => void
  setPendingCount: (n: number) => void
  setConflict: (c: SyncConflict | null) => void
  setError: (e: string | null) => void
  setOnline: (v: boolean) => void
}

export const useCloudSyncStore = create<CloudSyncStore>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  pendingCount: 0,
  conflict: null,
  error: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  setStatus: (s) => set({ status: s }),
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
  setPendingCount: (n) => set({ pendingCount: n }),
  setConflict: (c) => set({ conflict: c }),
  setError: (e) => set({ error: e }),
  setOnline: (v) => set({ isOnline: v }),
}))

// ── initCloudSync ──────────────────────────────────────────────────────────────

export function initCloudSync(projectId: string, authToken: string): () => void {
  void projectId // projectId available for future use (per-project sync tracking)

  const engine = getCloudSyncEngine()
  engine.setAuthToken(authToken)

  // Subscribe to engine state changes
  const unsubscribe = engine.onStateChange((state) => {
    const store = useCloudSyncStore.getState()
    store.setStatus(state.status)
    if (state.lastSyncAt !== null) store.setLastSyncAt(state.lastSyncAt)
    store.setPendingCount(state.pendingOps.length)
    store.setConflict(state.conflict)
    store.setError(state.error)
  })

  // Listen for online/offline events
  const handleOnline = (): void => useCloudSyncStore.getState().setOnline(true)
  const handleOffline = (): void => useCloudSyncStore.getState().setOnline(false)

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  // Return cleanup function
  return () => {
    unsubscribe()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }
}
