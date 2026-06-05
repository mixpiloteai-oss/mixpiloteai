// ─── useMixerLayout.ts ────────────────────────────────────────────────────────
// Zustand store for mixer panel layout preferences.

import { create } from 'zustand'

const MIN_WIDTH     = 48
const MAX_WIDTH     = 160
const DEFAULT_WIDTH = 72

interface MixerLayoutStore {
  channelWidth: number
  compactMode:  boolean

  setChannelWidth:   (w: number) => void
  toggleCompactMode: () => void
  resetLayout:       () => void
}

export const useMixerLayout = create<MixerLayoutStore>((set) => ({
  channelWidth: DEFAULT_WIDTH,
  compactMode:  false,

  setChannelWidth: (w) =>
    set({ channelWidth: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w))) }),

  toggleCompactMode: () =>
    set(s => ({ compactMode: !s.compactMode })),

  resetLayout: () =>
    set({ channelWidth: DEFAULT_WIDTH, compactMode: false }),
}))

export { MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH }
