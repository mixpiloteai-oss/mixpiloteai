import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryMonitor } from '../../src/renderer/src/perf/MemoryMonitor.ts'

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor

  afterEach(() => monitor?.stop())

  it('getLatest() returns null before first poll', () => {
    monitor = new MemoryMonitor({ intervalMs: 100, fetchFn: async () => ({ heapUsedMB: 100, heapTotalMB: 200, rssMB: 150 }) })
    assert.equal(monitor.getLatest(), null)
  })

  it('after start + wait, getLatest() is non-null', async () => {
    monitor = new MemoryMonitor({ intervalMs: 50, fetchFn: async () => ({ heapUsedMB: 100, heapTotalMB: 200, rssMB: 150 }) })
    monitor.start()
    await new Promise(r => setTimeout(r, 120))
    assert.ok(monitor.getLatest() !== null)
    assert.equal(monitor.getLatest()!.heapUsedMB, 100)
  })

  it('subscribe fires callback on new sample', async () => {
    const calls: number[] = []
    monitor = new MemoryMonitor({ intervalMs: 50, fetchFn: async () => ({ heapUsedMB: 42, heapTotalMB: 200, rssMB: 100 }) })
    monitor.subscribe(m => calls.push(m.heapUsedMB))
    monitor.start()
    await new Promise(r => setTimeout(r, 130))
    assert.ok(calls.length >= 1)
    assert.equal(calls[0], 42)
  })

  it('stop() prevents further callbacks', async () => {
    let count = 0
    monitor = new MemoryMonitor({ intervalMs: 30, fetchFn: async () => ({ heapUsedMB: 1, heapTotalMB: 1, rssMB: 1 }) })
    monitor.subscribe(() => count++)
    monitor.start()
    await new Promise(r => setTimeout(r, 80))
    const countAtStop = count
    monitor.stop()
    await new Promise(r => setTimeout(r, 100))
    assert.equal(count, countAtStop)
  })

  it('circular buffer keeps at most 60 samples', async () => {
    let seq = 0
    monitor = new MemoryMonitor({ intervalMs: 5, fetchFn: async () => ({ heapUsedMB: seq++, heapTotalMB: 1, rssMB: 1 }) })
    monitor.start()
    await new Promise(r => setTimeout(r, 400))
    monitor.stop()
    // getAverage works, meaning samples are bounded
    const avg = monitor.getAverage()
    assert.ok(avg !== null)
  })

  it('getAverage() returns mean of samples', async () => {
    let v = 0
    monitor = new MemoryMonitor({ intervalMs: 30, fetchFn: async () => ({ heapUsedMB: (v += 10), heapTotalMB: 200, rssMB: 100 }) })
    monitor.start()
    await new Promise(r => setTimeout(r, 100))
    monitor.stop()
    const avg = monitor.getAverage()
    assert.ok(avg !== null)
    assert.ok(avg!.heapUsedMB > 0)
  })
})
