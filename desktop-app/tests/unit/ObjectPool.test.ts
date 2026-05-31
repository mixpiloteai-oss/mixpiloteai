import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ObjectPool } from '../../src/renderer/src/audio/perf/ObjectPool.ts'

interface Obj { value: number }

function makePool(maxSize = 4) {
  return new ObjectPool<Obj>(
    () => ({ value: 0 }),
    (o) => { o.value = 0 },
    maxSize,
  )
}

test('acquire() returns an object', () => {
  const pool = makePool()
  const obj  = pool.acquire()
  assert.ok(typeof obj === 'object')
  assert.strictEqual(pool.activeCount, 1)
})

test('release() puts object back in pool', () => {
  const pool = makePool()
  const obj  = pool.acquire()
  pool.release(obj)
  assert.strictEqual(pool.activeCount, 0)
  assert.strictEqual(pool.poolSize, 1)
})

test('activeCount tracks active objects', () => {
  const pool = makePool()
  const a = pool.acquire()
  const b = pool.acquire()
  assert.strictEqual(pool.activeCount, 2)
  pool.release(a)
  assert.strictEqual(pool.activeCount, 1)
  pool.release(b)
  assert.strictEqual(pool.activeCount, 0)
})

test('pool.poolSize caps at maxSize', () => {
  const pool = makePool(2)
  const objs = [pool.acquire(), pool.acquire(), pool.acquire()]
  for (const o of objs) pool.release(o)
  assert.ok(pool.poolSize <= 2)
})

test('releaseAll() clears all active objects', () => {
  const pool = makePool()
  pool.acquire(); pool.acquire(); pool.acquire()
  assert.strictEqual(pool.activeCount, 3)
  pool.releaseAll()
  assert.strictEqual(pool.activeCount, 0)
})
