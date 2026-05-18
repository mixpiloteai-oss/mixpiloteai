import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

export interface ARViewState {
  tool: 'pointer' | 'pencil' | 'split' | 'erase'
  snap: 'off' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1/1' | '2/1' | '4/1'
  zoomX: number       // px per beat (default 24)
  scrollX: number     // px from beat 0
  scrollY: number     // px from top
  selectedClipIds: Set<string>
  markers: Array<{ id: string; bar: number; label: string; color: string }>
}

export interface ARViewActions {
  setTool(t: ARViewState['tool']): void
  setSnap(s: ARViewState['snap']): void
  setScroll(x: number, y: number): void
  setZoom(zx: number): void
  selectClips(ids: string[]): void
  deselectAll(): void
  toggleSelectClip(id: string): void
  addToSelection(ids: string[]): void
  addMarker(bar: number): void
  removeMarker(id: string): void
  moveMarker(id: string, bar: number): void
}

export const useArrangementViewStore: UseBoundStore<StoreApi<ARViewState & ARViewActions>> =
  create<ARViewState & ARViewActions>((set) => ({
    tool: 'pointer',
    snap: '1/1',
    zoomX: 24,
    scrollX: 0,
    scrollY: 0,
    selectedClipIds: new Set<string>(),
    markers: [
      { id: 'm1', bar:  1, label: 'Intro',  color: '#f59e0b' },
      { id: 'm2', bar:  9, label: 'Drop',   color: '#06b6d4' },
      { id: 'm3', bar: 17, label: 'Break',  color: '#10b981' },
      { id: 'm4', bar: 25, label: 'Drop 2', color: '#ef4444' },
    ],

    setTool:  (t) => set({ tool: t }),
    setSnap:  (s) => set({ snap: s }),
    setScroll: (x, y) => set({ scrollX: Math.max(0, x), scrollY: Math.max(0, y) }),
    setZoom: (zx) => set({ zoomX: Math.max(2, Math.min(512, zx)) }),
    selectClips: (ids) => set({ selectedClipIds: new Set(ids) }),
    deselectAll: () => set({ selectedClipIds: new Set<string>() }),
    toggleSelectClip: (id) => set(s => {
      const next = new Set(s.selectedClipIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedClipIds: next }
    }),
    addToSelection: (ids) => set(s => {
      const next = new Set(s.selectedClipIds)
      ids.forEach(id => next.add(id))
      return { selectedClipIds: next }
    }),
    addMarker: (bar) => set(s => {
      const colors = ['#f59e0b','#06b6d4','#10b981','#ef4444','#8b5cf6','#ec4899']
      const color = colors[s.markers.length % colors.length]
      return {
        markers: [
          ...s.markers,
          { id: `marker-${Date.now()}`, bar, label: `Bar ${bar}`, color },
        ].sort((a, b) => a.bar - b.bar),
      }
    }),
    removeMarker: (id) => set(s => ({ markers: s.markers.filter(m => m.id !== id) })),
    moveMarker: (id, bar) => set(s => ({
      markers: s.markers.map(m => m.id === id ? { ...m, bar } : m).sort((a, b) => a.bar - b.bar),
    })),
  }))
