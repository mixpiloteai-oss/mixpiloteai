// ─── WaveformCache.test.ts ────────────────────────────────────────────────────

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { WaveformCache } from '../../src/renderer/src/audio/editor/WaveformCache.ts'

describe('WaveformCache / computePeaks', () => {
  it('returns correct min/max for known data', () => {
    const cache = new WaveformCache()
    const buf   = new Float32Array([0.1, 0.5, -0.3, -0.1, 0.2, 0.4])
    const peaks = cache.computePeaks(buf, 3)
    assert.equal(peaks.min.length, 2)
    assert.equal(peaks.max.length, 2)
    // First pixel: [0.1, 0.5, -0.3]
    assert.ok(Math.abs(peaks.min[0] - (-0.3)) < 0.001)
    assert.ok(Math.abs(peaks.max[0] - 0.5) < 0.001)
    // Second pixel: [-0.1, 0.2, 0.4]
    assert.ok(Math.abs(peaks.min[1] - (-0.1)) < 0.001)
    assert.ok(Math.abs(peaks.max[1] - 0.4) < 0.001)
  })

  it('RMS values are correct', () => {
    const cache = new WaveformCache()
    // Single value 1.0 per pixel
    const buf   = new Float32Array([1, 1, 0, 0])
    const peaks = cache.computePeaks(buf, 2)
    assert.ok(Math.abs(peaks.rms[0] - 1.0) < 0.001)
    assert.ok(Math.abs(peaks.rms[1] - 0.0) < 0.001)
  })

  it('all-zero buffer returns zero min/max/rms', () => {
    const cache = new WaveformCache()
    const buf   = new Float32Array(10)
    const peaks = cache.computePeaks(buf, 5)
    assert.ok(peaks.min.every(v => v === 0))
    assert.ok(peaks.max.every(v => v === 0))
    assert.ok(peaks.rms.every(v => v === 0))
  })
})

describe('WaveformCache / LRU', () => {
  it('cache hit returns same object (no recompute)', () => {
    const cache  = new WaveformCache()
    const buf    = new Float32Array([0.5, -0.5, 0.3, -0.3])
    const peaks1 = cache.computePeaks(buf, 2)
    cache.set('buf:2', peaks1)
    const peaks2 = cache.get('buf:2')
    assert.equal(peaks2, peaks1)
  })

  it('get promotes entry to most-recently-used', () => {
    const cache = new WaveformCache()
    // Fill 32 entries (max)
    for (let i = 0; i < 32; i++) {
      cache.set(`k${i}`, { min: new Float32Array(1), max: new Float32Array(1), rms: new Float32Array(1) })
    }
    // Access k0 to promote it
    cache.get('k0')
    // Add one more entry to trigger eviction
    cache.set('k32', { min: new Float32Array(1), max: new Float32Array(1), rms: new Float32Array(1) })
    // k1 should be evicted (was the oldest after k0 was promoted)
    assert.equal(cache.get('k1'), undefined)
    // k0 should still be there
    assert.ok(cache.get('k0') !== undefined)
  })

  it('LRU evicts oldest entry at capacity', () => {
    const cache = new WaveformCache()
    for (let i = 0; i < 33; i++) {
      cache.set(`key${i}`, { min: new Float32Array(1), max: new Float32Array(1), rms: new Float32Array(1) })
    }
    // key0 should have been evicted
    assert.equal(cache.get('key0'), undefined)
    // key32 should be present
    assert.ok(cache.get('key32') !== undefined)
  })

  it('invalidate removes all keys for a given hash prefix', () => {
    const cache = new WaveformCache()
    cache.set('buf123:512',  { min: new Float32Array(1), max: new Float32Array(1), rms: new Float32Array(1) })
    cache.set('buf123:1024', { min: new Float32Array(1), max: new Float32Array(1), rms: new Float32Array(1) })
    cache.set('buf999:512',  { min: new Float32Array(1), max: new Float32Array(1), rms: new Float32Array(1) })
    cache.invalidate('buf123')
    assert.equal(cache.get('buf123:512'),  undefined)
    assert.equal(cache.get('buf123:1024'), undefined)
    assert.ok(cache.get('buf999:512') !== undefined)
  })
})
