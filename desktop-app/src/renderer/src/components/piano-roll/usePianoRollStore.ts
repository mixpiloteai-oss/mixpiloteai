import { create } from 'zustand'
import type { PRNote, PRTool, SnapGrid, AutomationParam } from './types'
import { DEFAULT_AUTO_PARAMS } from './types'

let _uid = 1
const uid = () => `pr${_uid++}`

const mk = (pitch: number, start: number, len: number, vel: number): PRNote => ({
  id: uid(), pitch, startBeat: start, lengthBeats: len,
  velocity: vel, selected: false, muted: false,
})

// D-minor hardtek bassline seed — 4 bars × 4 beats
const SEED: PRNote[] = [
  mk(50, 0,     0.25, 110), mk(50, 0.5,  0.25, 90),  mk(53, 1,    0.25, 100),
  mk(57, 1.5,   0.5,  95),  mk(55, 2.5,  0.25, 88),  mk(53, 3,    0.25, 95),
  mk(50, 4,     0.25, 108), mk(52, 4.5,  0.25, 88),  mk(53, 5,    0.5,  102),
  mk(55, 6,     0.25, 96),  mk(57, 6.5,  0.5,  92),  mk(55, 7.5,  0.25, 85),
  mk(50, 8,     0.25, 112), mk(50, 8.25, 0.25, 82),  mk(53, 9,    0.25, 100),
  mk(57, 9.5,   1,    98),  mk(55, 11,   0.25, 90),  mk(53, 11.5, 0.25, 87),
  mk(50, 12,    0.25, 106), mk(52, 12.5, 0.25, 87),  mk(55, 13,   0.25, 99),
  mk(57, 13.5,  0.25, 93),  mk(55, 14,   0.25, 90),  mk(53, 14.5, 0.25, 88),
  mk(52, 15,    0.75, 95),  mk(50, 15.75,0.25, 80),
]

export interface PianoRollState {
  notes:           PRNote[]
  tool:            PRTool
  snap:            SnapGrid
  zoomX:           number   // px per beat
  zoomY:           number   // px per semitone
  scrollX:         number
  scrollY:         number
  defaultVelocity: number
  defaultLength:   number   // beats
  totalBeats:      number
  timeSigTop:      number
  autoParams:      AutomationParam[]

  addNote(data: Omit<PRNote, 'id' | 'selected' | 'muted'>): PRNote
  removeNote(id: string): void
  removeNotes(ids: string[]): void
  updateNote(id: string, patch: Partial<PRNote>): void
  moveSelected(dBeat: number, dPitch: number): void
  resizeNote(id: string, len: number): void
  selectNote(id: string, additive: boolean): void
  selectInRect(beatA: number, beatB: number, pitchLo: number, pitchHi: number): void
  selectAll(): void
  deselectAll(): void
  deleteSelected(): void
  duplicateSelected(): void
  setTool(t: PRTool): void
  setSnap(s: SnapGrid): void
  setZoom(x: number, y: number): void
  setScroll(x: number, y: number): void
  setVelocity(id: string, v: number): void
  loadNotes(notes: PRNote[]): void
  toggleAutoParam(id: string): void
}

export const usePianoRollStore = create<PianoRollState>((set, get) => ({
  notes:           SEED,
  tool:            'pencil',
  snap:            '1/16',
  zoomX:           64,
  zoomY:           14,
  scrollX:         0,
  scrollY:         700,   // starts showing ~C3–C5 range
  defaultVelocity: 100,
  defaultLength:   0.25,
  totalBeats:      64,
  timeSigTop:      4,
  autoParams:      DEFAULT_AUTO_PARAMS,

  addNote(data) {
    const note: PRNote = { ...data, id: uid(), selected: false, muted: false }
    set(s => ({ notes: [...s.notes, note] }))
    return note
  },

  removeNote(id) {
    set(s => ({ notes: s.notes.filter(n => n.id !== id) }))
  },

  removeNotes(ids) {
    const s = new Set(ids)
    set(st => ({ notes: st.notes.filter(n => !s.has(n.id)) }))
  },

  updateNote(id, patch) {
    set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...patch } : n) }))
  },

  moveSelected(dBeat, dPitch) {
    set(s => ({
      notes: s.notes.map(n => {
        if (!n.selected) return n
        return {
          ...n,
          startBeat: Math.max(0, n.startBeat + dBeat),
          pitch:     Math.max(0, Math.min(127, n.pitch + dPitch)),
        }
      }),
    }))
  },

  resizeNote(id, len) {
    const min = SNAP_BEATS[get().snap] || 0.0625
    set(s => ({
      notes: s.notes.map(n => n.id === id ? { ...n, lengthBeats: Math.max(min, len) } : n),
    }))
  },

  selectNote(id, additive) {
    set(s => ({
      notes: s.notes.map(n => ({
        ...n,
        selected: n.id === id ? true : additive ? n.selected : false,
      })),
    }))
  },

  selectInRect(beatA, beatB, pitchLo, pitchHi) {
    set(s => ({
      notes: s.notes.map(n => ({
        ...n,
        selected: n.startBeat >= beatA && n.startBeat + n.lengthBeats <= beatB
               && n.pitch >= pitchLo   && n.pitch <= pitchHi,
      })),
    }))
  },

  selectAll()    { set(s => ({ notes: s.notes.map(n => ({ ...n, selected: true  })) })) },
  deselectAll()  { set(s => ({ notes: s.notes.map(n => ({ ...n, selected: false })) })) },
  deleteSelected(){ set(s => ({ notes: s.notes.filter(n => !n.selected) })) },

  duplicateSelected() {
    const { notes } = get()
    const sel = notes.filter(n => n.selected)
    if (!sel.length) return
    const maxEnd  = Math.max(...sel.map(n => n.startBeat + n.lengthBeats))
    const minStart = Math.min(...sel.map(n => n.startBeat))
    const offset  = maxEnd - minStart
    const dupes   = sel.map(n => ({ ...n, id: uid(), startBeat: n.startBeat + offset, selected: true }))
    set(s => ({
      notes: [...s.notes.map(n => ({ ...n, selected: false })), ...dupes],
    }))
  },

  setTool(t)  { set({ tool: t }) },
  setSnap(s)  { set({ snap: s }) },
  setZoom(x, y) {
    set({ zoomX: Math.max(16, Math.min(400, x)), zoomY: Math.max(6, Math.min(36, y)) })
  },
  setScroll(x, y) {
    const { totalBeats, zoomX, zoomY } = get()
    set({
      scrollX: Math.max(0, Math.min(totalBeats * zoomX, x)),
      scrollY: Math.max(0, Math.min(128 * zoomY, y)),
    })
  },
  setVelocity(id, v) {
    set(s => ({
      notes: s.notes.map(n => n.id === id ? { ...n, velocity: Math.max(1, Math.min(127, v)) } : n),
    }))
  },
  loadNotes(notes) {
    set({ notes: notes.map(n => ({ ...n, selected: false, muted: false })) })
  },
  toggleAutoParam(id) {
    set(s => ({
      autoParams: s.autoParams.map(p => p.id === id ? { ...p, visible: !p.visible } : p),
    }))
  },
}))
