// ─── DropoutGuard.test.ts ─────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DropoutGuard } from '../../src/renderer/src/audio/recording/DropoutGuard.ts'
import { BufferManager } from '../../src/renderer/src/audio/recording/BufferManager.ts'

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('DropoutGuard / initial status', () => {
  it('getStatus initial: fillRatio=0, dropoutCount=0, lastDropout=null', () => {
    const bm = new BufferManager(1000, 1)
    const guard = new DropoutGuard(bm)
    const status = guard.getStatus()
    assert.equal(status.fillRatio, 0)
    assert.equal(status.dropoutCount, 0)
    assert.equal(status.lastDropout, null)
  })
})

describe('DropoutGuard / critical warning when fillRatio < 0.10', () => {
  it('fires critical when buffer is empty (fillRatio=0)', async () => {
    const bm = new BufferManager(1000, 1)
    // Write 0 samples → fillRatio = 0 (critical)
    const guard = new DropoutGuard(bm)
    const events: string[] = []
    guard.start((level) => events.push(level))
    await wait(200)
    guard.stop()
    assert.ok(events.length > 0, 'expected at least one warning event')
    assert.ok(events.every(e => e === 'critical'), `expected only critical, got: ${events}`)
  })
})

describe('DropoutGuard / warning when 0.10 ≤ fillRatio < 0.25', () => {
  it('fires warning when buffer is partially filled in the warning zone', async () => {
    const bm = new BufferManager(1000, 1)
    // Write 150 samples → fillRatio = 0.15 (warning zone: >=0.10 and <0.25)
    bm.write([new Float32Array(150)])
    const guard = new DropoutGuard(bm)
    const events: string[] = []
    guard.start((level) => events.push(level))
    await wait(200)
    guard.stop()
    assert.ok(events.length > 0, 'expected at least one warning event')
    assert.ok(events.every(e => e === 'warning'), `expected only warning, got: ${events}`)
  })
})

describe('DropoutGuard / no callback when fillRatio >= 0.25', () => {
  it('no warning when buffer has 300/1000 samples (fillRatio=0.30)', async () => {
    const bm = new BufferManager(1000, 1)
    // Write 300 samples → fillRatio = 0.30 (above highWaterMark)
    bm.write([new Float32Array(300)])
    const guard = new DropoutGuard(bm)
    const events: string[] = []
    guard.start((level) => events.push(level))
    await wait(200)
    guard.stop()
    assert.equal(events.length, 0, `expected no warnings, got: ${events}`)
  })
})

describe('DropoutGuard / dropoutCount increments on critical event', () => {
  it('dropoutCount increases after critical events', async () => {
    const bm = new BufferManager(1000, 1)
    // 0 samples → critical
    const guard = new DropoutGuard(bm)
    guard.start(() => {})
    await wait(250) // wait for ~2 intervals
    guard.stop()
    const status = guard.getStatus()
    assert.ok(status.dropoutCount >= 1, `expected dropoutCount >= 1, got ${status.dropoutCount}`)
    assert.ok(status.lastDropout !== null, 'expected lastDropout to be set')
  })
})

describe('DropoutGuard / stop() prevents further callbacks', () => {
  it('no callbacks fired after stop()', async () => {
    const bm = new BufferManager(1000, 1)
    // critical condition
    const guard = new DropoutGuard(bm)
    let callCount = 0
    guard.start(() => { callCount++ })
    // Stop immediately
    guard.stop()
    const countAtStop = callCount
    // Wait to confirm no more callbacks fire
    await wait(200)
    assert.equal(callCount, countAtStop, `expected callCount to stay at ${countAtStop} after stop, got ${callCount}`)
  })
})
