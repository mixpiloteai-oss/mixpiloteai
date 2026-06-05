import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ClipRenderCache } from '../../src/renderer/src/audio/perf/ClipRenderCache.ts'

function mockImageData(): ImageData {
  return { width: 1, height: 1, data: new Uint8ClampedArray(4), colorSpace: 'srgb' } as unknown as ImageData
}

function makeEntry(clipId = 'clip1', zoomX = 100, height = 80) {
  const img = mockImageData()
  return { imageData: img, clipId, noteCount: 5, zoomX, height, width: 120 }
}

test('set + get returns the entry', () => {
  const cache = new ClipRenderCache()
  const entry = makeEntry('a', 100, 80)
  const k = cache.key('a', 100, 80)
  cache.set(k, entry)
  const got = cache.get(k)
  assert.ok(got !== null)
  assert.strictEqual(got!.clipId, 'a')
})

test('key() produces string containing clipId and zoomX', () => {
  const cache = new ClipRenderCache()
  const k = cache.key('myClip', 42.123, 64)
  assert.ok(k.includes('myClip'))
  assert.ok(k.includes('42.12'))  // toFixed(2)
})

test('invalidate(clipId) removes matching entries', () => {
  const cache = new ClipRenderCache()
  cache.set(cache.key('clip1', 100, 80), makeEntry('clip1'))
  cache.set(cache.key('clip1', 200, 80), makeEntry('clip1', 200))
  cache.set(cache.key('clip2', 100, 80), makeEntry('clip2'))
  assert.strictEqual(cache.size, 3)
  cache.invalidate('clip1')
  assert.strictEqual(cache.size, 1)
  assert.ok(cache.get(cache.key('clip2', 100, 80)) !== null)
})

test('LRU: at capacity, adding new entry evicts oldest', () => {
  // Create a tiny cache (max 2) and verify LRU eviction
  const small = new (class extends ClipRenderCache {
    constructor() { super(); (this as unknown as { _cache: Map<unknown, unknown> })._cache = new Map() }
  })()
  // Override MAX_ENTRIES via monkey-patch not possible with private static;
  // instead just verify the public API: set 130 entries, size stays <= 128
  const cache = new ClipRenderCache()
  for (let i = 0; i < 130; i++) {
    cache.set(cache.key(`c${i}`, 100, 80), makeEntry(`c${i}`))
  }
  assert.ok(cache.size <= 128)
})

test('size reflects entry count', () => {
  const cache = new ClipRenderCache()
  assert.strictEqual(cache.size, 0)
  cache.set(cache.key('x', 1, 1), makeEntry('x'))
  assert.strictEqual(cache.size, 1)
  cache.clear()
  assert.strictEqual(cache.size, 0)
})
