// ─── AutomationGenerator.test.ts ──────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateAutomation } from '../../src/renderer/src/audio/ai/AutomationGenerator.ts'

describe('AutomationGenerator', () => {
  it('filter_sweep_up 2 bars → first value < last value (rising)', () => {
    const curve = generateAutomation('filter_sweep_up', 2, 'linear', 0)
    assert.ok(curve.points.length > 0, 'Should have points')
    const first = curve.points[0]!.value
    const last  = curve.points[curve.points.length - 1]!.value
    assert.ok(last > first, `Expected rising: first=${first}, last=${last}`)
  })

  it('filter_sweep_down 1 bar → first value > last value (falling)', () => {
    const curve = generateAutomation('filter_sweep_down', 1, 'linear', 0)
    const first = curve.points[0]!.value
    const last  = curve.points[curve.points.length - 1]!.value
    assert.ok(first > last, `Expected falling: first=${first}, last=${last}`)
  })

  it('vibrato 1 bar → values oscillate (not monotone)', () => {
    const curve = generateAutomation('vibrato', 1, 'sine', 0)
    const values = curve.points.map(p => p.value)
    let hasIncrease = false
    let hasDecrease = false
    for (let i = 1; i < values.length; i++) {
      const diff = values[i]! - values[i - 1]!
      if (diff > 0.001) hasIncrease = true
      if (diff < -0.001) hasDecrease = true
    }
    assert.ok(hasIncrease && hasDecrease, 'Vibrato should oscillate (both increases and decreases)')
  })

  it('returns bars * 8 points', () => {
    const bars = 3
    const curve = generateAutomation('volume_swell_in', bars, 'linear', 0)
    assert.equal(curve.points.length, bars * 8, `Expected ${bars * 8} points, got ${curve.points.length}`)
  })

  it('all point values in [0, 1]', () => {
    for (const type of ['filter_sweep_up', 'pan_lfo', 'tremolo', 'pitch_riser'] as const) {
      const curve = generateAutomation(type, 2, 'linear', 0)
      for (const p of curve.points) {
        assert.ok(p.value >= 0 && p.value <= 1, `[${type}] value ${p.value} out of [0, 1]`)
      }
    }
  })
})
