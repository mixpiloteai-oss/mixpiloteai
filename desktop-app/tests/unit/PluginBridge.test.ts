// ─── PluginBridge.test.ts ─────────────────────────────────────────────────────
// Tests PluginBridgeClass using a mocked electronAPI.
// We test the bridge logic (correct channel delegation, type coercion,
// automation lane registry) without importing the real bridge (which needs DOM).

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ── Minimal type replicas ─────────────────────────────────────────────────────

type AutomationLaneKey = `${string}:${number}`

interface AutomationBinding {
  instanceId: string; paramId: number; paramName: string
  minValue: number; maxValue: number
}

interface PluginPreset {
  id: string; pluginId: string; name: string; savedAt: number; isFactory: boolean
}

// ── PluginBridgeClass replica for isolation ───────────────────────────────────

class PluginBridgeClass {
  private readonly _automationMap = new Map<AutomationLaneKey, AutomationBinding>()
  private _api: MockAPI | null = null

  withAPI(api: MockAPI) { this._api = api; return this }

  async scan() {
    return (await this._api!.pluginScan()) as unknown[]
  }

  async load(path: string, format: string, pluginId: string) {
    const inst = await this._api!.pluginLoad(path, format)
    return { ...inst, pluginId, loadedAt: Date.now() }
  }

  async unload(instanceId: string) {
    const result = await this._api!.pluginUnload(instanceId)
    for (const key of this._automationMap.keys()) {
      if (key.startsWith(`${instanceId}:`)) this._automationMap.delete(key as AutomationLaneKey)
    }
    return result.ok
  }

  async setParameter(instanceId: string, paramId: number, value: number) {
    const result = await this._api!.pluginSetParameter(instanceId, paramId, value)
    return result.ok
  }

  async getParameter(instanceId: string, paramId: number) {
    const result = await this._api!.pluginGetParameter(instanceId, paramId)
    return result?.value ?? null
  }

  async addToChain(instanceId: string, trackId: string) {
    const result = await this._api!.pluginAddToChain(instanceId, trackId)
    return result.ok
  }

  async savePreset(pluginId: string, name: string, params: Record<string, number>): Promise<PluginPreset | null> {
    const result = await this._api!.pluginSavePreset(pluginId, name, params)
    if (!result) return null
    return { id: result.id, pluginId, name: result.name, savedAt: Date.now(), isFactory: false }
  }

  async loadPreset(pluginId: string, presetId: string) {
    const result = await this._api!.pluginLoadPreset(pluginId, presetId)
    return result?.data ?? null
  }

  async deletePreset(pluginId: string, presetId: string) {
    const result = await this._api!.pluginDeletePreset(pluginId, presetId)
    return result.ok
  }

  async getInstanceHealth(instanceId: string) {
    const raw = await this._api!.pluginGetInstanceHealth(instanceId)
    if (!raw) return null
    return { instanceId, ...raw }
  }

  registerAutomationLane(instanceId: string, paramId: number, paramName: string, minValue: number, maxValue: number): AutomationLaneKey {
    const key = `${instanceId}:${paramId}` as AutomationLaneKey
    this._automationMap.set(key, { instanceId, paramId, paramName, minValue, maxValue })
    return key
  }

  unregisterAutomationLane(key: AutomationLaneKey) { this._automationMap.delete(key) }
  getAutomationBinding(key: AutomationLaneKey)     { return this._automationMap.get(key) }

  async applyAutomatedValue(laneKey: AutomationLaneKey, normalizedValue: number): Promise<void> {
    const entry = this._automationMap.get(laneKey)
    if (!entry) return
    const { instanceId, paramId, minValue, maxValue } = entry
    const value = minValue + normalizedValue * (maxValue - minValue)
    await this.setParameter(instanceId, paramId, value)
  }
}

// ── Mock API ──────────────────────────────────────────────────────────────────

interface MockAPI {
  pluginScan:            () => Promise<unknown[]>
  pluginLoad:            (path: string, fmt: string) => Promise<{ instanceId: string; name: string; vendor: string; paramCount: number; pid: number }>
  pluginUnload:          (id: string) => Promise<{ ok: boolean }>
  pluginSetParameter:    (id: string, pId: number, val: number) => Promise<{ ok: boolean }>
  pluginGetParameter:    (id: string, pId: number) => Promise<{ value: number } | null>
  pluginAddToChain:      (id: string, trackId: string) => Promise<{ ok: boolean }>
  pluginSavePreset:      (pluginId: string, name: string, data: Record<string, number>) => Promise<{ id: string; name: string }>
  pluginLoadPreset:      (pluginId: string, presetId: string) => Promise<{ data: Record<string, number> } | null>
  pluginDeletePreset:    (pluginId: string, presetId: string) => Promise<{ ok: boolean }>
  pluginGetInstanceHealth:(id: string) => Promise<{ memoryMb: number; cpuPercent: number; uptimeMs: number } | null>
}

