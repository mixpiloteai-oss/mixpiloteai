import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Mock localStorage for Node environment
const store: Record<string, string> = {}
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}
// @ts-expect-error — patching global for tests
globalThis.localStorage = mockLocalStorage

import { InstrumentPresetManager, SYNTH_FACTORY_PRESETS } from '../../src/renderer/src/audio/instruments/InstrumentPresetManager.ts'
import type { SynthParams } from '../../src/renderer/src/audio/instruments/SubtractiveSynth.ts'
import { DEFAULT_SYNTH_PARAMS } from '../../src/renderer/src/audio/instruments/SubtractiveSynth.ts'

test('factory presets are returned in list()', () => {
  const mgr = new InstrumentPresetManager<SynthParams>('subtractive-synth', SYNTH_FACTORY_PRESETS)
  const list = mgr.list()
  assert.ok(list.length >= 4)
  assert.ok(list.some(p => p.isFactory))
})

test('save adds a user preset', () => {
  const mgr = new InstrumentPresetManager<SynthParams>('subtractive-synth', [])
  const preset = mgr.save('Test Pad', { ...DEFAULT_SYNTH_PARAMS, attack: 1.5 })
  assert.strictEqual(preset.name, 'Test Pad')
  assert.strictEqual(preset.params.attack, 1.5)
  assert.strictEqual(preset.isFactory, false)
})

test('load returns saved preset by id', () => {
  const mgr = new InstrumentPresetManager<SynthParams>('subtractive-synth', [])
  const saved = mgr.save('MyPreset', { ...DEFAULT_SYNTH_PARAMS })
  const loaded = mgr.load(saved.id)
  assert.ok(loaded !== null)
  assert.strictEqual(loaded!.name, 'MyPreset')
})

test('delete removes user preset', () => {
  const mgr = new InstrumentPresetManager<SynthParams>('subtractive-synth', [])
  const saved = mgr.save('ToDelete', { ...DEFAULT_SYNTH_PARAMS })
  mgr.delete(saved.id)
  assert.strictEqual(mgr.load(saved.id), null)
})

test('save with same name replaces existing preset', () => {
  const mgr = new InstrumentPresetManager<SynthParams>('subtractive-synth', [])
  mgr.save('Dup', { ...DEFAULT_SYNTH_PARAMS, attack: 0.1 })
  mgr.save('Dup', { ...DEFAULT_SYNTH_PARAMS, attack: 0.9 })
  const list = mgr.list()
  const matches = list.filter(p => p.name === 'Dup')
  assert.strictEqual(matches.length, 1)
  assert.strictEqual(matches[0]!.params.attack, 0.9)
})

test('factory presets have isFactory=true', () => {
  const mgr = new InstrumentPresetManager<SynthParams>('subtractive-synth', SYNTH_FACTORY_PRESETS)
  const factories = mgr.list().filter(p => p.isFactory)
  assert.ok(factories.length > 0)
  factories.forEach(f => assert.strictEqual(f.isFactory, true))
})
