import { create } from 'zustand'
import type { MidiDevice } from '../audio/midi/MidiDeviceManager'
import type { SeqStep, SeqTrack } from '../audio/midi/StepSequencerEngine'

// Re-export for consumers
export type { SeqStep, SeqTrack }

// ─── Drum Rack ────────────────────────────────────────────────────────────────

export interface DrumPad {
  id:       string
  name:     string
  note:     number
  channel:  number
  color:    string
  velocity: number
  muted:    boolean
  soloed:   boolean
  active:   boolean
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export type PresetCategory = 'arp' | 'seq' | 'mapping' | 'drumrack' | 'full'

export interface MidiPreset {
  id:        string
  name:      string
  category:  PresetCategory
  createdAt: number
  // eslint-disable-next-line @typescript-eslint/ban-types
  data:      Record<string, unknown>
}

// ─── MIDI assignment ───────────────────────────────────────────────────────────

export interface MidiAssignment {
  targetId:    string
  cc:          number
  channel:     number
  minIn:       number
  maxIn:       number
  minOut:      number
  maxOut:      number
  pickupMode:  boolean
}

// ─── Arpeggiator ──────────────────────────────────────────────────────────────

export type ArpMode = 'up' | 'down' | 'up-down' | 'down-up' | 'random' | 'order' | 'chord'
export type ArpRate = '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1/1'

export interface ArpState {
  enabled:     boolean
  mode:        ArpMode
  rate:        ArpRate
  octaves:     number   // 1-4
  gate:        number   // 0-1
  syncToHost:  boolean
  heldNotes:   number[]
  currentStep: number
  channel:     number   // 0-15
}

// ─── Store state ──────────────────────────────────────────────────────────────

interface MidiState {
  devices:          MidiDevice[]
  selectedInputId:  string | null
  selectedOutputId: string | null
  midiInitialized:  boolean
  midiError:        string | null
  isLearning:       boolean
  learnTargetId:    string | null
  learnTargetLabel: string | null
  assignments:      MidiAssignment[]
  arp:              ArpState
  // ── Step Sequencer ──────────────────────────────────────────────────────────
  seqTracks:        SeqTrack[]
  stepCount:        number
  seqPlaying:       boolean
  seqCurrentStep:   number
  seqBpm:           number
  seqSyncToHost:    boolean
  // ── Drum Rack ───────────────────────────────────────────────────────────────
  drumPads:         DrumPad[]
  // ── Presets ─────────────────────────────────────────────────────────────────
  presets:          MidiPreset[]
}

// ─── Store actions ────────────────────────────────────────────────────────────

interface MidiActions {
  setDevices(devices: MidiDevice[]): void
  setSelectedInput(id: string | null): void
  setSelectedOutput(id: string | null): void
  setMidiInitialized(v: boolean): void
  setMidiError(err: string | null): void
  setLearning(active: boolean, targetId?: string | null, label?: string | null): void
  addAssignment(a: MidiAssignment): void
  updateAssignment(targetId: string, patch: Partial<MidiAssignment>): void
  removeAssignment(targetId: string): void
  importAssignments(list: MidiAssignment[]): void
  setArpEnabled(v: boolean): void
  setArpMode(mode: ArpMode): void
  setArpRate(rate: ArpRate): void
  setArpOctaves(n: number): void
  setArpGate(g: number): void
  setArpSyncToHost(v: boolean): void
  setArpStep(step: number): void
  setArpChannel(channel: number): void
  setArpHeldNotes(notes: number[]): void
  // ── Step Sequencer ───────────────────────────────────────────────────────────
  setSeqStep(trackId: string, stepIdx: number, patch: Partial<SeqStep>): void
  setSeqTrackMute(trackId: string, muted: boolean): void
  setSeqTrackSolo(trackId: string, soloed: boolean): void
  setSeqPlaying(v: boolean): void
  setSeqCurrentStep(step: number): void
  setSeqBpm(bpm: number): void
  setSeqSyncToHost(v: boolean): void
  addSeqTrack(): void
  removeSeqTrack(trackId: string): void
  resetSeq(): void
  setStepCount(n: number): void
  // ── Drum Rack ────────────────────────────────────────────────────────────────
  setDrumPadActive(padId: string, active: boolean): void
  setDrumPadVelocity(padId: string, velocity: number): void
  setDrumPadMute(padId: string, muted: boolean): void
  setDrumPadSolo(padId: string, soloed: boolean): void
  setDrumPadNote(padId: string, note: number): void
  // ── Presets ──────────────────────────────────────────────────────────────────
  savePreset(name: string, category: PresetCategory): void
  loadPreset(id: string): void
  deletePreset(id: string): void
}

// ─── Default arp state ────────────────────────────────────────────────────────

const DEFAULT_ARP: ArpState = {
  enabled:     false,
  mode:        'up',
  rate:        '1/8',
  octaves:     1,
  gate:        0.8,
  syncToHost:  false,
  heldNotes:   [],
  currentStep: 0,
  channel:     0,
}

// ─── Default seq / drum / preset helpers ─────────────────────────────────────

function makeDefaultStep(): SeqStep {
  return { active: false, pitch: 60, velocity: 100, gate: 0.8, probability: 100, accent: false }
}

function makeDefaultTrack(idx: number): SeqTrack {
  const colors = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']
  return {
    id:      `track-${idx}-${Date.now()}`,
    name:    `T${idx + 1}`,
    channel: idx % 16,
    steps:   Array.from({ length: 16 }, makeDefaultStep),
    muted:   false,
    soloed:  false,
    color:   colors[idx % colors.length] ?? '#7c3aed',
  }
}

const DEFAULT_DRUM_PADS: DrumPad[] = [
  { id: 'pad-0',  name: 'KICK',     note: 36, channel: 9, color: '#ef4444', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-1',  name: 'SNARE',    note: 38, channel: 9, color: '#f97316', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-2',  name: 'HI-HAT',  note: 42, channel: 9, color: '#eab308', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-3',  name: 'OPN HH',  note: 46, channel: 9, color: '#84cc16', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-4',  name: 'CRASH',   note: 49, channel: 9, color: '#10b981', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-5',  name: 'RIDE',    note: 51, channel: 9, color: '#06b6d4', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-6',  name: 'FLOOR',   note: 41, channel: 9, color: '#3b82f6', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-7',  name: 'LO TOM',  note: 45, channel: 9, color: '#8b5cf6', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-8',  name: 'HI TOM',  note: 50, channel: 9, color: '#ec4899', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-9',  name: 'COWBELL', note: 56, channel: 9, color: '#f43f5e', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-10', name: 'CLAP',    note: 39, channel: 9, color: '#a855f7', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-11', name: 'TAMB',    note: 54, channel: 9, color: '#0ea5e9', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-12', name: 'SHAKER',  note: 82, channel: 9, color: '#22c55e', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-13', name: 'CLAVE',   note: 75, channel: 9, color: '#facc15', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-14', name: 'AGOGO',   note: 67, channel: 9, color: '#fb923c', velocity: 100, muted: false, soloed: false, active: false },
  { id: 'pad-15', name: 'WHISTLE', note: 71, channel: 9, color: '#a78bfa', velocity: 100, muted: false, soloed: false, active: false },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMidiStore = create<MidiState & MidiActions>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────────
  devices:          [],
  selectedInputId:  null,
  selectedOutputId: null,
  midiInitialized:  false,
  midiError:        null,
  isLearning:       false,
  learnTargetId:    null,
  learnTargetLabel: null,
  assignments:      [],
  arp:              { ...DEFAULT_ARP },
  // seq
  seqTracks:        [makeDefaultTrack(0), makeDefaultTrack(1), makeDefaultTrack(2), makeDefaultTrack(3)],
  stepCount:        16,
  seqPlaying:       false,
  seqCurrentStep:   0,
  seqBpm:           128,
  seqSyncToHost:    false,
  // drum
  drumPads:         DEFAULT_DRUM_PADS,
  // presets
  presets:          [],

  // ── Device actions ───────────────────────────────────────────────────────────
  setDevices:          (devices)       => set({ devices }),
  setSelectedInput:    (id)            => set({ selectedInputId: id }),
  setSelectedOutput:   (id)            => set({ selectedOutputId: id }),
  setMidiInitialized:  (v)             => set({ midiInitialized: v }),
  setMidiError:        (err)           => set({ midiError: err }),

  // ── Learn actions ────────────────────────────────────────────────────────────
  setLearning: (active, targetId = null, label = null) =>
    set({ isLearning: active, learnTargetId: targetId, learnTargetLabel: label }),

  // ── Assignment actions ───────────────────────────────────────────────────────
  addAssignment: (a) =>
    set((s) => ({
      assignments: s.assignments.some(x => x.targetId === a.targetId)
        ? s.assignments.map(x => x.targetId === a.targetId ? a : x)
        : [...s.assignments, a],
    })),

  updateAssignment: (targetId, patch) =>
    set((s) => ({
      assignments: s.assignments.map(x =>
        x.targetId === targetId ? { ...x, ...patch } : x,
      ),
    })),

  removeAssignment: (targetId) =>
    set((s) => ({ assignments: s.assignments.filter(x => x.targetId !== targetId) })),

  importAssignments: (list) => set({ assignments: list }),

  // ── Arp actions ──────────────────────────────────────────────────────────────
  setArpEnabled:    (v)       => set((s) => ({ arp: { ...s.arp, enabled: v } })),
  setArpMode:       (mode)    => set((s) => ({ arp: { ...s.arp, mode } })),
  setArpRate:       (rate)    => set((s) => ({ arp: { ...s.arp, rate } })),
  setArpOctaves:    (n)       => set((s) => ({ arp: { ...s.arp, octaves: n } })),
  setArpGate:       (g)       => set((s) => ({ arp: { ...s.arp, gate: g } })),
  setArpSyncToHost: (v)       => set((s) => ({ arp: { ...s.arp, syncToHost: v } })),
  setArpStep:       (step)    => set((s) => ({ arp: { ...s.arp, currentStep: step } })),
  setArpChannel:    (channel) => set((s) => ({ arp: { ...s.arp, channel } })),
  setArpHeldNotes:  (notes)   => set((s) => ({ arp: { ...s.arp, heldNotes: notes } })),

  // ── Step Sequencer actions ───────────────────────────────────────────────────
  setSeqStep: (trackId, stepIdx, patch) =>
    set((s) => ({
      seqTracks: s.seqTracks.map(t =>
        t.id !== trackId ? t : {
          ...t,
          steps: t.steps.map((st, i) => i === stepIdx ? { ...st, ...patch } : st),
        },
      ),
    })),

  setSeqTrackMute: (trackId, muted) =>
    set((s) => ({ seqTracks: s.seqTracks.map(t => t.id === trackId ? { ...t, muted } : t) })),

  setSeqTrackSolo: (trackId, soloed) =>
    set((s) => ({ seqTracks: s.seqTracks.map(t => t.id === trackId ? { ...t, soloed } : t) })),

  setSeqPlaying:     (v)    => set({ seqPlaying: v }),
  setSeqCurrentStep: (step) => set({ seqCurrentStep: step }),
  setSeqBpm:         (bpm)  => set({ seqBpm: bpm }),
  setSeqSyncToHost:  (v)    => set({ seqSyncToHost: v }),

  addSeqTrack: () =>
    set((s) => {
      if (s.seqTracks.length >= 8) return s
      const newTrack = makeDefaultTrack(s.seqTracks.length)
      return {
        seqTracks: [
          ...s.seqTracks,
          { ...newTrack, steps: Array.from({ length: s.stepCount }, makeDefaultStep) },
        ],
      }
    }),

  removeSeqTrack: (trackId) =>
    set((s) => {
      if (s.seqTracks.length <= 1) return s
      return { seqTracks: s.seqTracks.filter(t => t.id !== trackId) }
    }),

  resetSeq: () =>
    set((s) => ({
      seqTracks: s.seqTracks.map(t => ({
        ...t,
        steps: Array.from({ length: s.stepCount }, makeDefaultStep),
      })),
      seqCurrentStep: 0,
      seqPlaying: false,
    })),

  setStepCount: (n) =>
    set((s) => ({
      stepCount: n,
      seqTracks: s.seqTracks.map(t => ({
        ...t,
        steps: Array.from({ length: n }, (_, i) => t.steps[i] ?? makeDefaultStep()),
      })),
    })),

  // ── Drum Rack actions ────────────────────────────────────────────────────────
  setDrumPadActive:   (padId, active)   => set((s) => ({ drumPads: s.drumPads.map(p => p.id === padId ? { ...p, active } : p) })),
  setDrumPadVelocity: (padId, velocity) => set((s) => ({ drumPads: s.drumPads.map(p => p.id === padId ? { ...p, velocity } : p) })),
  setDrumPadMute:     (padId, muted)    => set((s) => ({ drumPads: s.drumPads.map(p => p.id === padId ? { ...p, muted } : p) })),
  setDrumPadSolo:     (padId, soloed)   => set((s) => ({ drumPads: s.drumPads.map(p => p.id === padId ? { ...p, soloed } : p) })),
  setDrumPadNote:     (padId, note)     => set((s) => ({ drumPads: s.drumPads.map(p => p.id === padId ? { ...p, note } : p) })),

  // ── Preset actions ───────────────────────────────────────────────────────────
  savePreset: (name, category) => {
    const s = get()
    const preset: MidiPreset = {
      id:        `preset-${Date.now()}`,
      name,
      category,
      createdAt: Date.now(),
      data: {
        seqTracks:     s.seqTracks,
        stepCount:     s.stepCount,
        seqBpm:        s.seqBpm,
        seqSyncToHost: s.seqSyncToHost,
        drumPads:      s.drumPads,
        arp:           s.arp,
        assignments:   s.assignments,
      },
    }
    set((st) => ({ presets: [...st.presets, preset] }))
  },

  loadPreset: (id) => {
    const preset = get().presets.find(p => p.id === id)
    if (!preset) return
    const d = preset.data
    set({
      ...(d['seqTracks']     !== undefined ? { seqTracks:     d['seqTracks']     as SeqTrack[]    } : {}),
      ...(d['stepCount']     !== undefined ? { stepCount:     d['stepCount']     as number        } : {}),
      ...(d['seqBpm']        !== undefined ? { seqBpm:        d['seqBpm']        as number        } : {}),
      ...(d['seqSyncToHost'] !== undefined ? { seqSyncToHost: d['seqSyncToHost'] as boolean       } : {}),
      ...(d['drumPads']      !== undefined ? { drumPads:      d['drumPads']      as DrumPad[]     } : {}),
      ...(d['arp']           !== undefined ? { arp:           d['arp']           as ArpState      } : {}),
      ...(d['assignments']   !== undefined ? { assignments:   d['assignments']   as MidiAssignment[] } : {}),
    })
  },

  deletePreset: (id) =>
    set((s) => ({ presets: s.presets.filter(p => p.id !== id) })),
}))
