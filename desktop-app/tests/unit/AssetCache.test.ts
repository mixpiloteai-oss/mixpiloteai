// ─── AssetCache.test.ts ───────────────────────────────────────────────────────
// node --experimental-strip-types --test

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LRUAssetCache } from '../../src/renderer/src/services/AssetCache.ts'

describe('LRUAssetCache — basic operations', () => {
  it('get returns null for missing key', () => {
    const cache = new LRUAssetCache<string>({})
    assert.equal(cache.get('missing'), null)
  })

  it('set then get returns value', () => {
    const cache = new LRUAssetCache<string>({})
    cache.set('k1', 'hello', 5)
    assert.equal(cache.get('k1'), 'hello')
  })

  it('has returns true after set', () => {
    const cache = new LRUAssetCache<string>({})
    cache.set('k1', 'hello', 5)
    assert.equal(cache.has('k1'), true)
    assert.equal(cache.has('k2'), false)
  })

  it('delete removes entry', () => {
    const cache = new LRUAssetCache<string>({})
    cache.set('k1', 'hello', 5)
    assert.equal(cache.delete('k1'), true)
    assert.equal(cache.has('k1'), false)
    assert.equal(cache.get('k1'), null)
  })

  it('delete returns false for missing key', () => {
    const cache = new LRUAssetCache<string>({})
    assert.equal(cache.delete('missing'), false)
  })

  it('size reflects entry count', () => {
    const cache = new LRUAssetCache<string>({})
    assert.equal(cache.size, 0)
    cache.set('k1', 'v1', 10)
    assert.equal(cache.size, 1)
    cache.set('k2', 'v2', 10)
    assert.equal(cache.size, 2)
    cache.delete('k1')
    assert.equal(cache.size, 1)
  })

  it('totalBytes sums all entry sizes', () => {
    const cache = new LRUAssetCache<string>({})
    cache.set('k1', 'v1', 100)
    cache.set('k2', 'v2', 200)
    assert.equal(cache.totalBytes, 300)
    cache.delete('k1')
    assert.equal(cache.totalBytes, 200)
  })

  it('clear empties cache', () => {
    const cache = new LRUAssetCache<string>({})
    cache.set('k1', 'v1', 10)
    cache.set('k2', 'v2', 20)
    cache.clear()
    assert.equal(cache.size, 0)
    assert.equal(cache.totalBytes, 0)
    assert.equal(cache.get('k1'), null)
  })
})

describe('LRUAssetCache — LRU eviction', () => {
  it('evicts oldest entry when maxEntries exceeded', () => {
    const cache = new LRUAssetCache<string>({ maxEntries: 2 })
    cache.set('k1', 'v1', 10)
    cache.set('k2', 'v2', 10)
    cache.set('k3', 'v3', 10) // should evict k1
    assert.equal(cache.has('k1'), false)
    assert.equal(cache.has('k2'), true)
    assert.equal(cache.has('k3'), true)
    assert.equal(cache.size, 2)
  })

  it('get moves entry to MRU position protecting from eviction', () => {
    const cache = new LRUAssetCache<string>({ maxEntries: 2 })
    cache.set('k1', 'v1', 10)
    cache.set('k2', 'v2', 10)
    // Access k1 to make it MRU
    cache.get('k1')
    // Now k2 should be LRU — adding k3 should evict k2
    cache.set('k3', 'v3', 10)
    assert.equal(cache.has('k1'), true)
    assert.equal(cache.has('k2'), false)
    assert.equal(cache.has('k3'), true)
  })

  it('evicts by byte limit', () => {
    const cache = new LRUAssetCache<string>({ maxBytes: 50 })
    cache.set('k1', 'v1', 20)
    cache.set('k2', 'v2', 20)
    // Adding k3 would put us at 60 bytes — k1 should be evicted
    cache.set('k3', 'v3', 20)
    assert.equal(cache.has('k1'), false)
    assert.ok(cache.totalBytes <= 50)
  })
})

describe('LRUAssetCache — stats', () => {
  it('stats returns correct hitRate after mix of hits and misses', () => {
    const cache = new LRUAssetCache<string>({})
    cache.set('k1', 'v1', 10)

    cache.get('k1') // hit
    cache.get('k1') // hit
    cache.get('missing') // miss
    cache.get('missing2') // miss

    const { hitRate, entries, totalBytes, maxBytes } = cache.stats()
    // 2 hits, 2 misses → hitRate = 0.5
    assert.equal(hitRate, 0.5)
    assert.equal(entries, 1)
    assert.equal(totalBytes, 10)
    assert.ok(maxBytes > 0)
  })

  it('stats returns hitRate 0 when no accesses', () => {
    const cache = new LRUAssetCache<string>({})
    assert.equal(cache.stats().hitRate, 0)
  })
})
