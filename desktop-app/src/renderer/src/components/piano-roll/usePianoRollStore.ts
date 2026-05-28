import { create } from 'zustand'
import type { PRNote, PRTool, SnapGrid, AutomationParam, ScaleMode, ScaleRoot } from './types'
import { DEFAULT_AUTO_PARAMS, SNAP_BEATS } from './types'
import { getScalePitches, snapPitchToScale, buildChord, getDiatonicChords, generateMelody } from '../../lib/musicTheory'
import type { ChordType } from '../../lib/musicTheory'
import { PreviewScheduler } from '../../audio/ClipPlaybackCoordinator'
import { MidiTrackNode } from '../../audio/tracks/MidiTrackNode'
import { getTrackManager, getTransport } from '../../audio'

let _uid = 1
const uid = () => `pr${_uid++}`

// Module-level preview scheduler (lazy-init on first use, re-created when track changes)
let _previewScheduler: PreviewScheduler | null = null
let _previewSchedulerNode: MidiTrackNode | null = null

function getPreviewSchedulerForTrack(trackId: string): PreviewScheduler | null {
  const trackMgr = getTrackManager()
  const node = trackMgr.getTrack(trackId)
  if (node instanceof MidiTrackNode) {
    // Re-create scheduler if the node changed (different track selected)
    if (node !== _previewSchedulerNode || !_previewScheduler) {
      _previewScheduler?.stop()
      _previewScheduler = new PreviewScheduler(node)
      _previewSchedulerNode = node
    }
    return _previewScheduler
  }
  // Fallback: find any available MIDI node
  const ids = trackMgr.getTrackIds()
  for (const id of ids) {
    const n = trackMgr.getTrack(id)
    if (n instanceof MidiTrackNode) {
      if (n !== _previewSchedulerNode || !_previewScheduler) {
        _previewScheduler?.stop()
        _previewScheduler = new PreviewScheduler(n)
        _previewSchedulerNode = n
      }
      return _previewScheduler
    }
  }
  return null
}

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
  scaleEnabled:    boolean
  scaleRoot:       ScaleRoot
  scaleMode:       ScaleMode
  aiPanelOpen:     boolean
  scalePanelOpen:  boolean

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
  // Scale
  setScaleEnabled(on: boolean): void
  setScaleRoot(root: ScaleRoot): void
  setScaleMode(mode: ScaleMode): void
  toggleAIPanel(): void
  toggleScalePanel(): void
  // Note properties
  setNoteGlide(id: string, glide: boolean): void
  setNoteProbability(id: string, prob: number): void
  setNoteChannel(id: string, channel: number): void
  // Edit operations
  quantize(grid: SnapGrid, strength: number): void
  humanize(amount: number): void
  randomize(count: number, bars: number): void
  snapToScale(): void
  // AI generation
  generateChord(rootMidi: number, type: ChordType, startBeat: number): void
  generateProgression(degrees: number[], beatsPerChord: number, octave: number): void
  generateMelodyAI(bars: number, density: 'sparse' | 'medium' | 'dense', octave: number): void
  // Preview playback
  isPreviewPlaying: boolean
  previewTrackId: string | null
  startPreview(trackId: string): void
  stopPreview(): void
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
  scaleEnabled:    false,
  scaleRoot:       'D',
  scaleMode:       'minor',
  aiPanelOpen:     false,
  scalePanelOpen:  false,
  isPreviewPlaying: false,
  previewTrackId:  null,

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
        selected: n.startBeat < beatB && n.startBeat + n.lengthBeats > beatA
               && n.pitch >= pitchLo  && n.pitch <= pitchHi,
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

  // ── Scale ────────────────────────────────────────────────────────────────
  setScaleEnabled(on)   { set({ scaleEnabled: on }) },
  setScaleRoot(root)    { set({ scaleRoot: root }) },
  setScaleMode(mode)    { set({ scaleMode: mode }) },
  toggleAIPanel()       { set(s => ({ aiPanelOpen: !s.aiPanelOpen })) },
  toggleScalePanel()    { set(s => ({ scalePanelOpen: !s.scalePanelOpen })) },

  // ── Note properties ──────────────────────────────────────────────────────
  setNoteGlide(id, glide) {
    set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, glide } : n) }))
  },
  setNoteProbability(id, prob) {
    set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, probability: Math.max(0, Math.min(100, prob)) } : n) }))
  },
  setNoteChannel(id, channel) {
    set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, channel: Math.max(0, Math.min(15, channel)) } : n) }))
  },

  // ── Quantize ─────────────────────────────────────────────────────────────
  quantize(grid, strength) {
    const snapVal = SNAP_BEATS[grid]
    if (snapVal === 0) return
    set(s => ({
      notes: s.notes.map(n => {
        if (!n.selected) return n
        const snapped   = Math.round(n.startBeat / snapVal) * snapVal
        const newStart  = n.startBeat + (snapped - n.startBeat) * strength
        return { ...n, startBeat: Math.max(0, newStart) }
      }),
    }))
  },

  // ── Humanize ─────────────────────────────────────────────────────────────
  humanize(amount) {
    const maxTimeDev = amount * 0.1   // ±0.1 beats max
    const maxVelDev  = amount * 15    // ±15 velocity max
    set(s => ({
      notes: s.notes.map((n, i) => {
        if (!n.selected) return n
        let seed = (i * 1664525 + 1013904223) | 0
        seed = (seed * 1664525 + 1013904223) | 0
        const tRand = ((seed >>> 0) / 0xFFFFFFFF - 0.5) * 2 * maxTimeDev
        seed = (seed * 1664525 + 1013904223) | 0
        const vRand = ((seed >>> 0) / 0xFFFFFFFF - 0.5) * 2 * maxVelDev
        return {
          ...n,
          startBeat: Math.max(0, n.startBeat + tRand),
          velocity:  Math.max(1, Math.min(127, Math.round(n.velocity + vRand))),
        }
      }),
    }))
  },

  // ── Randomize ────────────────────────────────────────────────────────────
  randomize(count, bars) {
    const { scaleRoot, scaleMode, scaleEnabled, defaultVelocity, defaultLength, timeSigTop } = get()
    const totalBeats     = bars * timeSigTop
    const scalePitches   = scaleEnabled ? getScalePitches(scaleRoot, scaleMode) : null
    const newNotes: PRNote[] = []
    let seed = Date.now() | 0
    for (let i = 0; i < count; i++) {
      seed = (seed * 1664525 + 1013904223) | 0
      const beat     = ((seed >>> 0) / 0xFFFFFFFF) * totalBeats
      seed = (seed * 1664525 + 1013904223) | 0
      const pitchBase = 48 + Math.floor(((seed >>> 0) / 0xFFFFFFFF) * 36)
      const pitch     = scalePitches
        ? snapPitchToScale(pitchBase, scaleRoot, scaleMode)
        : pitchBase
      seed = (seed * 1664525 + 1013904223) | 0
      const velocity  = 60 + Math.floor(((seed >>> 0) / 0xFFFFFFFF) * 60)
      newNotes.push({
        id: uid(), pitch, startBeat: beat, lengthBeats: defaultLength,
        velocity: Math.max(1, Math.min(127, velocity ?? defaultVelocity)),
        selected: true, muted: false,
      })
    }
    set(s => ({ notes: [...s.notes.map(n => ({ ...n, selected: false })), ...newNotes] }))
  },

  // ── Snap to scale ────────────────────────────────────────────────────────
  snapToScale() {
    const { scaleRoot, scaleMode } = get()
    set(s => ({
      notes: s.notes.map(n => {
        if (!n.selected) return n
        return { ...n, pitch: snapPitchToScale(n.pitch, scaleRoot, scaleMode) }
      }),
    }))
  },

  // ── Chord generator ──────────────────────────────────────────────────────
  generateChord(rootMidi, type, startBeat) {
    const { defaultVelocity } = get()
    const chord = buildChord(rootMidi, type)
    const newNotes: PRNote[] = chord.pitches.map((p, i) => ({
      id: uid(), pitch: p, startBeat,
      lengthBeats: 4,
      velocity:    i === 0 ? defaultVelocity : Math.max(1, defaultVelocity - 10),
      selected:    true, muted: false,
    }))
    set(s => ({ notes: [...s.notes.map(n => ({ ...n, selected: false })), ...newNotes] }))
  },

  // ── Progression generator ────────────────────────────────────────────────
  generateProgression(degrees, beatsPerChord, octave) {
    const { scaleRoot, scaleMode, defaultVelocity } = get()
    const diatonicChords = getDiatonicChords(scaleRoot, scaleMode)
    const newNotes: PRNote[] = []
    degrees.forEach((deg, idx) => {
      const chord     = diatonicChords[deg % 7]
      const startBeat = idx * beatsPerChord
      const basePitch = (octave + 1) * 12 + (chord.root % 12)
      chord.pitches.forEach((p, noteIdx) => {
        const pitch = basePitch + (p - chord.root)
        newNotes.push({
          id: uid(), pitch: Math.max(0, Math.min(127, pitch)),
          startBeat, lengthBeats: beatsPerChord,
          velocity: noteIdx === 0 ? defaultVelocity : Math.max(1, defaultVelocity - 12),
          selected: true, muted: false,
        })
      })
    })
    set(s => ({ notes: [...s.notes.map(n => ({ ...n, selected: false })), ...newNotes] }))
  },

  // ── Melody AI ────────────────────────────────────────────────────────────
  generateMelodyAI(bars, density, octave) {
    const { scaleRoot, scaleMode, timeSigTop } = get()
    const melodyNotes = generateMelody(scaleRoot, scaleMode, bars, timeSigTop, density, octave, Date.now() | 0)
    const newNotes: PRNote[] = melodyNotes.map(m => ({
      id: uid(), pitch: m.pitch, startBeat: m.beat,
      lengthBeats: m.lengthBeats, velocity: m.velocity,
      selected: true, muted: false,
    }))
    set(s => ({ notes: [...s.notes.map(n => ({ ...n, selected: false })), ...newNotes] }))
  },

  // ── Preview playback ─────────────────────────────────────────────────────
  startPreview(trackId: string) {
    const { notes } = get()
    const scheduler = getPreviewSchedulerForTrack(trackId)
    if (!scheduler) return
    const bpm = getTransport().bpm
    scheduler.play(notes.map(n => ({
      pitch:      n.pitch,
      velocity:   n.velocity,
      startBeat:  n.startBeat,
      lengthBeats: n.lengthBeats,
    })), bpm)
    set({ isPreviewPlaying: true, previewTrackId: trackId })
  },

  stopPreview() {
    if (_previewScheduler) _previewScheduler.stop()
    set({ isPreviewPlaying: false, previewTrackId: null })
  },
}))
