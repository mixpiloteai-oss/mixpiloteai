// ─── audioEditorStore ─────────────────────────────────────────────────────────
// Zustand store for the sample / audio editor state.

import { create } from 'zustand'
import { AudioEditBuffer }  from '../audio/editor/AudioEditBuffer'
import { AudioEditorEngine } from '../audio/editor/AudioEditorEngine'
import type { BpmResult }  from '../audio/editor/BpmDetector'

export type EditorMode = 'destructive' | 'non-destructive'

export interface WarpMarker {
  id:           string
  sampleOffset: number
  beatPosition: number
}

interface AudioEditorState {
  engine:           AudioEditorEngine | null
  sampleRate:       number
  channels:         number
  selectionStart:   number | null
  selectionEnd:     number | null
  cursorPosition:   number
  zoomLevel:        number
  scrollOffset:     number
  warpMarkers:      WarpMarker[]
  transientMarkers: number[]
  detectedBpm:      BpmResult | null
  mode:             EditorMode
  clipboardData:    Float32Array[] | null

  loadBuffer:       (data: Float32Array[], sampleRate: number) => void
  setSelection:     (start: number | null, end: number | null) => void
  setCursor:        (pos: number) => void
  setZoom:          (level: number) => void
  setScroll:        (offset: number) => void
  setMode:          (mode: EditorMode) => void
  setTransients:    (positions: number[]) => void
  setBpm:           (result: BpmResult | null) => void
  addWarpMarker:    (sampleOffset: number, beatPosition: number) => void
  removeWarpMarker: (id: string) => void
  invalidate:       () => void  // triggers re-render
}

export const useAudioEditorStore = create<AudioEditorState>((set) => ({
  engine:           null,
  sampleRate:       44100,
  channels:         2,
  selectionStart:   null,
  selectionEnd:     null,
  cursorPosition:   0,
  zoomLevel:        512,
  scrollOffset:     0,
  warpMarkers:      [],
  transientMarkers: [],
  detectedBpm:      null,
  mode:             'non-destructive',
  clipboardData:    null,

  loadBuffer(data, sampleRate) {
    const buf    = new AudioEditBuffer(data.length, data)
    const engine = new AudioEditorEngine(buf)
    set({ engine, sampleRate, channels: data.length, cursorPosition: 0, selectionStart: null, selectionEnd: null })
  },

  setSelection:     (start, end)   => set({ selectionStart: start, selectionEnd: end }),
  setCursor:        (pos)          => set({ cursorPosition: pos }),
  setZoom:          (level)        => set({ zoomLevel: Math.max(1, level) }),
  setScroll:        (offset)       => set({ scrollOffset: Math.max(0, offset) }),
  setMode:          (mode)         => set({ mode }),
  setTransients:    (positions)    => set({ transientMarkers: positions }),
  setBpm:           (result)       => set({ detectedBpm: result }),

  addWarpMarker(sampleOffset, beatPosition) {
    const id = `warp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    set(s => ({ warpMarkers: [...s.warpMarkers, { id, sampleOffset, beatPosition }] }))
  },

  removeWarpMarker(id) {
    set(s => ({ warpMarkers: s.warpMarkers.filter(m => m.id !== id) }))
  },

  invalidate() {
    set(s => ({ cursorPosition: s.cursorPosition }))
  },
}))
