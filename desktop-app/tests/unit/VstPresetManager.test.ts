// ─── VstPresetManager.test.ts ─────────────────────────────────────────────────
// Mock localStorage before importing VstPresetManager

// ── Mock localStorage ─────────────────────────────────────────────────────────
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string): string | null => store[key] ?? null,
  setItem: (key: string, value: string): void => { store[key] = value },
  removeItem: (key: string): void => { delete store[key] },
  clear: (): void => { for (const k in store) delete store[k] },
  key: (_index: number): string | null => null,
  get length(): number { return Object.keys(store).length },
}

// Install mock globally before module import
// @ts-expect-error global localStorage mock
globalThis.localStorage = localStorageMock

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VstPresetManager } from '../../src/renderer/src/audio/vst/VstPresetManager.ts'

describe('VstPresetManager', () => {
  it('savePreset creates entry with correct name and pluginId', () => {
    // Clear storage for fresh state
    localStorageMock.clear()
    const m = new VstPresetManager()
    const preset = m.savePreset('My Preset', 'synth_plugin', [0.1, 0.5, 0.9])
    assert.equal(preset.name, 'My Preset')
    assert.equal(preset.pluginId, 'synth_plugin')
    assert.ok(preset.id.length > 0)
    assert.ok(preset.createdAt > 0)
  })

  it('getPresetsForPlugin returns only matching pluginId entries', () => {
    localStorageMock.clear()
    const m = new VstPresetManager()
    m.savePreset('Preset A', 'plugin_x', [0.1])
    m.savePreset('Preset B', 'plugin_y', [0.2])
    m.savePreset('Preset C', 'plugin_x', [0.3])

    const forX = m.getPresetsForPlugin('plugin_x')
    assert.ok(forX.every(p => p.pluginId === 'plugin_x'))
    assert.equal(forX.length, 2)

    const forY = m.getPresetsForPlugin('plugin_y')
    assert.ok(forY.every(p => p.pluginId === 'plugin_y'))
    assert.equal(forY.length, 1)
  })

  it('deletePreset removes the entry', () => {
    localStorageMock.clear()
    const m = new VstPresetManager()
    const preset = m.savePreset('Delete Me', 'plugin_del', [0.5])
    assert.ok(m.getPresetsForPlugin('plugin_del').some(p => p.id === preset.id))
    m.deletePreset(preset.id)
    assert.ok(!m.getPresetsForPlugin('plugin_del').some(p => p.id === preset.id))
  })

  it('exportPreset + importPreset round-trip (same name, same pluginId, new id)', () => {
    localStorageMock.clear()
    const m = new VstPresetManager()
    const original = m.savePreset('Export Test', 'plugin_exp', [0.1, 0.2, 0.3])
    const json = m.exportPreset(original.id)

    // Parse and verify it's valid JSON
    const parsed = JSON.parse(json) as { name: string; pluginId: string; id: string }
    assert.equal(parsed.name, 'Export Test')
    assert.equal(parsed.pluginId, 'plugin_exp')

    // Import into a fresh manager (separate storage cleared)
    localStorageMock.clear()
    const m2 = new VstPresetManager()
    const imported = m2.importPreset(json)
    assert.equal(imported.name, 'Export Test')
    assert.equal(imported.pluginId, 'plugin_exp')
    assert.notEqual(imported.id, original.id)  // New id generated
  })

  it('getAllPresets returns all saved presets', () => {
    localStorageMock.clear()
    const m = new VstPresetManager()
    m.savePreset('P1', 'plug1', [0.1])
    m.savePreset('P2', 'plug2', [0.2])
    m.savePreset('P3', 'plug3', [0.3])
    const all = m.getAllPresets()
    assert.equal(all.length, 3)
  })

  it('loadPresetState parses state JSON correctly', () => {
    localStorageMock.clear()
    const m = new VstPresetManager()
    const state = [0.1, 0.2, 0.3, 0.4, 0.5]
    const preset = m.savePreset('State Test', 'plugin_st', state)
    const loaded = m.loadPresetState(preset.id)
    assert.deepEqual(loaded, state)
  })

  it('loadPresetState throws for unknown presetId', () => {
    localStorageMock.clear()
    const m = new VstPresetManager()
    assert.throws(() => m.loadPresetState('nonexistent_id'), /not found/i)
  })
})
