// ─── AutomationCurvePresets.test.ts ───────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CURVE_PRESETS,
  getCurvePreset,
} from '../../src/renderer/src/audio/automation/AutomationCurvePresets.ts'

describe('AutomationCurvePresets', () => {
  it('CURVE_PRESETS has 8 presets', () => {
    assert.strictEqual(CURVE_PRESETS.length, 8)
  })

  it('getCurvePreset("fade-in") is defined', () => {
    const preset = getCurvePreset('fade-in')
    assert.ok(preset !== undefined)
    assert.strictEqual(preset.id, 'fade-in')
  })

  it('getCurvePreset("nonexistent") is undefined', () => {
    assert.strictEqual(getCurvePreset('nonexistent'), undefined)
  })

  it('fade-in generate: first point value=0, last point value=1', () => {
    const preset = getCurvePreset('fade-in')!
    const pts = preset.generate(0, 4)
    assert.ok(pts.length >= 2)
    assert.strictEqual(pts[0]!.value, 0)
    assert.strictEqual(pts[pts.length - 1]!.value, 1)
  })

  it('s-curve generate: 2 points, curveType="bezier"', () => {
    const preset = getCurvePreset('s-curve')!
    const pts = preset.generate(0, 4)
    assert.strictEqual(pts.length, 2)
    assert.strictEqual(pts[0]!.curveType, 'bezier')
    assert.strictEqual(pts[1]!.curveType, 'bezier')
  })

  it('lfo-sine generate: 5 points', () => {
    const preset = getCurvePreset('lfo-sine')!
    const pts = preset.generate(0, 4)
    assert.strictEqual(pts.length, 5)
  })

  it('All presets generate: at least 2 points, all values in [0,1], all beats in [startBeat,endBeat]', () => {
    const startBeat = 2
    const endBeat = 10

    for (const preset of CURVE_PRESETS) {
      const pts = preset.generate(startBeat, endBeat)
      assert.ok(
        pts.length >= 2,
        `Preset "${preset.id}" should generate at least 2 points, got ${pts.length}`
      )
      for (const p of pts) {
        assert.ok(
          p.value >= 0 && p.value <= 1,
          `Preset "${preset.id}" point value ${p.value} out of [0,1]`
        )
        assert.ok(
          p.beat >= startBeat && p.beat <= endBeat,
          `Preset "${preset.id}" point beat ${p.beat} out of [${startBeat},${endBeat}]`
        )
      }
    }
  })
})
