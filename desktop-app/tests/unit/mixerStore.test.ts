// ─── mixerStore.test.ts ──────────────────────────────────────────────────────
// Self-contained — replicates mixer store logic inline (no Zustand import).
// Mirrors the action contracts of useMixerStore.ts.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ── Minimal type replicas ─────────────────────────────────────────────────────

interface InsertSlot { id: string; name: string; enabled: boolean; color: string }
interface MixerSend  { busId: string; gainDb: number; preFader: boolean; enabled: boolean }
interface CompState  { enabled: boolean; threshold: number; ratio: number; attack: number; release: number; makeup: number; knee: number; gain_reduction: number }

interface ChannelMixerState {
  trackId: string; eqEnabled: boolean
  inserts: InsertSlot[]; sends: MixerSend[]
  groupId: string | null; sidechainFrom: string | null
  compressor: CompState
}

interface MixerBus { id: string; name: string; color: string; gainDb: number; panCenter: number; muted: boolean; soloed: boolean }

// ── In-memory store replica ───────────────────────────────────────────────────

function defaultComp(): CompState {
  return { enabled: false, threshold: -18, ratio: 4, attack: 10, release: 150, makeup: 0, knee: 3, gain_reduction: 0 }
}

function defaultChannel(trackId: string): ChannelMixerState {
  return { trackId, eqEnabled: false, inserts: [], sends: [], groupId: null, sidechainFrom: null, compressor: defaultComp() }
}

function defaultBus(id: string, name: string): MixerBus {
  return { id, name, color: '#6366f1', gainDb: 0, panCenter: 0, muted: false, soloed: false }
}

let _idSeq = 0
function uid(): string { return `i-${++_idSeq}` }

function createStore() {
  let channels: Record<string, ChannelMixerState> = {}
  let buses: MixerBus[] = []
  let masterLimiter     = true
  let spectrumOpen      = true

  function getOrCreate(trackId: string): ChannelMixerState {
    if (!channels[trackId]) channels[trackId] = defaultChannel(trackId)
    return channels[trackId]
  }

  return {
    get channels() { return channels },
    get buses()    { return buses    },
    get masterLimiter()  { return masterLimiter  },
    get spectrumOpen()   { return spectrumOpen   },

    getOrCreate,

    setEQEnabled(trackId: string, on: boolean) {
      const ch = getOrCreate(trackId)
      channels = { ...channels, [trackId]: { ...ch, eqEnabled: on } }
    },

    setComp(trackId: string, patch: Partial<CompState>) {
      const ch = getOrCreate(trackId)
      channels = { ...channels, [trackId]: { ...ch, compressor: { ...ch.compressor, ...patch } } }
    },

    setSend(trackId: string, busId: string, patch: Partial<MixerSend>) {
      const ch    = getOrCreate(trackId)
      const existing = ch.sends.find(s => s.busId === busId)
      const sends = existing
        ? ch.sends.map(s => s.busId === busId ? { ...s, ...patch } : s)
        : [...ch.sends, { busId, gainDb: 0, preFader: false, enabled: true, ...patch }]
      channels = { ...channels, [trackId]: { ...ch, sends } }
    },

    addInsert(trackId: string, name: string) {
      const ch     = getOrCreate(trackId)
      const insert: InsertSlot = { id: uid(), name, enabled: true, color: '#7c3aed' }
      channels = { ...channels, [trackId]: { ...ch, inserts: [...ch.inserts, insert] } }
    },

    removeInsert(trackId: string, insertId: string) {
      const ch = getOrCreate(trackId)
      channels = { ...channels, [trackId]: { ...ch, inserts: ch.inserts.filter(i => i.id !== insertId) } }
    },

    toggleInsert(trackId: string, insertId: string) {
      const ch      = getOrCreate(trackId)
      const inserts = ch.inserts.map(i => i.id === insertId ? { ...i, enabled: !i.enabled } : i)
      channels = { ...channels, [trackId]: { ...ch, inserts } }
    },

    setGroupId(trackId: string, groupId: string | null) {
      const ch = getOrCreate(trackId)
      channels = { ...channels, [trackId]: { ...ch, groupId } }
    },

    addBus(id: string, name: string) {
      buses = [...buses, defaultBus(id, name)]
    },

    setBusGain(busId: string, db: number) {
      buses = buses.map(b => b.id === busId ? { ...b, gainDb: db } : b)
    },

    toggleBusMute(busId: string) {
      buses = buses.map(b => b.id === busId ? { ...b, muted: !b.muted } : b)
    },

    toggleBusSolo(busId: string) {
      buses = buses.map(b => b.id === busId ? { ...b, soloed: !b.soloed } : b)
    },

    setMasterLimiter(on: boolean) { masterLimiter = on },
    toggleSpectrum()              { spectrumOpen = !spectrumOpen },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('mixerStore / getOrCreate', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('creates default channel for unknown trackId', () => {
    const ch = store.getOrCreate('new-track')
    assert.equal(ch.trackId, 'new-track')
    assert.equal(ch.eqEnabled, false)
    assert.equal(ch.inserts.length, 0)
    assert.equal(ch.sends.length, 0)
    assert.equal(ch.groupId, null)
  })

  it('returns same channel on second call', () => {
    const ch1 = store.getOrCreate('t1')
    const ch2 = store.getOrCreate('t1')
    assert.deepEqual(ch1, ch2)
  })
})

describe('mixerStore / EQ', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('setEQEnabled flips eqEnabled', () => {
    store.setEQEnabled('t1', true)
    assert.equal(store.getOrCreate('t1').eqEnabled, true)
    store.setEQEnabled('t1', false)
    assert.equal(store.getOrCreate('t1').eqEnabled, false)
  })
})

