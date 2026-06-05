// ─── AutomationRecorder.test.ts ────────────────────────────────────────────────

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { AutomationRecorder } from '../../src/renderer/src/audio/automation/AutomationRecorder.ts'
import { AutomationEngine } from '../../src/renderer/src/audio/automation/AutomationEngine.ts'
import type { AutomationTarget } from '../../src/renderer/src/audio/automation/AutomationTypes.ts'

function makeTarget(): AutomationTarget {
  return {
    type: 'track-volume',
    trackId: 'track_1',
    paramName: 'Volume',
    minValue: 0,
    maxValue: 1,
    defaultValue: 0.75,
  }
}

describe('AutomationRecorder', () => {
  let recorder: AutomationRecorder

  beforeEach(() => {
    recorder = new AutomationRecorder()
  })

  it('captureValue before start(): ignored (buffer empty after stop)', () => {
    recorder.captureValue('lane1', 0, 0.5)
    recorder.captureValue('lane1', 1, 0.8)
    const data = recorder.stop()
    assert.strictEqual(data.get('lane1'), undefined)
  })

  it('captureValue after start(): buffered', () => {
    recorder.start(0)
    recorder.captureValue('lane1', 0, 0.5)
    const data = recorder.stop()
    assert.ok(data.has('lane1'))
    assert.strictEqual(data.get('lane1')!.length, 1)
  })

  it('rate limiting: same beat twice → only one recorded', () => {
    recorder.start(0)
    recorder.captureValue('lane1', 0, 0.5)
    recorder.captureValue('lane1', 0, 0.8)  // same beat, should be rejected
    const data = recorder.stop()
    assert.strictEqual(data.get('lane1')!.length, 1)
  })

  it('spaced >= sampleInterval: both recorded', () => {
    recorder.start(0)
    recorder.captureValue('lane1', 0, 0.5)
    recorder.captureValue('lane1', 0.0625, 0.8)  // exactly sampleInterval apart
    const data = recorder.stop()
    assert.strictEqual(data.get('lane1')!.length, 2)
  })

  it('stop() returns Map with captured laneId data', () => {
    recorder.start(0)
    recorder.captureValue('laneA', 0, 0.3)
    recorder.captureValue('laneB', 0, 0.7)
    const data = recorder.stop()
    assert.ok(data.has('laneA'))
    assert.ok(data.has('laneB'))
    assert.strictEqual(data.get('laneA')!.length, 1)
    assert.strictEqual(data.get('laneB')!.length, 1)
  })

  it('isRecording: true after start, false after stop', () => {
    assert.strictEqual(recorder.isRecording, false)
    recorder.start(0)
    assert.strictEqual(recorder.isRecording, true)
    recorder.stop()
    assert.strictEqual(recorder.isRecording, false)
  })

  it('setSampleInterval: changes threshold (verify by capturing two events)', () => {
    recorder.setSampleInterval(0.5)
    assert.ok(Math.abs(recorder.sampleInterval - 0.5) < 0.001)

    recorder.start(0)
    recorder.captureValue('lane1', 0, 0.5)
    recorder.captureValue('lane1', 0.25, 0.6)  // too close (< 0.5)
    recorder.captureValue('lane1', 0.5, 0.7)   // exactly at interval
    const data = recorder.stop()
    // Should have 2: beat 0 and beat 0.5
    assert.strictEqual(data.get('lane1')!.length, 2)
  })

  it('mergeIntoLane: adds points to engine lane (verify point count)', () => {
    const engine = new AutomationEngine()
    const lane = engine.addLane(makeTarget())

    recorder.start(0)
    recorder.captureValue(lane.id, 0, 0.3)
    recorder.captureValue(lane.id, 0.0625, 0.5)
    recorder.captureValue(lane.id, 0.125, 0.7)
    const data = recorder.stop()

    const changes = data.get(lane.id)!
    recorder.mergeIntoLane(lane.id, changes, engine)
    assert.strictEqual(engine.getLane(lane.id)!.points.length, 3)
  })
})
