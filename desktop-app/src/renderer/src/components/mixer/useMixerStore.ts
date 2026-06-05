import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EQBand {
  freq:    number    // Hz
  gain:    number    // dB (-18..+18)
  q:       number    // 0.1..10
  type:    'lowshelf' | 'peak' | 'highshelf' | 'highpass' | 'lowpass'
  enabled: boolean
}

export interface InsertSlot {
  id:      string
  name:    string
  enabled: boolean
  color:   string
}

export interface MixerSend {
  busId:    string
  gainDb:   number
  preFader: boolean
  enabled:  boolean
}

export interface CompressorState {
  enabled:   boolean
  threshold: number   // dBFS, -60..0
  ratio:     number   // 1..20
  attack:    number   // ms 0.1..200
  release:   number   // ms 10..2000
  makeup:    number   // dB 0..+24
  knee:      number   // dB 0..12
  gain_reduction: number  // live readout
}

export interface ChannelMixerState {
  trackId:         string
  eqEnabled:       boolean
  eqBands:         EQBand[]
  inserts:         InsertSlot[]
  sends:           MixerSend[]
  groupId:         string | null
  sidechainFrom:   string | null
  compressor:      CompressorState
  showEQ:          boolean
  showSends:       boolean
  showComp:        boolean
}

export interface MixerBus {
  id:         string
  name:       string
  color:      string
  gainDb:     number
  panCenter:  number
  muted:      boolean
  soloed:     boolean
  type:       'group' | 'fx-return' | 'master'
  compressor: CompressorState
  eqEnabled:  boolean
  eqBands:    EQBand[]
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultEQ(): EQBand[] {
  return [
    { freq: 80,   gain: 0, q: 0.7, type: 'highpass',  enabled: false },
    { freq: 200,  gain: 0, q: 1.0, type: 'lowshelf',  enabled: false },
    { freq: 1000, gain: 0, q: 1.0, type: 'peak',      enabled: false },
    { freq: 4000, gain: 0, q: 1.0, type: 'peak',      enabled: false },
    { freq: 8000, gain: 0, q: 0.7, type: 'highshelf', enabled: false },
  ]
}

function defaultComp(): CompressorState {
  return {
    enabled: false, threshold: -18, ratio: 4, attack: 10, release: 200,
    makeup: 0, knee: 6, gain_reduction: 0,
  }
}

function defaultChannel(trackId: string): ChannelMixerState {
  return {
    trackId,
    eqEnabled:  false,
    eqBands:    defaultEQ(),
    inserts:    [],
    sends:      [
      { busId: 'bus-drums',  gainDb: -Infinity, preFader: false, enabled: false },
      { busId: 'bus-synths', gainDb: -Infinity, preFader: false, enabled: false },
      { busId: 'bus-fx',     gainDb: -12,       preFader: false, enabled: false },
    ],
    groupId:      null,
    sidechainFrom:null,
    compressor:   defaultComp(),
    showEQ:       false,
    showSends:    false,
    showComp:     false,
  }
}

const SEED_BUSES: MixerBus[] = [
  {
    id: 'bus-drums', name: 'Drums', color: '#7c3aed', gainDb: 0, panCenter: 0,
    muted: false, soloed: false, type: 'group', compressor: defaultComp(), eqEnabled: false, eqBands: defaultEQ(),
  },
  {
    id: 'bus-synths', name: 'Synths', color: '#06b6d4', gainDb: 0, panCenter: 0,
    muted: false, soloed: false, type: 'group', compressor: defaultComp(), eqEnabled: false, eqBands: defaultEQ(),
  },
  {
    id: 'bus-fx', name: 'FX Rtn', color: '#8b5cf6', gainDb: -6, panCenter: 0,
    muted: false, soloed: false, type: 'fx-return', compressor: defaultComp(), eqEnabled: false, eqBands: defaultEQ(),
  },
  {
    id: 'bus-master', name: 'Master', color: '#e2e8f0', gainDb: 0, panCenter: 0,
    muted: false, soloed: false, type: 'master',
    compressor: { ...defaultComp(), enabled: true, threshold: -6, ratio: 2, knee: 8 },
    eqEnabled: false, eqBands: defaultEQ(),
  },
]

const PRESET_INSERTS: Record<string, InsertSlot[]> = {
  'tk-kick':   [{ id: 'i1', name: 'Comp',  enabled: true,  color: '#7c3aed' }, { id: 'i2', name: 'EQ',   enabled: true,  color: '#06b6d4' }],
  'tk-bass':   [{ id: 'i3', name: 'Comp',  enabled: true,  color: '#06b6d4' }, { id: 'i4', name: 'Dist', enabled: false, color: '#f59e0b' }],
  'tk-lead':   [{ id: 'i5', name: 'Delay', enabled: true,  color: '#f59e0b' }, { id: 'i6', name: 'Rev',  enabled: true,  color: '#8b5cf6' }],
  'tk-chords': [{ id: 'i7', name: 'Rev',   enabled: true,  color: '#10b981' }],
  'tk-pad':    [{ id: 'i8', name: 'Rev',   enabled: true,  color: '#10b981' }, { id: 'i9', name: 'Chorus',enabled: false,color: '#06b6d4' }],
  'tk-fx':     [{ id: 'ia', name: 'Pitch', enabled: false, color: '#ec4899' }],
  'tk-vox':    [{ id: 'ib', name: 'Comp',  enabled: true,  color: '#7c3aed' }, { id: 'ic', name: 'DeEss',enabled: false, color: '#ef4444' }],
}

const PRESET_GROUPS: Record<string, string> = {
  'tk-kick':   'bus-drums',
  'tk-bass':   'bus-synths',
  'tk-lead':   'bus-synths',
  'tk-chords': 'bus-synths',
  'tk-pad':    'bus-synths',
  'tk-fx':     'bus-fx',
  'tk-vox':    'bus-synths',
}

function seedChannel(trackId: string): ChannelMixerState {
  const ch = defaultChannel(trackId)
  if (PRESET_INSERTS[trackId]) ch.inserts = PRESET_INSERTS[trackId]
  if (PRESET_GROUPS[trackId])  ch.groupId = PRESET_GROUPS[trackId]
  return ch
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface MixerStore {
  channels:      Record<string, ChannelMixerState>
  buses:         MixerBus[]
  masterLimiter: boolean
  masterLimiterThreshold: number
  monitoring:    boolean
  spectrumOpen:  boolean

  // Channel actions
  getOrCreate:     (trackId: string) => ChannelMixerState
  setEQEnabled:    (trackId: string, on: boolean) => void
  setEQBand:       (trackId: string, i: number, patch: Partial<EQBand>) => void
  setComp:         (trackId: string, patch: Partial<CompressorState>) => void
  setSend:         (trackId: string, busId: string, patch: Partial<MixerSend>) => void
  addInsert:       (trackId: string, name: string) => void
  removeInsert:    (trackId: string, insertId: string) => void
  toggleInsert:    (trackId: string, insertId: string) => void
  setGroupId:      (trackId: string, groupId: string | null) => void
  setSidechainFrom:(trackId: string, srcId: string | null) => void
  toggleSection:   (trackId: string, section: 'showEQ' | 'showSends' | 'showComp') => void

  // Bus actions
  setBusGain:  (busId: string, db: number) => void
  setBusPan:   (busId: string, pan: number) => void
  toggleBusMute:(busId: string) => void
  toggleBusSolo:(busId: string) => void

  // Global
  setMasterLimiter:(on: boolean) => void
  setMasterLimiterThreshold:(db: number) => void
  setMonitoring:  (on: boolean) => void
  toggleSpectrum: () => void
}

export const useMixerStore = create<MixerStore>((set, get) => ({
  channels: {
    'tk-kick':   seedChannel('tk-kick'),
    'tk-bass':   seedChannel('tk-bass'),
    'tk-lead':   seedChannel('tk-lead'),
    'tk-chords': seedChannel('tk-chords'),
    'tk-pad':    seedChannel('tk-pad'),
    'tk-fx':     seedChannel('tk-fx'),
    'tk-vox':    seedChannel('tk-vox'),
  },
  buses:          SEED_BUSES,
  masterLimiter:  true,
  masterLimiterThreshold: -1,
  monitoring:     false,
  spectrumOpen:   true,

  getOrCreate: (trackId) => {
    const existing = get().channels[trackId]
    if (existing) return existing
    const ch = defaultChannel(trackId)
    set(s => ({ channels: { ...s.channels, [trackId]: ch } }))
    return ch
  },

  setEQEnabled: (trackId, on) => set(s => ({
    channels: { ...s.channels, [trackId]: { ...get().getOrCreate(trackId), eqEnabled: on } },
  })),

  setEQBand: (trackId, i, patch) => set(s => {
    const ch    = get().getOrCreate(trackId)
    const bands = ch.eqBands.map((b, idx) => idx === i ? { ...b, ...patch } : b)
    return { channels: { ...s.channels, [trackId]: { ...ch, eqBands: bands } } }
  }),

  setComp: (trackId, patch) => set(s => {
    const ch = get().getOrCreate(trackId)
    return { channels: { ...s.channels, [trackId]: { ...ch, compressor: { ...ch.compressor, ...patch } } } }
  }),

  setSend: (trackId, busId, patch) => set(s => {
    const ch   = get().getOrCreate(trackId)
    const sends = ch.sends.map(send => send.busId === busId ? { ...send, ...patch } : send)
    return { channels: { ...s.channels, [trackId]: { ...ch, sends } } }
  }),

  addInsert: (trackId, name) => set(s => {
    const ch = get().getOrCreate(trackId)
    const insert: InsertSlot = { id: 'i-' + Math.random().toString(36).slice(2), name, enabled: true, color: '#7c3aed' }
    return { channels: { ...s.channels, [trackId]: { ...ch, inserts: [...ch.inserts, insert] } } }
  }),

  removeInsert: (trackId, insertId) => set(s => {
    const ch = get().getOrCreate(trackId)
    return { channels: { ...s.channels, [trackId]: { ...ch, inserts: ch.inserts.filter(i => i.id !== insertId) } } }
  }),

  toggleInsert: (trackId, insertId) => set(s => {
    const ch = get().getOrCreate(trackId)
    const inserts = ch.inserts.map(i => i.id === insertId ? { ...i, enabled: !i.enabled } : i)
    return { channels: { ...s.channels, [trackId]: { ...ch, inserts } } }
  }),

  setGroupId: (trackId, groupId) => set(s => ({
    channels: { ...s.channels, [trackId]: { ...get().getOrCreate(trackId), groupId } },
  })),

  setSidechainFrom: (trackId, srcId) => set(s => ({
    channels: { ...s.channels, [trackId]: { ...get().getOrCreate(trackId), sidechainFrom: srcId } },
  })),

  toggleSection: (trackId, section) => set(s => {
    const ch = get().getOrCreate(trackId)
    return { channels: { ...s.channels, [trackId]: { ...ch, [section]: !ch[section] } } }
  }),

  setBusGain:   (busId, db)  => set(s => ({ buses: s.buses.map(b => b.id === busId ? { ...b, gainDb:    db  } : b) })),
  setBusPan:    (busId, pan) => set(s => ({ buses: s.buses.map(b => b.id === busId ? { ...b, panCenter: pan } : b) })),
  toggleBusMute:(busId)      => set(s => ({ buses: s.buses.map(b => b.id === busId ? { ...b, muted: !b.muted } : b) })),
  toggleBusSolo:(busId)      => set(s => ({ buses: s.buses.map(b => b.id === busId ? { ...b, soloed: !b.soloed } : b) })),

  setMasterLimiter:          (on) => set({ masterLimiter: on }),
  setMasterLimiterThreshold: (db) => set({ masterLimiterThreshold: db }),
  setMonitoring:             (on) => set({ monitoring: on }),
  toggleSpectrum:            ()   => set(s => ({ spectrumOpen: !s.spectrumOpen })),
}))