function makeMockAPI(overrides: Partial<MockAPI> = {}): MockAPI {
  return {
    pluginScan:            async () => [],
    pluginLoad:            async (path, _fmt) => ({ instanceId: 'inst-1', name: path, vendor: 'Test', paramCount: 4, pid: 9999 }),
    pluginUnload:          async () => ({ ok: true }),
    pluginSetParameter:    async () => ({ ok: true }),
    pluginGetParameter:    async () => ({ value: 0.5 }),
    pluginAddToChain:      async () => ({ ok: true }),
    pluginSavePreset:      async (_pid, name) => ({ id: 'preset-1', name }),
    pluginLoadPreset:      async () => ({ data: { '0': 0.8, '1': 0.3 } }),
    pluginDeletePreset:    async () => ({ ok: true }),
    pluginGetInstanceHealth: async () => ({ memoryMb: 64, cpuPercent: 2.5, uptimeMs: 5000 }),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PluginBridge / scan', () => {
  it('delegates to pluginScan and returns array', async () => {
    let called = false
    const api  = makeMockAPI({ pluginScan: async () => { called = true; return [{ id: 'p1' }] } })
    const bridge = new PluginBridgeClass().withAPI(api)
    const result = await bridge.scan()
    assert.equal(called, true)
    assert.equal(result.length, 1)
  })
})

describe('PluginBridge / load + unload', () => {
  let bridge: PluginBridgeClass
  beforeEach(() => { bridge = new PluginBridgeClass().withAPI(makeMockAPI()) })

  it('load returns instance with pluginId and loadedAt', async () => {
    const inst = await bridge.load('/plugins/Synth.vst3', 'VST3', 'p-synth')
    assert.equal(inst.instanceId, 'inst-1')
    assert.equal(inst.pluginId, 'p-synth')
    assert.ok(inst.loadedAt > 0)
  })

  it('unload returns true on ok:true', async () => {
    const ok = await bridge.unload('inst-1')
    assert.equal(ok, true)
  })

  it('unload clears automation map entries for instance', async () => {
    bridge.registerAutomationLane('inst-1', 0, 'Gain', 0, 1)
    bridge.registerAutomationLane('inst-1', 1, 'Pan',  -1, 1)
    bridge.registerAutomationLane('inst-2', 0, 'Cut',  20, 20000)
    await bridge.unload('inst-1')
    assert.equal(bridge.getAutomationBinding('inst-1:0' as AutomationLaneKey), undefined)
    assert.equal(bridge.getAutomationBinding('inst-1:1' as AutomationLaneKey), undefined)
    assert.notEqual(bridge.getAutomationBinding('inst-2:0' as AutomationLaneKey), undefined)
  })
})

describe('PluginBridge / parameters', () => {
  let bridge: PluginBridgeClass
  beforeEach(() => { bridge = new PluginBridgeClass().withAPI(makeMockAPI()) })

  it('setParameter delegates correctly and returns true', async () => {
    let called = false
    const api = makeMockAPI({ pluginSetParameter: async (id, pId, val) => {
      called = true
      assert.equal(id, 'inst-1')
      assert.equal(pId, 3)
      assert.equal(val, 0.75)
      return { ok: true }
    }})
    bridge.withAPI(api)
    const ok = await bridge.setParameter('inst-1', 3, 0.75)
    assert.equal(called, true)
    assert.equal(ok, true)
  })

  it('getParameter returns number from API', async () => {
    const val = await bridge.getParameter('inst-1', 0)
    assert.equal(val, 0.5)
  })

  it('getParameter returns null when API returns null', async () => {
    const api = makeMockAPI({ pluginGetParameter: async () => null })
    bridge.withAPI(api)
    const val = await bridge.getParameter('inst-1', 0)
    assert.equal(val, null)
  })
})

describe('PluginBridge / presets', () => {
  let bridge: PluginBridgeClass
  beforeEach(() => { bridge = new PluginBridgeClass().withAPI(makeMockAPI()) })

  it('savePreset returns PluginPreset with pluginId set', async () => {
    const preset = await bridge.savePreset('p1', 'My Preset', {})
    assert.ok(preset !== null)
    assert.equal(preset!.name, 'My Preset')
    assert.equal(preset!.pluginId, 'p1')
    assert.equal(preset!.isFactory, false)
    assert.ok(preset!.savedAt > 0)
  })

  it('loadPreset returns data object', async () => {
    const data = await bridge.loadPreset('p1', 'preset-1')
    assert.ok(data !== null)
    assert.equal(data!['0'], 0.8)
  })

  it('loadPreset returns null when API returns null', async () => {
    const api = makeMockAPI({ pluginLoadPreset: async () => null })
    bridge.withAPI(api)
    const data = await bridge.loadPreset('p1', 'missing')
    assert.equal(data, null)
  })

  it('deletePreset returns true', async () => {
    const ok = await bridge.deletePreset('p1', 'preset-1')
    assert.equal(ok, true)
  })
})

