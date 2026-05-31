// ─── FxChain.test.ts ──────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FxChain } from '../../src/renderer/src/audio/vst/FxChain.ts'

describe('FxChain', () => {
  it('addEffect creates slot with correct pluginId and pluginName', () => {
    const chain = new FxChain('track-1')
    const slot = chain.addEffect('reverb_plugin', 'Valhalla Room')
    assert.equal(slot.pluginId, 'reverb_plugin')
    assert.equal(slot.pluginName, 'Valhalla Room')
    assert.equal(slot.bypassed, false)
    assert.equal(slot.gainDb, 0)
    assert.ok(slot.slotId.length > 0)
  })

  it('removeEffect removes the correct slot', () => {
    const chain = new FxChain('track-2')
    const s1 = chain.addEffect('p1', 'Plugin 1')
    const s2 = chain.addEffect('p2', 'Plugin 2')
    chain.removeEffect(s1.slotId)
    const slots = chain.getSlots()
    assert.equal(slots.length, 1)
    assert.equal(slots[0].slotId, s2.slotId)
  })

  it('moveEffect: add 3 slots, move last to index 0 → verify order', () => {
    const chain = new FxChain('track-3')
    const s1 = chain.addEffect('p1', 'Plugin 1')
    const s2 = chain.addEffect('p2', 'Plugin 2')
    const s3 = chain.addEffect('p3', 'Plugin 3')

    // Move last (s3) to index 0
    chain.moveEffect(s3.slotId, 0)

    const slots = chain.getSlots()
    assert.equal(slots.length, 3)
    assert.equal(slots[0].slotId, s3.slotId)
    assert.equal(slots[1].slotId, s1.slotId)
    assert.equal(slots[2].slotId, s2.slotId)
  })

  it('setSlotBypassed toggles bypassed flag', () => {
    const chain = new FxChain('track-4')
    const slot = chain.addEffect('p1', 'Plugin 1')
    assert.equal(slot.bypassed, false)

    chain.setSlotBypassed(slot.slotId, true)
    assert.equal(chain.getSlot(slot.slotId)?.bypassed, true)

    chain.setSlotBypassed(slot.slotId, false)
    assert.equal(chain.getSlot(slot.slotId)?.bypassed, false)
  })

  it('setSlotGain sets gainDb correctly', () => {
    const chain = new FxChain('track-5')
    const slot = chain.addEffect('p1', 'Plugin 1')
    chain.setSlotGain(slot.slotId, -6)
    assert.equal(chain.getSlot(slot.slotId)?.gainDb, -6)

    chain.setSlotGain(slot.slotId, 3)
    assert.equal(chain.getSlot(slot.slotId)?.gainDb, 3)
  })

  it('serializeState / restoreState round-trip (same slot count, same pluginIds)', () => {
    const chain = new FxChain('track-6')
    chain.addEffect('p1', 'Plugin 1')
    chain.addEffect('p2', 'Plugin 2')
    chain.addEffect('p3', 'Plugin 3')
    chain.setSlotBypassed(chain.getSlots()[1].slotId, true)
    chain.setSlotGain(chain.getSlots()[2].slotId, -3)

    const serialized = chain.serializeState()
    assert.equal(serialized.slots.length, 3)
    assert.equal(serialized.trackId, 'track-6')

    const chain2 = new FxChain('track-6')
    chain2.restoreState(serialized)

    const slots2 = chain2.getSlots()
    assert.equal(slots2.length, 3)
    assert.equal(slots2[0].pluginId, 'p1')
    assert.equal(slots2[1].pluginId, 'p2')
    assert.equal(slots2[2].pluginId, 'p3')
    assert.equal(slots2[1].bypassed, true)
    assert.equal(slots2[2].gainDb, -3)
  })

  it('getSlot returns undefined for unknown slotId', () => {
    const chain = new FxChain('track-7')
    assert.equal(chain.getSlot('nonexistent'), undefined)
  })

  it('moveEffect clamps to valid index', () => {
    const chain = new FxChain('track-8')
    const s1 = chain.addEffect('p1', 'Plugin 1')
    const s2 = chain.addEffect('p2', 'Plugin 2')

    // Move s1 beyond end — should clamp to end
    chain.moveEffect(s1.slotId, 999)
    const slots = chain.getSlots()
    assert.equal(slots[0].slotId, s2.slotId)
    assert.equal(slots[1].slotId, s1.slotId)
  })
})
