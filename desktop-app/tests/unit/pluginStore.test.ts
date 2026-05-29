// ─── pluginStore.test.ts ──────────────────────────────────────────────────────
// Tests the PluginStore state-logic using an in-memory implementation that
// mirrors the real Zustand store's action contracts.
// (Importing the real store requires a browser environment for localStorage
//  and Zustand's persist middleware; we test the pure business logic here.)

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ── Minimal type replicas ─────────────────────────────────────────────────────

interface PluginInfo {
  id: string; name: string; vendor: string; path: string
  format: string; category: string; architecture: string
  isBlacklisted: boolean; crashCount: number; isFavorite: boolean
  hasEditor: boolean; paramCount: number; version: string; scannedAt: number
}

interface PluginInstance {
  instanceId: string; pluginId: string; name: string; vendor: string
  paramCount: number; pid: number; loadedAt: number
  trackId?: string; latencySamples?: number
}

interface PluginPreset {
  id: string; pluginId: string; name: string; savedAt: number; isFactory: boolean
}

interface BlacklistEntry {
  path: string; name: string; crashCount: number; blacklistedAt: number | null
}

interface CrashInfo {
  instanceId: string; pluginName: string; crashCount: number; blacklisted: boolean
}

// ── In-memory store replica ───────────────────────────────────────────────────

function createStore() {
  let plugins:    PluginInfo[]    = []
  let scanning:   boolean         = false
  let lastScanAt: number          = 0
  let instances:  PluginInstance[] = []
  let presets:    Record<string, PluginPreset[]> = {}
  let blacklist:  BlacklistEntry[] = []
  let favorites:  Set<string>     = new Set()
  let lastCrash:  CrashInfo | null = null

  return {
    get plugins()    { return plugins    },
    get scanning()   { return scanning   },
    get lastScanAt() { return lastScanAt },
    get instances()  { return instances  },
    get presets()    { return presets    },
    get blacklist()  { return blacklist  },
    get favorites()  { return favorites  },
    get lastCrash()  { return lastCrash  },

    setPlugins(ps: PluginInfo[]) {
      plugins    = ps.map(p => ({ ...p, isFavorite: favorites.has(p.id) }))
      lastScanAt = Date.now()
    },
    setScanning(v: boolean) { scanning = v },
    addInstance(i: PluginInstance) { instances = [...instances, i] },
    removeInstance(id: string) { instances = instances.filter(i => i.instanceId !== id) },
    setPresets(pluginId: string, ps: PluginPreset[]) { presets = { ...presets, [pluginId]: ps } },
    setBlacklist(b: BlacklistEntry[]) { blacklist = b },
    toggleFavorite(pluginId: string) {
      const fav = new Set(favorites)
      if (fav.has(pluginId)) fav.delete(pluginId)
      else fav.add(pluginId)
      favorites = fav
      plugins   = plugins.map(p => p.id === pluginId ? { ...p, isFavorite: fav.has(p.id) } : p)
    },
    setLastCrash(c: CrashInfo | null) { lastCrash = c },
    clearLastCrash() { lastCrash = null },
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function makePlugin(overrides: Partial<PluginInfo> = {}): PluginInfo {
  return {
    id: 'p1', name: 'Test Synth', vendor: 'ACME', path: '/plugins/Test.vst3',
    format: 'VST3', category: 'instrument', architecture: '64bit',
    isBlacklisted: false, crashCount: 0, isFavorite: false,
    hasEditor: true, paramCount: 8, version: '1.0.0', scannedAt: Date.now(),
    ...overrides,
  }
}

function makeInstance(overrides: Partial<PluginInstance> = {}): PluginInstance {
  return {
    instanceId: 'inst-1', pluginId: 'p1', name: 'Test Synth',
    vendor: 'ACME', paramCount: 8, pid: 12345, loadedAt: Date.now(),
    ...overrides,
  }
}

// ── Suites ────────────────────────────────────────────────────────────────────

describe('pluginStore / setPlugins', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('stores plugins and updates lastScanAt', () => {
    const before = Date.now()
    store.setPlugins([makePlugin()])
    assert.equal(store.plugins.length, 1)
    assert.ok(store.lastScanAt >= before)
  })

  it('marks isFavorite true for plugins in favorites set', () => {
    store.toggleFavorite('p1')
    store.setPlugins([makePlugin({ id: 'p1' }), makePlugin({ id: 'p2' })])
    assert.equal(store.plugins.find(p => p.id === 'p1')?.isFavorite, true)
    assert.equal(store.plugins.find(p => p.id === 'p2')?.isFavorite, false)
  })

  it('replaces existing plugins on re-scan', () => {
    store.setPlugins([makePlugin({ id: 'p1' })])
    store.setPlugins([makePlugin({ id: 'p1' }), makePlugin({ id: 'p2' })])
    assert.equal(store.plugins.length, 2)
  })
})

describe('pluginStore / instance management', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('addInstance stores instance', () => {
    store.addInstance(makeInstance())
    assert.equal(store.instances.length, 1)
    assert.equal(store.instances[0].instanceId, 'inst-1')
  })

  it('removeInstance removes by instanceId', () => {
    store.addInstance(makeInstance({ instanceId: 'inst-1' }))
    store.addInstance(makeInstance({ instanceId: 'inst-2' }))
    store.removeInstance('inst-1')
    assert.equal(store.instances.length, 1)
    assert.equal(store.instances[0].instanceId, 'inst-2')
  })

  it('removeInstance with unknown id is a no-op', () => {
    store.addInstance(makeInstance())
    store.removeInstance('no-such-instance')
    assert.equal(store.instances.length, 1)
  })

  it('latencySamples is preserved on the instance', () => {
    store.addInstance(makeInstance({ latencySamples: 256 }))
    assert.equal(store.instances[0].latencySamples, 256)
  })

  it('trackId is preserved on the instance', () => {
    store.addInstance(makeInstance({ trackId: 'track-kick' }))
    assert.equal(store.instances[0].trackId, 'track-kick')
  })
})