describe('PluginBridge / health', () => {
  let bridge: PluginBridgeClass
  beforeEach(() => { bridge = new PluginBridgeClass().withAPI(makeMockAPI()) })

  it('getInstanceHealth returns health info with instanceId', async () => {
    const h = await bridge.getInstanceHealth('inst-1')
    assert.ok(h !== null)
    assert.equal(h!.instanceId, 'inst-1')
    assert.equal(h!.memoryMb, 64)
    assert.equal(h!.cpuPercent, 2.5)
    assert.equal(h!.uptimeMs, 5000)
  })

  it('getInstanceHealth returns null when API returns null', async () => {
    const api = makeMockAPI({ pluginGetInstanceHealth: async () => null })
    bridge.withAPI(api)
    const h = await bridge.getInstanceHealth('inst-1')
    assert.equal(h, null)
  })
})

describe('PluginBridge / automation lane registry', () => {
  let bridge: PluginBridgeClass
  beforeEach(() => { bridge = new PluginBridgeClass().withAPI(makeMockAPI()) })

  it('registerAutomationLane stores binding and returns laneKey', () => {
    const key = bridge.registerAutomationLane('inst-1', 2, 'Cutoff', 20, 20000)
    assert.equal(key, 'inst-1:2')
    const b = bridge.getAutomationBinding(key)
    assert.ok(b)
    assert.equal(b!.paramName, 'Cutoff')
    assert.equal(b!.minValue, 20)
    assert.equal(b!.maxValue, 20000)
  })

  it('unregisterAutomationLane removes binding', () => {
    const key = bridge.registerAutomationLane('inst-1', 0, 'Gain', 0, 1)
    bridge.unregisterAutomationLane(key)
    assert.equal(bridge.getAutomationBinding(key), undefined)
  })

  it('applyAutomatedValue scales normalized value to param range', async () => {
    const calls: { id: string; pId: number; val: number }[] = []
    const api = makeMockAPI({ pluginSetParameter: async (id, pId, val) => {
      calls.push({ id, pId, val }); return { ok: true }
    }})
    bridge.withAPI(api)

    bridge.registerAutomationLane('inst-1', 0, 'Gain', -24, 24)
    await bridge.applyAutomatedValue('inst-1:0' as AutomationLaneKey, 0.5)
    assert.equal(calls.length, 1)
    assert.ok(Math.abs(calls[0].val - 0) < 1e-9, `expected 0 (midpoint of -24..24), got ${calls[0].val}`)
  })

  it('applyAutomatedValue at 0.0 applies minValue', async () => {
    const calls: number[] = []
    const api = makeMockAPI({ pluginSetParameter: async (_id, _pId, val) => { calls.push(val); return { ok: true } } })
    bridge.withAPI(api)
    bridge.registerAutomationLane('inst-1', 1, 'Pan', -1, 1)
    await bridge.applyAutomatedValue('inst-1:1' as AutomationLaneKey, 0)
    assert.equal(calls[0], -1)
  })

  it('applyAutomatedValue at 1.0 applies maxValue', async () => {
    const calls: number[] = []
    const api = makeMockAPI({ pluginSetParameter: async (_id, _pId, val) => { calls.push(val); return { ok: true } } })
    bridge.withAPI(api)
    bridge.registerAutomationLane('inst-1', 1, 'Pan', -1, 1)
    await bridge.applyAutomatedValue('inst-1:1' as AutomationLaneKey, 1)
    assert.equal(calls[0], 1)
  })

  it('applyAutomatedValue with unknown laneKey is a no-op', async () => {
    const calls: number[] = []
    const api = makeMockAPI({ pluginSetParameter: async (_id, _pId, val) => { calls.push(val); return { ok: true } } })
    bridge.withAPI(api)
    await bridge.applyAutomatedValue('no-such:99' as AutomationLaneKey, 0.5)
    assert.equal(calls.length, 0)
  })
})

describe('PluginBridge / chain routing', () => {
  it('addToChain delegates correctly', async () => {
    let capturedTrack = ''
    const api = makeMockAPI({ pluginAddToChain: async (_id, trackId) => { capturedTrack = trackId; return { ok: true } } })
    const bridge = new PluginBridgeClass().withAPI(api)
    const ok = await bridge.addToChain('inst-1', 'track-kick')
    assert.equal(ok, true)
    assert.equal(capturedTrack, 'track-kick')
  })
})
