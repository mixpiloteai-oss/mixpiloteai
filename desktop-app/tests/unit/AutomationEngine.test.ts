// ─── AutomationEngine.test.ts ──────────────────────────────────────────────────

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { AutomationEngine } from '../../src/renderer/src/audio/automation/AutomationEngine.ts'
import type { AutomationTarget } from '../../src/renderer/src/audio/automation/AutomationTypes.ts'

function makeTarget(overrides: Partial<AutomationTarget> = {}): AutomationTarget {
  return {
    type: 'track-volume',
    trackId: 'track_1',
    paramName: 'Volume',
    minValue: 0,
    maxValue: 1,
    defaultValue: 0.75,
    ...overrides,
  }
}

describe('AutomationEngine', () => {
  let engine: AutomationEngine

  beforeEach(() => {
    engine = new AutomationEngine()
  })

  it('addLane: returns lane with correct target.paramName', () => {
    const lane = engine.addLane(makeTarget({ paramName: 'Volume' }))
    assert.strictEqual(lane.target.paramName, 'Volume')
    assert.strictEqual(lane.enabled, true)
    assert.strictEqual(lane.points.length, 0)
  })

  it('addPoint: inserts sorted (add beat=2 then beat=1 → first point beat=1)', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 2, 0.5)
    engine.addPoint(lane.id, 1, 0.3)
    const updated = engine.getLane(lane.id)!
    assert.strictEqual(updated.points[0]!.beat, 1)
    assert.strictEqual(updated.points[1]!.beat, 2)
  })

  it('addPoint duplicate within 0.001: updates not duplicates', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 1.0, 0.5)
    engine.addPoint(lane.id, 1.0005, 0.8)
    const updated = engine.getLane(lane.id)!
    assert.strictEqual(updated.points.length, 1)
    assert.ok(Math.abs(updated.points[0]!.value - 0.8) < 0.001)
  })

  it('removePoint: point count decreases by 1', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0.5)
    const pt = engine.addPoint(lane.id, 1, 0.8)!
    engine.addPoint(lane.id, 2, 0.3)
    engine.removePoint(lane.id, pt.id)
    assert.strictEqual(engine.getLane(lane.id)!.points.length, 2)
  })

  it('movePoint: point at new beat', () => {
    const lane = engine.addLane(makeTarget())
    const pt = engine.addPoint(lane.id, 0, 0.5)!
    engine.movePoint(lane.id, pt.id, 3, 0.9)
    const updated = engine.getLane(lane.id)!.points[0]!
    assert.strictEqual(updated.beat, 3)
    assert.ok(Math.abs(updated.value - 0.9) < 0.001)
  })

  it('evaluateAt: 2 linear points beats 0,1 values 0,1 → evaluateAt(0.5)≈0.5', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0, 'linear')
    engine.addPoint(lane.id, 1, 1, 'linear')
    const result = engine.evaluateAt(lane.id, 0.5)
    assert.ok(Math.abs(result - 0.5) < 0.001, `Expected ~0.5, got ${result}`)
  })

  it('evaluateDenormalized: normalized 0.5, min=0, max=200 → 100', () => {
    const lane = engine.addLane(makeTarget({ minValue: 0, maxValue: 200 }))
    engine.addPoint(lane.id, 0, 0.5, 'linear')
    engine.addPoint(lane.id, 4, 0.5, 'linear')
    const result = engine.evaluateDenormalized(lane.id, 2)
    assert.ok(Math.abs(result - 100) < 0.01, `Expected 100, got ${result}`)
  })

  it('evaluateAt disabled lane: returns 0.5', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0, 'linear')
    engine.addPoint(lane.id, 1, 1, 'linear')
    engine.setLaneEnabled(lane.id, false)
    assert.strictEqual(engine.evaluateAt(lane.id, 0.5), 0.5)
  })

  it('clearLane: 0 points after', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0.5)
    engine.addPoint(lane.id, 1, 0.8)
    engine.clearLane(lane.id)
    assert.strictEqual(engine.getLane(lane.id)!.points.length, 0)
  })

  it('suggestAutomation build: first pt value=0, last pt value=1', () => {
    const target = makeTarget()
    const pts = engine.suggestAutomation(target, 'build', 4, 120, 42)
    assert.ok(pts.length >= 2)
    assert.strictEqual(pts[0]!.value, 0)
    assert.strictEqual(pts[pts.length - 1]!.value, 1)
  })

  it('suggestAutomation lfo: returns > 2 points', () => {
    const target = makeTarget()
    const pts = engine.suggestAutomation(target, 'lfo', 4, 120, 42)
    assert.ok(pts.length > 2, `Expected > 2 points, got ${pts.length}`)
  })

  it('scaleRange: points in range scaled, outside unchanged', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0.5)   // outside range
    engine.addPoint(lane.id, 2, 0.5)   // inside range
    engine.addPoint(lane.id, 10, 0.5)  // outside range
    engine.scaleRange(lane.id, 1, 5, 2)
    const pts = engine.getLane(lane.id)!.points
    const outside0 = pts.find((p) => Math.abs(p.beat - 0) < 0.01)!
    const inside2 = pts.find((p) => Math.abs(p.beat - 2) < 0.01)!
    const outside10 = pts.find((p) => Math.abs(p.beat - 10) < 0.01)!
    assert.ok(Math.abs(outside0.value - 0.5) < 0.001, 'Outside pt should be unchanged')
    assert.ok(Math.abs(outside10.value - 0.5) < 0.001, 'Outside pt should be unchanged')
    // inside: scaled with factor=2 around pivot=0.5 → 0.5+(0.5-0.5)*2 = 0.5 (same at pivot)
    // Let's test with a non-pivot value: add 0.75 inside
    engine.addPoint(lane.id, 3, 0.75)
    engine.scaleRange(lane.id, 1, 5, 2)
    const insidePt = engine.getLane(lane.id)!.points.find((p) => Math.abs(p.beat - 3) < 0.01)!
    // 0.75 scaled by 2 around 0.5 = 0.5 + (0.75-0.5)*2 = 1.0
    assert.ok(Math.abs(insidePt.value - 1.0) <= 0.001, `Expected 1.0, got ${insidePt.value}`)
    assert.ok(Math.abs(inside2.value - 0.5) < 0.001, `Inside pt at 0.5 should stay 0.5, got ${inside2.value}`)
  })

  it('invertRange: value 0.3 in range → 0.7', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 2, 0.3)
    engine.invertRange(lane.id, 0, 4)
    const pt = engine.getLane(lane.id)!.points[0]!
    assert.ok(Math.abs(pt.value - 0.7) < 0.001, `Expected 0.7, got ${pt.value}`)
  })

  it('stretchRange: points in range stretched, beat positions changed', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0.5)  // outside
    engine.addPoint(lane.id, 2, 0.5)  // inside
    engine.addPoint(lane.id, 4, 0.5)  // boundary (inside)
    engine.stretchRange(lane.id, 0, 4, 2)
    const pts = engine.getLane(lane.id)!.points
    const pt2 = pts.find((p) => Math.abs(p.beat - 4) < 0.01)
    const pt4 = pts.find((p) => Math.abs(p.beat - 8) < 0.01)
    assert.ok(pt2 !== undefined, 'Beat 2 should be stretched to beat 4')
    assert.ok(pt4 !== undefined, 'Beat 4 should be stretched to beat 8')
  })

  it('createClip: returns AutomationClip with relative points', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0.2)
    engine.addPoint(lane.id, 2, 0.5)
    engine.addPoint(lane.id, 4, 0.8)
    const clip = engine.createClip(lane.id, 2, 4)
    assert.ok(clip.points.length > 0)
    // Points should be relative: beat 2 → 0, beat 4 → 2
    assert.ok(clip.points.some((p) => Math.abs(p.beat - 0) < 0.01))
    assert.ok(clip.points.some((p) => Math.abs(p.beat - 2) < 0.01))
  })

  it('serializeAll / deserializeAll: round-trip same count', () => {
    engine.addLane(makeTarget({ paramName: 'Volume' }))
    engine.addLane(makeTarget({ paramName: 'Pan' }))
    const data = engine.serializeAll()
    const engine2 = new AutomationEngine()
    engine2.deserializeAll(data)
    assert.strictEqual(engine2.getAllLanes().length, 2)
  })

  it('getPointsInRange: returns only points within rect', () => {
    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0.1)   // beat too low (and value low)
    engine.addPoint(lane.id, 2, 0.5)   // inside
    engine.addPoint(lane.id, 3, 0.8)   // inside
    engine.addPoint(lane.id, 6, 0.5)   // beat too high
    const found = engine.getPointsInRange(lane.id, 1, 5, 0.3, 0.9)
    assert.strictEqual(found.length, 2)
  })
})
