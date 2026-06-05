import { create } from 'zustand'
import type { PRNote, PRTool, SnapGrid, AutomationParam, AutomationPoint, ScaleMode, ScaleRoot } from './types'
import { DEFAULT_AUTO_PARAMS, SNAP_BEATS } from './types'
import { getScalePitches, snapPitchToScale, buildChord, getDiatonicChords, generateMelody } from '../../lib/musicTheory'
import type { ChordType } from '../../lib/musicTheory'
import { PreviewScheduler } from '../../audio/ClipPlaybackCoordinator'
import { MidiTrackNode } from '../../audio/tracks/MidiTrackNode'
import { getTrackManager, getTransport, getClipPlaybackCoordinator } from '../../audio'
import { transpose, invert, reverse, legato, staccato } from '../../audio/midi/MidiNoteTransformer'
import { MidiQuantize } from '../../audio/midi/MidiQuantize'
import type { GridDivision } from '../../audio/midi/MidiQuantize'
import { useHistoryStore } from '../../store/historyStore'

// Map SnapGrid values to MidiQuantize GridDivision values
const SNAP_TO_GRID_DIVISION: Partial<Record<SnapGrid, GridDivision>> = {
  '1/32': '1/32',
  '1/16': '1/16',
  '1/8':  '1/8',
  '1/4':  '1/4',
  '1/2':  '1/4',   // no 1/2 in GridDivision, use 1/4 as closest
  '1/1':  '1/4',   // no 1/1 in GridDivision, use 1/4 as closest
}

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
  // Clipboard
  clipboard:       PRNote[] | null
  // Note fold
  noteFoldEnabled: boolean
  // Arp panel
  arpPanelOpen:    boolean
  // Swing
  swingAmount:     number

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
  addAutoPoint(paramId: string, beat: number, value: number): void
  moveAutoPoint(paramId: string, pointId: string, beat: number, value: number): void
  removeAutoPoint(paramId: string, pointId: string): void
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
  // Clipboard
  copySelected(): void
  cutSelected(): void
  paste(atBeat: number): void
  // Velocity curves
  applyVelocityCurve(
    curve: 'ramp-up' | 'ramp-down' | 'sine' | 'random',
    startVel: number,
    endVel: number,
  ): void
  // Note fold
  toggleNoteFold(): void
  // Arp panel
  toggleArpPanel(): void
  // Swing
  setSwingAmount(v: number): void
  // Transformers
  transposeSelected(semitones: number): void
  invertSelected(pivotPitch?: number): void
  reverseSelected(): void
  legatoSelected(): void
  staccatoSelected(fraction?: number): void
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
  clipboard:       null,
  noteFoldEnabled: false,
  arpPanelOpen:    false,
  swingAmount:     0,

  addNote(data) {
    const before = get().notes
    const note: PRNote = { ...data, id: uid(), selected: false, muted: false }
    const after = [...before, note]
    set({ notes: after })
    useHistoryStore.getState().push({
      label:  'Add note',
      domain: 'midi',
      undo:   () => usePianoRollStore.getState().loadNotes(before),
      redo:   () => usePianoRollStore.getState().loadNotes(after),
    })
    return note
  },

  removeNote(id) {
    const before = get().notes
    const after = before.filter(n => n.id !== id)
    set({ notes: after })
    useHistoryStore.getState().push({
      label:  'Remove note',
      domain: 'midi',
      undo:   () => usePianoRollStore.getState().loadNotes(before),
      redo:   () => usePianoRollStore.getState().loadNotes(after),
    })
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
  deleteSelected() {
    const before = get().notes
    const after = before.filter(n => !n.selected)
    set({ notes: after })
    useHistoryStore.getState().push({
      label:  'Delete notes',
      domain: 'midi',
      undo:   () => usePianoRollStore.getState().loadNotes(before),
      redo:   () => usePianoRollStore.getState().loadNotes(after),
    })
  },

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

  addAutoPoint(paramId, beat, value) {
    const pointId = `ap${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newPoint: AutomationPoint = { id: pointId, beat, value }
    set(s => ({
      autoParams: s.autoParams.map(p =>
        p.id === paramId
          ? { ...p, points: [...p.points, newPoint].sort((a, b) => a.beat - b.beat) }
          : p,
      ),
    }))
  },

  moveAutoPoint(paramId, pointId, beat, value) {
    set(s => ({
      autoParams: s.autoParams.map(p =>
        p.id === paramId
          ? {
              ...p,
              points: p.points
                .map(pt => pt.id === pointId ? { ...pt, beat, value } : pt)
                .sort((a, b) => a.beat - b.beat),
            }
          : p,
      ),
    }))
  },

  removeAutoPoint(paramId, pointId) {
    set(s => ({
      autoParams: s.autoParams.map(p =>
        p.id === paramId
          ? { ...p, points: p.points.filter(pt => pt.id !== pointId) }
          : p,
      ),
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
    if (grid === 'off') return
    const gridDiv = SNAP_TO_GRID_DIVISION[grid]
    if (!gridDiv) return
    const { notes: before, swingAmount } = get()
    const hasSelection = before.some(n => n.selected)
    const quantized = MidiQuantize.apply(before, {
      grid:          gridDiv,
      strength,
      swing:         swingAmount,
      quantizeStart: true,
      quantizeEnd:   false,
      selectedOnly:  hasSelection,
    })
    set({ notes: quantized })
    const after = quantized
    useHistoryStore.getState().push({
      label:  'Quantize notes',
      domain: 'midi',
      undo:   () => usePianoRollStore.getState().loadNotes(before),
      redo:   () => usePianoRollStore.getState().loadNotes(after),
    })
  },

  // ── Humanize ─────────────────────────────────────────────────────────────
  humanize(amount) {
    const before = get().notes
    const maxTimeDev = amount * 0.1   // ±0.1 beats max
    const maxVelDev  = amount * 15    // ±15 velocity max
    const after = before.map((n, i) => {
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
    })
    set({ notes: after })
    useHistoryStore.getState().push({
      label:  'Humanize notes',
      domain: 'midi',
      undo:   () => usePianoRollStore.getState().loadNotes(before),
      redo:   () => usePianoRollStore.getState().loadNotes(after),
    })
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

  // ── Clipboard ────────────────────────────────────────────────────────────
  copySelected() {
    const { notes } = get()
    const sel = notes.filter(n => n.selected)
    if (!sel.length) return
    const minStart = Math.min(...sel.map(n => n.startBeat))
    const clipped = sel.map(n => ({ ...n, startBeat: n.startBeat - minStart }))
    set({ clipboard: clipped })
  },

  cutSelected() {
    get().copySelected()
    get().deleteSelected()
  },

  paste(atBeat) {
    const { clipboard } = get()
    if (!clipboard || clipboard.length === 0) return
    const before = get().notes
    const pasted: PRNote[] = clipboard.map(n => ({
      ...n,
      id:        uid(),
      startBeat: atBeat + n.startBeat,
      selected:  true,
    }))
    const after = [
      ...before.map(n => ({ ...n, selected: false })),
      ...pasted,
    ]
    set({ notes: after })
    useHistoryStore.getState().push({
      label:  'Paste notes',
      domain: 'midi',
      undo:   () => usePianoRollStore.getState().loadNotes(before),
      redo:   () => usePianoRollStore.getState().loadNotes(after),
    })
  },

  // ── Velocity curves ──────────────────────────────────────────────────────
  applyVelocityCurve(curve, startVel, endVel) {
    const { notes } = get()
    const sel = [...notes.filter(n => n.selected)].sort((a, b) => a.startBeat - b.startBeat)
    if (sel.length < 2) return
    const N = sel.length
    const velMap = new Map<string, number>()
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1)
      let vel: number
      if (curve === 'ramp-up' || curve === 'ramp-down') {
        vel = startVel + (endVel - startVel) * t
      } else if (curve === 'sine') {
        vel = startVel + (endVel - startVel) * Math.sin(t * Math.PI)
      } else {
        vel = startVel + Math.random() * (endVel - startVel)
      }
      vel = Math.round(Math.max(1, Math.min(127, vel)))
      velMap.set(sel[i]!.id, vel)
    }
    set(s => ({
      notes: s.notes.map(n => velMap.has(n.id) ? { ...n, velocity: velMap.get(n.id)! } : n),
    }))
  },

  // ── Note fold ────────────────────────────────────────────────────────────
  toggleNoteFold() {
    set(s => ({ noteFoldEnabled: !s.noteFoldEnabled }))
  },

  // ── Arp panel ────────────────────────────────────────────────────────────
  toggleArpPanel() {
    set(s => ({ arpPanelOpen: !s.arpPanelOpen }))
  },

  // ── Swing ────────────────────────────────────────────────────────────────
  setSwingAmount(v) {
    const clamped = Math.max(0, Math.min(0.5, v))
    set({ swingAmount: clamped })
    try {
      getClipPlaybackCoordinator().setSwing(clamped)
    } catch {
      // coordinator may not be initialised yet — ignore
    }
  },

  // ── Transformers ─────────────────────────────────────────────────────────
  transposeSelected(semitones) {
    const { notes } = get()
    const before = notes
    const sel = notes.filter(n => n.selected)
    if (!sel.length) return
    const transformed = transpose(sel, semitones)
    const map = new Map(transformed.map(n => [n.id, n]))
    const after = notes.map(n => map.has(n.id) ? map.get(n.id)! : n)
    set({ notes: after })
    useHistoryStore.getState().push({
      label:  'Transpose notes',
      domain: 'midi',
      undo:   () => usePianoRollStore.getState().loadNotes(before),
      redo:   () => usePianoRollStore.getState().loadNotes(after),
    })
  },

  invertSelected(pivotPitch) {
    const { notes } = get()
    const sel = notes.filter(n => n.selected)
    if (!sel.length) return
    const transformed = invert(sel, pivotPitch)
    const map = new Map(transformed.map(n => [n.id, n]))
    set(s => ({ notes: s.notes.map(n => map.has(n.id) ? map.get(n.id)! : n) }))
  },

  reverseSelected() {
    const { notes } = get()
    const sel = notes.filter(n => n.selected)
    if (!sel.length) return
    const transformed = reverse(sel)
    const map = new Map(transformed.map(n => [n.id, n]))
    set(s => ({ notes: s.notes.map(n => map.has(n.id) ? map.get(n.id)! : n) }))
  },

  legatoSelected() {
    const { notes } = get()
    const sel = notes.filter(n => n.selected)
    if (!sel.length) return
    const transformed = legato(sel)
    const map = new Map(transformed.map(n => [n.id, n]))
    set(s => ({ notes: s.notes.map(n => map.has(n.id) ? map.get(n.id)! : n) }))
  },

  staccatoSelected(fraction) {
    const { notes } = get()
    const sel = notes.filter(n => n.selected)
    if (!sel.length) return
    const transformed = staccato(sel, fraction)
    const map = new Map(transformed.map(n => [n.id, n]))
    set(s => ({ notes: s.notes.map(n => map.has(n.id) ? map.get(n.id)! : n) }))
  },
}))