describe('mixerStore / compressor', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('setComp merges partial patch', () => {
    store.setComp('t1', { threshold: -24, enabled: true })
    const ch = store.getOrCreate('t1')
    assert.equal(ch.compressor.threshold, -24)
    assert.equal(ch.compressor.enabled, true)
    assert.equal(ch.compressor.ratio, 4)  // unchanged
  })
})

describe('mixerStore / sends', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('setSend creates new send when busId is new', () => {
    store.setSend('t1', 'bus-fx', { gainDb: -6 })
    const sends = store.getOrCreate('t1').sends
    assert.equal(sends.length, 1)
    assert.equal(sends[0].busId, 'bus-fx')
    assert.equal(sends[0].gainDb, -6)
  })

  it('setSend updates existing send without creating duplicate', () => {
    store.setSend('t1', 'bus-fx', { gainDb: 0 })
    store.setSend('t1', 'bus-fx', { gainDb: -3 })
    const sends = store.getOrCreate('t1').sends
    assert.equal(sends.length, 1)
    assert.equal(sends[0].gainDb, -3)
  })

  it('setSend leaves other sends untouched', () => {
    store.setSend('t1', 'bus-a', { gainDb: 0 })
    store.setSend('t1', 'bus-b', { gainDb: -6 })
    store.setSend('t1', 'bus-a', { gainDb: -3 })
    assert.equal(store.getOrCreate('t1').sends.find(s => s.busId === 'bus-b')?.gainDb, -6)
  })

  it('setSend with preFader=true sets preFader', () => {
    store.setSend('t1', 'bus-x', { preFader: true })
    assert.equal(store.getOrCreate('t1').sends[0].preFader, true)
  })
})

describe('mixerStore / inserts', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('addInsert appends with enabled=true', () => {
    store.addInsert('t1', 'Compressor')
    const inserts = store.getOrCreate('t1').inserts
    assert.equal(inserts.length, 1)
    assert.equal(inserts[0].name, 'Compressor')
    assert.equal(inserts[0].enabled, true)
  })

  it('removeInsert removes by id, others unaffected', () => {
    store.addInsert('t1', 'EQ')
    store.addInsert('t1', 'Reverb')
    const id = store.getOrCreate('t1').inserts[0].id
    store.removeInsert('t1', id)
    const inserts = store.getOrCreate('t1').inserts
    assert.equal(inserts.length, 1)
    assert.equal(inserts[0].name, 'Reverb')
  })

  it('toggleInsert flips enabled without changing other inserts', () => {
    store.addInsert('t1', 'EQ')
    store.addInsert('t1', 'Delay')
    const id0 = store.getOrCreate('t1').inserts[0].id
    store.toggleInsert('t1', id0)
    assert.equal(store.getOrCreate('t1').inserts[0].enabled, false)
    assert.equal(store.getOrCreate('t1').inserts[1].enabled, true)
  })
})

describe('mixerStore / groupId', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('setGroupId to string sets groupId', () => {
    store.setGroupId('t1', 'group-drums')
    assert.equal(store.getOrCreate('t1').groupId, 'group-drums')
  })

  it('setGroupId to null clears groupId', () => {
    store.setGroupId('t1', 'group-drums')
    store.setGroupId('t1', null)
    assert.equal(store.getOrCreate('t1').groupId, null)
  })
})

describe('mixerStore / buses', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('addBus creates bus entry', () => {
    store.addBus('b1', 'Drums Bus')
    assert.equal(store.buses.length, 1)
    assert.equal(store.buses[0].name, 'Drums Bus')
  })

  it('setBusGain updates correct bus', () => {
    store.addBus('b1', 'A')
    store.addBus('b2', 'B')
    store.setBusGain('b1', -6)
    assert.equal(store.buses.find(b => b.id === 'b1')!.gainDb, -6)
    assert.equal(store.buses.find(b => b.id === 'b2')!.gainDb, 0)
  })

  it('toggleBusMute toggles muted flag', () => {
    store.addBus('b1', 'X')
    store.toggleBusMute('b1')
    assert.equal(store.buses[0].muted, true)
    store.toggleBusMute('b1')
    assert.equal(store.buses[0].muted, false)
  })

  it('toggleBusSolo toggles soloed flag', () => {
    store.addBus('b1', 'X')
    store.toggleBusSolo('b1')
    assert.equal(store.buses[0].soloed, true)
  })
})

describe('mixerStore / master + spectrum', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('setMasterLimiter(false) sets masterLimiter=false', () => {
    store.setMasterLimiter(false)
    assert.equal(store.masterLimiter, false)
  })

  it('toggleSpectrum flips spectrumOpen', () => {
    const before = store.spectrumOpen
    store.toggleSpectrum()
    assert.equal(store.spectrumOpen, !before)
    store.toggleSpectrum()
    assert.equal(store.spectrumOpen, before)
  })
})
