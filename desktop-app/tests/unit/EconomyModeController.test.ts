import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EconomyModeController } from '../../src/renderer/src/audio/perf/EconomyModeController.ts'

// Small window size makes tests fast (don't need 90 samples)
function ctrl(opts?: { enter?: number; exit?: number; window?: number }) {
  return new EconomyModeController({
    windowSize:     opts?.window ?? 10,
    enterThreshold: opts?.enter  ?? 40,
    exitThreshold:  opts?.exit   ?? 55,
  })
}

function feed(c: EconomyModeController, fps: number, count: number) {
  for (let i = 0; i < count; i++) c.ingestFps(fps)
}

test('starts in normal mode', () => {
  const c = ctrl()
  assert.strictEqual(c.isEconomy, false)
})

test('does not enter economy before window is full', () => {
  const c = ctrl({ window: 10 })
  feed(c, 10, 9)   // 9 samples of 10 required
  assert.strictEqual(c.isEconomy, false)
})

test('enters economy mode when sustained low FPS fills window', () => {
  const c = ctrl({ window: 10, enter: 40 })
  feed(c, 20, 10)
  assert.strictEqual(c.isEconomy, true)
})

test('does not enter economy when FPS is above threshold', () => {
  const c = ctrl({ window: 10, enter: 40 })
  feed(c, 60, 10)
  assert.strictEqual(c.isEconomy, false)
})

test('exits economy when FPS recovers above exit threshold', () => {
  const c = ctrl({ window: 10, enter: 40, exit: 55 })
  feed(c, 20, 10)    // enter economy
  assert.strictEqual(c.isEconomy, true)
  feed(c, 60, 10)    // exit economy
  assert.strictEqual(c.isEconomy, false)
})

test('stays in economy when recovering FPS is between thresholds (hysteresis)', () => {
  const c = ctrl({ window: 10, enter: 40, exit: 55 })
  feed(c, 20, 10)    // enter economy
  feed(c, 48, 10)    // 48 fps — above enter (40) but below exit (55)
  assert.strictEqual(c.isEconomy, true)
})

test('fires onChange listener on economy entry', () => {
  const c = ctrl({ window: 10, enter: 40 })
  const calls: boolean[] = []
  c.onChange(v => calls.push(v))
  feed(c, 20, 10)
  assert.deepStrictEqual(calls, [true])
})

test('fires onChange listener on economy exit', () => {
  const c = ctrl({ window: 10, enter: 40, exit: 55 })
  const calls: boolean[] = []
  c.onChange(v => calls.push(v))
  feed(c, 20, 10)
  feed(c, 60, 10)
  assert.deepStrictEqual(calls, [true, false])
})

test('unsubscribe prevents further listener calls', () => {
  const c = ctrl({ window: 10, enter: 40 })
  const calls: boolean[] = []
  const unsub = c.onChange(v => calls.push(v))
  unsub()
  feed(c, 20, 10)
  assert.strictEqual(calls.length, 0)
})

test('reset clears history and exits economy mode without firing listener', () => {
  const c = ctrl({ window: 10, enter: 40 })
  const calls: boolean[] = []
  c.onChange(v => calls.push(v))
  feed(c, 20, 10)
  assert.strictEqual(c.isEconomy, true)
  c.reset()
  assert.strictEqual(c.isEconomy, false)
  // reset should NOT fire listeners — it's a hard reset
  assert.deepStrictEqual(calls, [true])
})

test('averageFps returns 0 with empty history', () => {
  const c = ctrl()
  assert.strictEqual(c.averageFps, 0)
})

test('averageFps reflects the rolling window mean', () => {
  const c = ctrl({ window: 4 })
  feed(c, 60, 4)
  assert.ok(Math.abs(c.averageFps - 60) < 0.001)
})

test('windowFill goes from 0 to 1 as samples accumulate', () => {
  const c = ctrl({ window: 10 })
  assert.strictEqual(c.windowFill, 0)
  feed(c, 60, 5)
  assert.ok(Math.abs(c.windowFill - 0.5) < 0.001)
  feed(c, 60, 5)
  assert.ok(Math.abs(c.windowFill - 1) < 0.001)
})

test('economyTargetFps defaults to 30', () => {
  const c = new EconomyModeController()
  assert.strictEqual(c.economyTargetFps, 30)
})

test('economyTargetFps uses provided value', () => {
  const c = new EconomyModeController({ economyTargetFps: 24 })
  assert.strictEqual(c.economyTargetFps, 24)
})
