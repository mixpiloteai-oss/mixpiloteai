import { create } from 'zustand'

// ─── Desktop Network Store ────────────────────────────────────────────────────
// All DAW functionality (projects, mixer, export, VST, MIDI, piano roll, etc.)
// works 100% offline.  This store only gates cloud/AI features.

export interface DesktopNetworkState {
  isOnline:        boolean
  backendReachable: boolean | null
  aiAvailable:     boolean    // true when online + backend reachable

  setOnline:           (v: boolean)        => void
  setBackendReachable: (v: boolean | null) => void
}

export const useDesktopNetworkStore = create<DesktopNetworkState>((set) => ({
  isOnline:         navigator.onLine,
  backendReachable: null,
  aiAvailable:      false,

  setOnline: (v) => set(s => ({
    isOnline: v,
    aiAvailable: v && s.backendReachable === true,
  })),

  setBackendReachable: (v) => set(s => ({
    backendReachable: v,
    aiAvailable: s.isOnline && v === true,
  })),
}))
