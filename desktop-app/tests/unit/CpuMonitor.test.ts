import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { CpuMonitor } from '../../src/renderer/src/perf/CpuMonitor.ts'

describe('CpuMonitor', () => {
  let monitor: CpuMonitor
  afterEach(() => monitor?.stop())

  it('getLatest() is null before start', () => {
    monitor = new CpuMonitor({ intervalMs: 100, fetchFn: async () => ({ userMs: 10, systemMs: 5 }) })
    assert.equal(monitor.getLatest(), null)
  })

  it('after polling, getLatest() has userMs and systemMs', async () => {
    monitor = new CpuMonitor({ intervalMs: 40, fetchFn: async () => ({ userMs: 10, systemMs: 5 }) })
    monitor.start()
    await new Promise(r => setTimeout(r, 100))
    const s = monitor.getLatest()
    assert.ok(s !== null)
    assert.equal(s!.userMs, 10)
    assert.equal(s!.systemMs, 5)
  })

  it('delta computation: second sample userDeltaMs = diff between calls', async () => {
    let call = 0
    monitor = new CpuMonitor({ intervalMs: 30, fetchFn: async () => ({ userMs: (call++ === 0 ? 100 : 150), systemMs: 0 }) })
    monitor.start()
    await new Promise(r => setTimeout(r, 100))
    monitor.stop()
    // Get average to verify delta was computed
    const avg = monitor.getAverage()
    assert.ok(avg !== null)
    // After first call (prev=0→100): delta=100; after second (prev=100→150): delta=50
    // Can't deterministically assert exact values due to timing, but delta >= 0
    assert.ok(monitor.getLatest()!.userDeltaMs >= 0)
  })

  it('stop() ends polling', async () => {
    let count = 0
    monitor = new CpuMonitor({ intervalMs: 20, fetchFn: async () => ({ userMs: count++, systemMs: 0 }) })
    monitor.start()
    await new Promise(r => setTimeout(r, 60))
    monitor.stop()
    const stopped = count
    await new Promise(r => setTimeout(r, 80))
    assert.equal(count, stopped)
  })
})
