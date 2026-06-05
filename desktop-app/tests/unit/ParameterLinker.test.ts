// ─── ParameterLinker.test.ts ───────────────────────────────────────────────────

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ParameterLinker } from '../../src/renderer/src/audio/automation/ParameterLinker.ts'
import { AutomationEngine } from '../../src/renderer/src/audio/automation/AutomationEngine.ts'
import type { AutomationTarget } from '../../src/renderer/src/audio/automation/AutomationTypes.ts'

function makeTarget(overrides: Partial<AutomationTarget> = {}): AutomationTarget {
  return {
    type: 'track-volume',
    trackId: 'track_1',
    paramName: 'Volume',
    minValue: 0,
    maxValue: 200,
    defaultValue: 0.75,
    ...overrides,
  }
}

describe('ParameterLinker', () => {
  let linker: ParameterLinker
  let engine: AutomationEngine

  beforeEach(() => {
    linker = new ParameterLinker()
    engine = new AutomationEngine()
  })

  it('link + isLinked: true', () => {
    const setter = (_v: number) => {}
    linker.link('lane1', setter)
    assert.strictEqual(linker.isLinked('lane1'), true)
  })

  it('unlink + isLinked: false', () => {
    const setter = (_v: number) => {}
    linker.link('lane1', setter)
    linker.unlink('lane1')
    assert.strictEqual(linker.isLinked('lane1'), false)
  })

  it('applyAll: calls setter with correct denormalized value (mock setter with spy)', () => {
    let called = 0
    let lastVal = 0
    const setter = (v: number) => {
      called++
      lastVal = v
    }

    const lane = engine.addLane(makeTarget({ minValue: 0, maxValue: 200 }))
    engine.addPoint(lane.id, 0, 0.5, 'linear')
    engine.addPoint(lane.id, 4, 0.5, 'linear')
    linker.link(lane.id, setter)

    linker.applyAll(2, engine)

    assert.strictEqual(called, 1)
    assert.ok(Math.abs(lastVal - 100) < 0.01, `Expected 100, got ${lastVal}`)
  })

  it('applyAll with disabled lane: setter NOT called', () => {
    let called = 0
    const setter = (_v: number) => { called++ }

    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0.5, 'linear')
    engine.setLaneEnabled(lane.id, false)
    linker.link(lane.id, setter)

    linker.applyAll(1, engine)
    assert.strictEqual(called, 0)
  })

  it('link returns unlink fn that works', () => {
    let called = 0
    const setter = (_v: number) => { called++ }

    const lane = engine.addLane(makeTarget())
    engine.addPoint(lane.id, 0, 0.5, 'linear')
    engine.addPoint(lane.id, 4, 0.5, 'linear')

    const unlink = linker.link(lane.id, setter)
    assert.strictEqual(linker.isLinked(lane.id), true)

    unlink()
    assert.strictEqual(linker.isLinked(lane.id), false)

    linker.applyAll(2, engine)
    assert.strictEqual(called, 0)
  })
})
