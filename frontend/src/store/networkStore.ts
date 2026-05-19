import { create } from 'zustand'

// ─── Network / Offline-First Store ───────────────────────────────────────────

export interface NetworkState {
  isOnline:         boolean
  wasOffline:       boolean   // transient — true for ~4 s after reconnection
  reconnecting:     boolean
  backendReachable: boolean | null
  syncPending:      number    // items queued offline
  syncing:          boolean
  lastSyncAt:       number | null

  setOnline:            (v: boolean)         => void
  setWasOffline:        (v: boolean)         => void
  setReconnecting:      (v: boolean)         => void
  setBackendReachable:  (v: boolean | null)  => void
  setSyncPending:       (n: number)          => void
  setSyncing:           (v: boolean)         => void
  setLastSyncAt:        (t: number)          => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline:        navigator.onLine,
  wasOffline:      false,
  reconnecting:    false,
  backendReachable: null,
  syncPending:     0,
  syncing:         false,
  lastSyncAt:      null,

  setOnline:           (v) => set({ isOnline: v }),
  setWasOffline:       (v) => set({ wasOffline: v }),
  setReconnecting:     (v) => set({ reconnecting: v }),
  setBackendReachable: (v) => set({ backendReachable: v }),
  setSyncPending:      (n) => set({ syncPending: n }),
  setSyncing:          (v) => set({ syncing: v }),
  setLastSyncAt:       (t) => set({ lastSyncAt: t }),
}))
