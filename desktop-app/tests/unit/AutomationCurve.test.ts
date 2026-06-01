// ─── AutomationCurve.test.ts ───────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cubicBezier,
  evaluateLaneAt,
  smoothPoints,
  scaleValues,
  randomizeValues,
  invertValues,
} from '../../src/renderer/src/audio/automation/AutomationCurve.ts'
import type { AutomationPoint } from '../../src/renderer/src/audio/automation/AutomationTypes.ts'

function makePoint(
  id: string,
  beat: number,
  value: number,
  curveType: AutomationPoint['curveType'] = 'linear'
): AutomationPoint {
  return {
    id,
    beat,
    value,
    curveType,
    inHandle: { dx: -0.2, dy: 0 },
    outHandle: { dx: 0.2, dy: 0 },
  }
}

describe('AutomationCurve', () => {
  it('evaluateLaneAt: empty → 0.5', () => {
    assert.strictEqual(evaluateLaneAt([], 1), 0.5)
  })

  it('evaluateLaneAt: before first point → first value', () => {
    const pts = [makePoint('a', 2, 0.3), makePoint('b', 4, 0.7)]
    assert.strictEqual(evaluateLaneAt(pts, 0), 0.3)
  })

  it('evaluateLaneAt: after last point → last value', () => {
    const pts = [makePoint('a', 0, 0.2), makePoint('b', 4, 0.9)]
    assert.strictEqual(evaluateLaneAt(pts, 10), 0.9)
  })

  it('evaluateLaneAt: at exact beat → that value', () => {
    const pts = [makePoint('a', 0, 0.0), makePoint('b', 2, 0.6), makePoint('c', 4, 1.0)]
    assert.strictEqual(evaluateLaneAt(pts, 2), 0.6)
  })

  it('linear midpoint: 0→1 at t=0.5 between beats 0,1 values 0,1', () => {
    const pts = [makePoint('a', 0, 0, 'linear'), makePoint('b', 1, 1, 'linear')]
    const result = evaluateLaneAt(pts, 0.5)
    assert.ok(Math.abs(result - 0.5) < 0.001, `Expected ~0.5, got ${result}`)
  })

  it('step: value before next point = previous point value', () => {
    const pts = [makePoint('a', 0, 0.2, 'step'), makePoint('b', 2, 0.8, 'step')]
    const result = evaluateLaneAt(pts, 1)
    assert.ok(Math.abs(result - 0.2) < 0.001, `Expected 0.2 (step holds), got ${result}`)
  })

  it('exponential: t=0.5 between 0→1 is less than 0.5 (curved)', () => {
    const pts = [makePoint('a', 0, 0, 'exponential'), makePoint('b', 1, 1, 'exponential')]
    const result = evaluateLaneAt(pts, 0.5)
    assert.ok(result < 0.5, `Exponential at t=0.5 should be < 0.5 (slow start, fast end), got ${result}`)
  })

  it('sine: t=0.5 between 0→1 is exactly 0.5', () => {
    const pts = [makePoint('a', 0, 0, 'sine'), makePoint('b', 1, 1, 'sine')]
    const result = evaluateLaneAt(pts, 0.5)
    assert.ok(Math.abs(result - 0.5) < 0.001, `Sine at t=0.5 should be ~0.5, got ${result}`)
  })

  it('cubicBezier(0,...) = 0 and cubicBezier(1,...) = 1', () => {
    assert.strictEqual(cubicBezier(0, 0, 0, 1, 1), 0)
    assert.strictEqual(cubicBezier(1, 0, 0, 1, 1), 1)
  })

  it('smoothPoints: same length, within-window values changed', () => {
    const pts = [
      makePoint('a', 0, 0.1),
      makePoint('b', 1, 0.9),
      makePoint('c', 2, 0.1),
      makePoint('d', 3, 0.9),
    ]
    const smoothed = smoothPoints(pts, 1.5)
    assert.strictEqual(smoothed.length, pts.length)
    // Middle points should be averaged/changed
    assert.ok(
      smoothed[1]!.value !== pts[1]!.value || smoothed[2]!.value !== pts[2]!.value,
      'Expected at least one value changed by smoothing'
    )
  })

  it('scaleValues: factor=2, pivot=0.5: 0.75 → 1.0 (clamped), 0.25 → 0.0', () => {
    const pts = [makePoint('a', 0, 0.75), makePoint('b', 1, 0.25)]
    const scaled = scaleValues(pts, 2, 0.5)
    assert.strictEqual(scaled[0]!.value, 1.0)
    assert.strictEqual(scaled[1]!.value, 0.0)
  })

  it('randomizeValues: all in [0,1], length unchanged', () => {
    const pts = Array.from({ length: 8 }, (_, i) => makePoint(`p${i}`, i, 0.5))
    const rng = { next: () => Math.random() }
    const randomized = randomizeValues(pts, 0.3, rng)
    assert.strictEqual(randomized.length, pts.length)
    for (const p of randomized) {
      assert.ok(p.value >= 0 && p.value <= 1, `Value ${p.value} out of [0,1]`)
    }
  })

  it('invertValues: 0.3 → 0.7', () => {
    const pts = [makePoint('a', 0, 0.3)]
    const inverted = invertValues(pts)
    assert.ok(Math.abs(inverted[0]!.value - 0.7) < 0.001)
  })
})
