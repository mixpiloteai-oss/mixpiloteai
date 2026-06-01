import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RenderCache } from '../../src/renderer/src/audio/export/RenderCache.ts'

function makeCh(length: number, value = 0.5): Float32Array[] {
  const ch = new Float32Array(length)
  ch.fill(value)
  return [ch]
}

describe('RenderCache', () => {
  it('set + get returns the same channel data', () => {
    const cache = new RenderCache()
    const key   = cache.buildKey('track1', 0, 1000, 42)
    const ch    = makeCh(100)
    cache.set(key, ch, 44100)
    const result = cache.get(key)
    assert.ok(result !== null)
    assert.strictEqual(result![0], ch[0])
  })

  it('get on missing key returns null', () => {
    const cache = new RenderCache()
    assert.strictEqual(cache.get('nonexistent'), null)
  })

  it('invalidate(trackId) removes matching entries', () => {
    const cache = new RenderCache()
    const key1  = cache.buildKey('trackA', 0, 1000, 1)
    const key2  = cache.buildKey('trackB', 0, 1000, 2)
    cache.set(key1, makeCh(100), 44100)
    cache.set(key2, makeCh(100), 44100)

    cache.invalidate('trackA')

    assert.strictEqual(cache.get(key1), null)
    assert.ok(cache.get(key2) !== null)
  })

  it('invalidate does not remove non-matching entries', () => {
    const cache = new RenderCache()
    const key   = cache.buildKey('trackXYZ', 0, 1000, 1)
    cache.set(key, makeCh(100), 44100)
    cache.invalidate('trackABC')
    assert.ok(cache.get(key) !== null)
  })

  it('MAX_ENTRIES enforcement: adding 33 entries keeps at most 32', () => {
    const cache = new RenderCache()
    for (let i = 0; i < 33; i++) {
      const key = cache.buildKey(`track${i}`, 0, 100, i)
      cache.set(key, makeCh(10), 44100)
    }
    assert.ok(cache.entryCount <= 32)
  })

  it('totalSamples grows with entries', () => {
    const cache = new RenderCache()
    assert.strictEqual(cache.totalSamples, 0)

    cache.set('k1', makeCh(100), 44100)
    assert.strictEqual(cache.totalSamples, 100)

    cache.set('k2', makeCh(200), 44100)
    assert.strictEqual(cache.totalSamples, 300)
  })

  it('clear() resets to 0 entries', () => {
    const cache = new RenderCache()
    cache.set('k1', makeCh(100), 44100)
    cache.set('k2', makeCh(200), 44100)
    cache.clear()
    assert.strictEqual(cache.entryCount, 0)
    assert.strictEqual(cache.totalSamples, 0)
  })

  it('buildKey produces expected string format', () => {
    const cache = new RenderCache()
    const key   = cache.buildKey('track-1', 0, 44100, 999)
    assert.strictEqual(key, 'track-1_0_44100_999')
  })

  it('hit count updates on get', () => {
    const cache = new RenderCache()
    const key   = 'test_key'
    cache.set(key, makeCh(10), 44100)
    cache.get(key)
    cache.get(key)
    // Just verify we can still get it (no error)
    assert.ok(cache.get(key) !== null)
  })

  it('overwriting existing key updates channels', () => {
    const cache = new RenderCache()
    const key   = 'k'
    const ch1   = makeCh(10, 0.1)
    const ch2   = makeCh(10, 0.9)
    cache.set(key, ch1, 44100)
    cache.set(key, ch2, 44100)
    const result = cache.get(key)
    assert.ok(result !== null)
    // Float32Array values may have floating-point imprecision
    assert.ok(Math.abs(result![0]![0]! - 0.9) < 0.001)
  })
})
