// ─── BufferManager.test.ts ────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BufferManager } from '../../src/renderer/src/audio/recording/BufferManager.ts'

describe('BufferManager / write then read returns same data', () => {
  it('single channel, known values', () => {
    const bm = new BufferManager(100, 1)
    const data = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
    bm.write([data])
    const result = bm.read(5)
    assert.ok(result !== null)
    assert.equal(result.length, 1)
    for (let i = 0; i < data.length; i++) {
      assert.ok(
        Math.abs(result[0][i] - data[i]) < 1e-6,
        `sample[${i}]: expected ${data[i]}, got ${result[0][i]}`
      )
    }
  })
})

describe('BufferManager / multichannel', () => {
  it('write/read preserves channel independence', () => {
    const bm = new BufferManager(100, 2)
    const ch0 = new Float32Array([1, 2, 3])
    const ch1 = new Float32Array([4, 5, 6])
    bm.write([ch0, ch1])
    const result = bm.read(3)
    assert.ok(result !== null)
    assert.equal(result.length, 2)
    assert.deepEqual([...result[0]], [1, 2, 3])
    assert.deepEqual([...result[1]], [4, 5, 6])
  })
})

describe('BufferManager / getAvailable', () => {
  it('returns correct count after write', () => {
    const bm = new BufferManager(100, 1)
    assert.equal(bm.getAvailable(), 0)
    bm.write([new Float32Array(10)])
    assert.equal(bm.getAvailable(), 10)
    bm.write([new Float32Array(5)])
    assert.equal(bm.getAvailable(), 15)
  })
})

describe('BufferManager / read returns null when insufficient data', () => {
  it('null when not enough samples available', () => {
    const bm = new BufferManager(100, 1)
    bm.write([new Float32Array(5)])
    assert.equal(bm.read(10), null)
  })
})

describe('BufferManager / overrun detection', () => {
  it('write past capacity returns false + isOverrun()=true', () => {
    const bm = new BufferManager(10, 1)
    // Fill it almost full
    const ok1 = bm.write([new Float32Array(10)])
    assert.equal(ok1, true)
    // Now try to write 1 more — should overrun
    const ok2 = bm.write([new Float32Array(1)])
    assert.equal(ok2, false)
    assert.equal(bm.isOverrun(), true)
  })
})

describe('BufferManager / reset', () => {
  it('clears state: getAvailable()=0, isOverrun()=false', () => {
    const bm = new BufferManager(10, 1)
    bm.write([new Float32Array(10)])
    bm.write([new Float32Array(1)]) // trigger overrun
    assert.equal(bm.isOverrun(), true)
    bm.reset()
    assert.equal(bm.getAvailable(), 0)
    assert.equal(bm.isOverrun(), false)
  })
})

describe('BufferManager / ring buffer wrap-around', () => {
  it('write near end + read spans wrap correctly', () => {
    const capacity = 8
    const bm = new BufferManager(capacity, 1)
    // Write 6 samples, then read 6 → write pointer at 6, read pointer at 6
    const first = new Float32Array([1, 2, 3, 4, 5, 6])
    bm.write([first])
    bm.read(6)

    // Now write 6 samples that wrap around the end of the buffer (6→8→0→3)
    const wrapping = new Float32Array([10, 20, 30, 40, 50, 60])
    const ok = bm.write([wrapping])
    assert.equal(ok, true)

    const result = bm.read(6)
    assert.ok(result !== null)
    assert.deepEqual([...result[0]], [10, 20, 30, 40, 50, 60])
  })
})

describe('BufferManager / partial writes', () => {
  it('capacity=100, write 60, write 60 → second write returns false', () => {
    const bm = new BufferManager(100, 1)
    const ok1 = bm.write([new Float32Array(60)])
    assert.equal(ok1, true)
    // Only 40 free, trying to write 60 should fail
    const ok2 = bm.write([new Float32Array(60)])
    assert.equal(ok2, false)
    assert.equal(bm.isOverrun(), true)
  })
})
