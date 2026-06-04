// ─── Layout Store ─────────────────────────────────────────────────────────────
// Controls the DAW workspace layout mode and panel sizes.
// Persisted to localStorage.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LayoutMode = 'ableton' | 'fl-studio' | 'logic'

export interface PanelSizes {
  browserW:   number   // left browser panel width in px
  inspectorW: number   // right inspector panel width in px
  mixerH:     number   // bottom mixer panel height in px
  mixerOpen:  boolean
  browserOpen:boolean
  inspectorOpen: boolean
}

const ABLETON_DEFAULTS: PanelSizes = {
  browserW:      220,
  inspectorW:    220,
  mixerH:        200,
  mixerOpen:     true,
  browserOpen:   true,
  inspectorOpen: true,
}

const FL_STUDIO_DEFAULTS: PanelSizes = {
  browserW:      200,
  inspectorW:    260,
  mixerH:        220,
  mixerOpen:     true,
  browserOpen:   true,
  inspectorOpen: true,
}

const LOGIC_DEFAULTS: PanelSizes = {
  browserW:      240,
  inspectorW:    200,
  mixerH:        180,
  mixerOpen:     true,
  browserOpen:   true,
  inspectorOpen: true,
}

const MODE_DEFAULTS: Record<LayoutMode, PanelSizes> = {
  'ableton':   ABLETON_DEFAULTS,
  'fl-studio': FL_STUDIO_DEFAULTS,
  'logic':     LOGIC_DEFAULTS,
}

interface LayoutStore {
  mode:        LayoutMode
  panelSizes:  PanelSizes

  setMode:          (mode: LayoutMode) => void
  setPanelSizes:    (sizes: Partial<PanelSizes>) => void
  toggleMixer:      () => void
  toggleBrowser:    () => void
  toggleInspector:  () => void
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      mode:       'ableton',
      panelSizes: ABLETON_DEFAULTS,

      setMode: (mode) => set({ mode, panelSizes: MODE_DEFAULTS[mode] }),

      setPanelSizes: (sizes) =>
        set(s => ({ panelSizes: { ...s.panelSizes, ...sizes } })),

      toggleMixer: () =>
        set(s => ({ panelSizes: { ...s.panelSizes, mixerOpen: !s.panelSizes.mixerOpen } })),

      toggleBrowser: () =>
        set(s => ({ panelSizes: { ...s.panelSizes, browserOpen: !s.panelSizes.browserOpen } })),

      toggleInspector: () =>
        set(s => ({ panelSizes: { ...s.panelSizes, inspectorOpen: !s.panelSizes.inspectorOpen } })),
    }),
    { name: 'daw-layout-v2' }
  )
)