describe('pluginStore / favorites', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => {
    store = createStore()
    store.setPlugins([makePlugin({ id: 'p1' }), makePlugin({ id: 'p2' })])
  })

  it('toggleFavorite adds to favorites set', () => {
    store.toggleFavorite('p1')
    assert.equal(store.favorites.has('p1'), true)
  })

  it('toggleFavorite removes if already favorite', () => {
    store.toggleFavorite('p1')
    store.toggleFavorite('p1')
    assert.equal(store.favorites.has('p1'), false)
  })

  it('toggleFavorite updates isFavorite on plugin objects', () => {
    store.toggleFavorite('p1')
    assert.equal(store.plugins.find(p => p.id === 'p1')?.isFavorite, true)
    assert.equal(store.plugins.find(p => p.id === 'p2')?.isFavorite, false)
  })
})

describe('pluginStore / crash notification', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('setLastCrash stores crash info', () => {
    store.setLastCrash({ instanceId: 'inst-1', pluginName: 'Bad Synth', crashCount: 1, blacklisted: false })
    assert.ok(store.lastCrash !== null)
    assert.equal(store.lastCrash!.pluginName, 'Bad Synth')
  })

  it('clearLastCrash resets to null', () => {
    store.setLastCrash({ instanceId: 'inst-1', pluginName: 'Bad Synth', crashCount: 1, blacklisted: false })
    store.clearLastCrash()
    assert.equal(store.lastCrash, null)
  })

  it('blacklisted flag is preserved in crash info', () => {
    store.setLastCrash({ instanceId: 'inst-1', pluginName: 'Crasher', crashCount: 3, blacklisted: true })
    assert.equal(store.lastCrash!.blacklisted, true)
    assert.equal(store.lastCrash!.crashCount, 3)
  })
})

describe('pluginStore / presets', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('setPresets stores presets by pluginId', () => {
    const ps: PluginPreset[] = [
      { id: 'pr-1', pluginId: 'p1', name: 'Warm Pad', savedAt: Date.now(), isFactory: false },
    ]
    store.setPresets('p1', ps)
    assert.equal(store.presets['p1']?.length, 1)
    assert.equal(store.presets['p1'][0].name, 'Warm Pad')
  })

  it('setPresets for different plugins do not overwrite each other', () => {
    store.setPresets('p1', [{ id: 'pr-1', pluginId: 'p1', name: 'A', savedAt: Date.now(), isFactory: false }])
    store.setPresets('p2', [{ id: 'pr-2', pluginId: 'p2', name: 'B', savedAt: Date.now(), isFactory: false }])
    assert.equal(store.presets['p1']?.length, 1)
    assert.equal(store.presets['p2']?.length, 1)
  })
})

describe('pluginStore / blacklist', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('setBlacklist stores entries', () => {
    store.setBlacklist([{ path: '/plugins/Bad.vst3', name: 'Bad', crashCount: 3, blacklistedAt: Date.now() }])
    assert.equal(store.blacklist.length, 1)
  })

  it('setBlacklist replaces previous list', () => {
    store.setBlacklist([{ path: '/p/A.vst3', name: 'A', crashCount: 3, blacklistedAt: Date.now() }])
    store.setBlacklist([{ path: '/p/B.vst3', name: 'B', crashCount: 3, blacklistedAt: Date.now() }])
    assert.equal(store.blacklist.length, 1)
    assert.equal(store.blacklist[0].name, 'B')
  })

  it('entry with null blacklistedAt is tracked-but-not-blacklisted', () => {
    store.setBlacklist([{ path: '/p/C.vst3', name: 'C', crashCount: 1, blacklistedAt: null }])
    assert.equal(store.blacklist[0].blacklistedAt, null)
  })
})
