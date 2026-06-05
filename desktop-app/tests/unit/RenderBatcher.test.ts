import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RenderBatcher } from '../../src/renderer/src/audio/perf/RenderBatcher.ts'

// Stub RAF: collect callbacks, expose flush helper
const _rafQueue: Array<(t: number) => void> = []
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { _rafQueue.push(cb as (t: number) => void); return _rafQueue.length }
globalThis.cancelAnimationFrame  = () => {}
function flushRaf(t = 16): void { _rafQueue.splice(0).forEach(cb => cb(t)) }

test('schedule() increments pendingCount', () => {
  const b = new RenderBatcher()
  b.schedule(() => {})
  b.schedule(() => {})
  assert.strictEqual(b.pendingCount, 2)
  b.dispose()
})

test('scheduleKeyed with same key: only latest callback runs', () => {
  const b = new RenderBatcher()
  let ran = 0
  b.scheduleKeyed('k', () => { ran = 1 })
  b.scheduleKeyed('k', () => { ran = 2 })
  flushRaf()
  assert.strictEqual(ran, 2)
  b.dispose()
})

test('dispose() clears pending', () => {
  const b = new RenderBatcher()
  b.schedule(() => {})
  b.schedule(() => {})
  b.dispose()
  assert.strictEqual(b.pendingCount, 0)
})

test('pendingCount after flush is 0', () => {
  const b = new RenderBatcher()
  b.schedule(() => {})
  flushRaf()
  assert.strictEqual(b.pendingCount, 0)
  b.dispose()
})
