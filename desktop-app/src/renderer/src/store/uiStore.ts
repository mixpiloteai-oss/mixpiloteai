import { create } from 'zustand'
import { type ActiveTool, nextTool } from '../tools/ToolState.ts'

export type ViewId =
  | 'arrangement' | 'mixer' | 'pianoroll'
  | 'ai' | 'ai-local' | 'performance' | 'live' | 'vst' | 'routing' | 'dashboard' | 'export' | 'collab' | 'marketplace'

interface UIStore {
  activeView: ViewId
  aiPanelOpen: boolean
  mixerVisible: boolean         // mixer panel below arrangement
  pianoRollVisible: boolean     // piano roll below arrangement
  sidebarCollapsed: boolean
  zoomX: number                 // horizontal zoom multiplier
  zoomY: number                 // vertical zoom (track height)
  activeTool: ActiveTool
  scrollOffsetBars: number
  setView: (v: ViewId) => void
  toggleAIPanel: () => void
  toggleMixer: () => void
  togglePianoRoll: () => void
  toggleSidebar: () => void
  setZoomX: (z: number) => void
  setZoomY: (z: number) => void
  setActiveTool: (t: ActiveTool) => void
  cycleTool: (dir: 1 | -1) => void
  setScrollOffset: (bars: number) => void
  scrollBy: (deltaBars: number) => void
}

export const useUIStore = create<UIStore>((set) => ({
  activeView: 'arrangement',
  aiPanelOpen: false,
  mixerVisible: true,
  pianoRollVisible: false,
  sidebarCollapsed: false,
  zoomX: 1,
  zoomY: 1,
  activeTool: 'pointer',
  scrollOffsetBars: 0,

  setView:          (v) => set({ activeView: v }),
  toggleAIPanel:    () => set(s => ({ aiPanelOpen: !s.aiPanelOpen })),
  toggleMixer:      () => set(s => ({ mixerVisible: !s.mixerVisible })),
  togglePianoRoll:  () => set(s => ({ pianoRollVisible: !s.pianoRollVisible })),
  toggleSidebar:    () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setZoomX:         (z) => set({ zoomX: Math.max(0.25, Math.min(8, z)) }),
  setZoomY:         (z) => set({ zoomY: Math.max(0.5, Math.min(3, z)) }),
  setActiveTool:    (t) => set({ activeTool: t }),
  cycleTool:        (dir) => set(s => ({ activeTool: nextTool(s.activeTool, dir) })),
  setScrollOffset:  (bars) => set({ scrollOffsetBars: Math.max(0, bars) }),
  scrollBy:         (delta) => set(s => ({ scrollOffsetBars: Math.max(0, s.scrollOffsetBars + delta) })),
}))
