// ─── VstPipeline.integration.test.ts ─────────────────────────────────────────
// Integration tests for VST subsystem.

// Mock localStorage before imports (required by VstPresetManager)
const _vstPipelineStore: Record<string, string> = {}
// @ts-expect-error global localStorage mock
globalThis.localStorage = {
  getItem: (key: string): string | null => _vstPipelineStore[key] ?? null,
  setItem: (key: string, value: string): void => { _vstPipelineStore[key] = value },
  removeItem: (key: string): void => { delete _vstPipelineStore[key] },
  clear: (): void => { for (const k in _vstPipelineStore) delete _vstPipelineStore[k] },
  key: (_index: number): string | null => null,
  get length(): number { return Object.keys(_vstPipelineStore).length },
}

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FxChain } from '../../src/renderer/src/audio/vst/FxChain'
import { InstrumentRack } from '../../src/renderer/src/audio/vst/InstrumentRack'
import { VstAudioRouter } from '../../src/renderer/src/audio/vst/VstAudioRouter'
import { VstParameterManager } from '../../src/renderer/src/audio/vst/VstParameterManager'
import { VstPresetManager } from '../../src/renderer/src/audio/vst/VstPresetManager'

describe('VstPipeline.integration', () => {
  it('FxChain: add 3 effects, remove middle one, order preserved', () => {
    const chain = new FxChain('track-fxchain-1')
    const slotA = chain.addEffect('plugin-a', 'Plugin A')
    const slotB = chain.addEffect('plugin-b', 'Plugin B')
    const slotC = chain.addEffect('plugin-c', 'Plugin C')

    chain.removeEffect(slotB.slotId)

    const slots = chain.getSlots()
    assert.equal(slots.length, 2, 'Should have 2 slots after removing middle')
    assert.equal(slots[0]!.pluginId, slotA.pluginId)
    assert.equal(slots[1]!.pluginId, slotC.pluginId)
  })

  it('FxChain: moveEffect last→first reorders correctly', () => {
    const chain = new FxChain('track-fxchain-2')
    const slotA = chain.addEffect('plugin-a', 'Plugin A')
    const slotB = chain.addEffect('plugin-b', 'Plugin B')
    const slotC = chain.addEffect('plugin-c', 'Plugin C')

    chain.moveEffect(slotC.slotId, 0)

    const slots = chain.getSlots()
    assert.equal(slots[0]!.pluginId, slotC.pluginId, 'C should be first')
    assert.equal(slots[1]!.pluginId, slotA.pluginId, 'A should be second')
    assert.equal(slots[2]!.pluginId, slotB.pluginId, 'B should be third')
  })

  it('FxChain: serializeState has correct slot count', () => {
    const chain = new FxChain('track-fxchain-3')
    chain.addEffect('plugin-a', 'Plugin A')
    chain.addEffect('plugin-b', 'Plugin B')

    const serialized = chain.serializeState()
    assert.equal(serialized.slots.length, 2, 'Serialized state should have 2 slots')
  })

  it('FxChain: restoreState from serialized data reconstructs slots', () => {
    const chain1 = new FxChain('track-fxchain-4')
    chain1.addEffect('plugin-a', 'Plugin A')
    chain1.addEffect('plugin-b', 'Plugin B')
    const serialized = chain1.serializeState()

    const chain2 = new FxChain('track-fxchain-4')
    chain2.restoreState(serialized)
    assert.equal(chain2.getSlots().length, 2, 'Restored chain should have 2 slots')
  })

  it('InstrumentRack: getActiveLayersForNote(60, 80) returns correct layers', () => {
    const rack = new InstrumentRack('track-rack-1')

    // Layer 1: noteRange 50-70, velocity 60-100 → should match note=60, vel=80
    const layer1 = rack.addLayer('p1', 'Synth 1', 'inst-1')
    rack.setLayerNoteRange(layer1.layerId, 50, 70)
    rack.setLayerVelocityRange(layer1.layerId, 60, 100)

    // Layer 2: noteRange 70-80 → should NOT match note=60
    const layer2 = rack.addLayer('p2', 'Synth 2', 'inst-2')
    rack.setLayerNoteRange(layer2.layerId, 70, 80)

    const active = rack.getActiveLayersForNote(60, 80)

    assert.ok(active.some(l => l.layerId === layer1.layerId), 'Layer 1 should be active for note=60, vel=80')
    assert.ok(!active.some(l => l.layerId === layer2.layerId), 'Layer 2 should NOT be active for note=60')
  })

  it('InstrumentRack: layers have correct defaults', () => {
    const rack = new InstrumentRack('track-rack-2')
    const layer = rack.addLayer('plugin-x', 'Synth X', 'inst-x')

    assert.equal(layer.noteRangeLow, 0)
    assert.equal(layer.noteRangeHigh, 127)
    assert.equal(layer.velocityLow, 0)
    assert.equal(layer.velocityHigh, 127)
    assert.equal(layer.gainDb, 0)
    assert.equal(layer.active, true)
  })

  it('VstAudioRouter: topological sort A→B→mixer returns [A,B]', () => {
    const router = new VstAudioRouter()
    router.addRoute({ fromInstanceId: 'A', toInstanceId: 'B', fromBusIndex: 0, toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'B', toInstanceId: 'mixer', fromBusIndex: 0, toBusIndex: 0, gainDb: 0 })

    const order = router.getOutputOrder()
    assert.ok(order.includes('A'), 'Order should contain A')
    assert.ok(order.includes('B'), 'Order should contain B')

    const idxA = order.indexOf('A')
    const idxB = order.indexOf('B')
    assert.ok(idxA < idxB, `A should come before B in output order, got idxA=${idxA}, idxB=${idxB}`)
  })

  it('VstAudioRouter: cycle A→B and B→A detected', () => {
    const router = new VstAudioRouter()
    router.addRoute({ fromInstanceId: 'A', toInstanceId: 'B', fromBusIndex: 0, toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'B', toInstanceId: 'A', fromBusIndex: 0, toBusIndex: 0, gainDb: 0 })

    assert.equal(router.detectCycles(), true, 'Should detect cycle A→B→A')
  })

  it('VstParameterManager: exponential curve interpolation', () => {
    const manager = new VstParameterManager()

    manager.addAutomation('inst-1', 0, [
      { beatPosition: 0, value: 0, curve: 'exponential' },
      { beatPosition: 4, value: 1, curve: 'exponential' },
    ])

    const midValue = manager.getValueAtBeat('inst-1', 0, 2)
    // With exponential curve (t^2), at t=0.5 → value = 0.25
    assert.ok(midValue > 0, `Mid value should be > 0, got ${midValue}`)
    assert.ok(midValue < 1, `Mid value should be < 1, got ${midValue}`)
  })

  it('VstPresetManager: importPreset gets new id different from original', () => {
    // Use a fresh instance to avoid localStorage issues
    const manager = new VstPresetManager()

    const saved = manager.savePreset('Test Preset', 'plugin-test', [0.5, 0.3, 0.7])
    const exported = manager.exportPreset(saved.id)
    const imported = manager.importPreset(exported)

    assert.notEqual(imported.id, saved.id, 'Imported preset should have a different id')
    assert.equal(imported.name, saved.name, 'Imported preset should have same name')
  })
})
