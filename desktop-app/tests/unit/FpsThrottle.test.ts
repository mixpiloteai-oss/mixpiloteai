import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FpsThrottle } from '../../src/renderer/src/audio/perf/FpsThrottle.ts'

// Stub requestAnimationFrame for Node
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1 }
globalThis.cancelAnimationFrame  = () => {}

test('constructor sets correct minInterval for 60fps', () => {
  const t = new FpsThrottle(60)
  assert.ok(Math.abs(t.minIntervalMs - (1000 / 60)) < 0.01)
})

test('setTargetFps updates targetFps', () => {
  const t = new FpsThrottle(60)
  t.setTargetFps(30)
  assert.strictEqual(t.targetFps, 30)
})

test('targetFps getter returns correct value', () => {
  const t = new FpsThrottle(120)
  assert.strictEqual(t.targetFps, 120)
})

test('30fps: minInterval = 1000/30 ≈ 33.33ms', () => {
  const t = new FpsThrottle(30)
  assert.ok(Math.abs(t.minIntervalMs - (1000 / 30)) < 0.01)
})
