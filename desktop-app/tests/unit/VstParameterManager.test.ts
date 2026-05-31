// ─── VstParameterManager.test.ts ──────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VstParameterManager } from '../../src/renderer/src/audio/vst/VstParameterManager.ts'

describe('VstParameterManager', () => {
  it('addAutomation + getValueAtBeat at exact point returns exact value', () => {
    const m = new VstParameterManager()
    m.addAutomation('inst1', 0, [
      { beatPosition: 0, value: 0.2, curve: 'linear' },
      { beatPosition: 4, value: 0.8, curve: 'linear' },
    ])
    assert.equal(m.getValueAtBeat('inst1', 0, 0), 0.2)
    assert.equal(m.getValueAtBeat('inst1', 0, 4), 0.8)
  })

  it('getValueAtBeat between two linear points → correct interpolation', () => {
    const m = new VstParameterManager()
    m.addAutomation('inst2', 1, [
      { beatPosition: 0, value: 0.0, curve: 'linear' },
      { beatPosition: 4, value: 1.0, curve: 'linear' },
    ])
    const val = m.getValueAtBeat('inst2', 1, 2)
    // t = 0.5, linear: 0 + 0.5 * 1 = 0.5
    assert.ok(Math.abs(val - 0.5) < 0.001, `Expected ~0.5, got ${val}`)
  })

  it('getValueAtBeat before first point returns first value', () => {
    const m = new VstParameterManager()
    m.addAutomation('inst3', 0, [
      { beatPosition: 2, value: 0.7, curve: 'linear' },
      { beatPosition: 8, value: 0.3, curve: 'linear' },
    ])
    assert.equal(m.getValueAtBeat('inst3', 0, 0), 0.7)
    assert.equal(m.getValueAtBeat('inst3', 0, 1), 0.7)
  })

  it('getValueAtBeat after last point returns last value', () => {
    const m = new VstParameterManager()
    m.addAutomation('inst4', 2, [
      { beatPosition: 0, value: 0.1, curve: 'linear' },
      { beatPosition: 4, value: 0.9, curve: 'linear' },
    ])
    assert.equal(m.getValueAtBeat('inst4', 2, 10), 0.9)
    assert.equal(m.getValueAtBeat('inst4', 2, 100), 0.9)
  })

  it('getValueAtBeat with no automation returns 0.5', () => {
    const m = new VstParameterManager()
    assert.equal(m.getValueAtBeat('no_instance', 0, 2), 0.5)
  })

  it('getAutomatedParams returns correct indices', () => {
    const m = new VstParameterManager()
    m.addAutomation('inst5', 0, [{ beatPosition: 0, value: 0.5, curve: 'linear' }])
    m.addAutomation('inst5', 3, [{ beatPosition: 0, value: 0.5, curve: 'linear' }])
    m.addAutomation('inst5', 7, [{ beatPosition: 0, value: 0.5, curve: 'linear' }])
    const params = m.getAutomatedParams('inst5').sort((a, b) => a - b)
    assert.deepEqual(params, [0, 3, 7])
  })

  it('clearInstanceAutomation removes all for that instance', () => {
    const m = new VstParameterManager()
    m.addAutomation('inst6', 0, [{ beatPosition: 0, value: 0.5, curve: 'linear' }])
    m.addAutomation('inst6', 1, [{ beatPosition: 0, value: 0.3, curve: 'linear' }])
    m.addAutomation('other', 0, [{ beatPosition: 0, value: 0.9, curve: 'linear' }])

    m.clearInstanceAutomation('inst6')
    assert.deepEqual(m.getAutomatedParams('inst6'), [])
    // Other instance should remain
    assert.deepEqual(m.getAutomatedParams('other'), [0])
  })

  it('serializeAll / deserializeAll round-trip', () => {
    const m = new VstParameterManager()
    const points = [
      { beatPosition: 0, value: 0.2, curve: 'linear' as const },
      { beatPosition: 4, value: 0.8, curve: 'step' as const },
    ]
    m.addAutomation('inst7', 5, points)

    const serialized = m.serializeAll()
    assert.ok(serialized.instances['inst7'])
    assert.ok(serialized.instances['inst7'][5])

    const m2 = new VstParameterManager()
    m2.deserializeAll(serialized)
    assert.deepEqual(m2.getAutomatedParams('inst7'), [5])
    const val = m2.getValueAtBeat('inst7', 5, 0)
    assert.ok(Math.abs(val - 0.2) < 0.001)
  })

  it('step curve returns previous point value', () => {
    const m = new VstParameterManager()
    m.addAutomation('inst8', 0, [
      { beatPosition: 0, value: 0.1, curve: 'step' },
      { beatPosition: 4, value: 0.9, curve: 'step' },
    ])
    // Between 0 and 4, step curve should return p1.value = 0.1
    const val = m.getValueAtBeat('inst8', 0, 2)
    assert.ok(Math.abs(val - 0.1) < 0.001, `Expected 0.1 for step curve, got ${val}`)
  })

  it('exponential curve blends with squared t', () => {
    const m = new VstParameterManager()
    m.addAutomation('inst9', 0, [
      { beatPosition: 0, value: 0.0, curve: 'exponential' },
      { beatPosition: 4, value: 1.0, curve: 'exponential' },
    ])
    // t = 0.5, exponential: Math.pow(0.5, 2) = 0.25
    const val = m.getValueAtBeat('inst9', 0, 2)
    assert.ok(Math.abs(val - 0.25) < 0.001, `Expected ~0.25, got ${val}`)
  })
})
