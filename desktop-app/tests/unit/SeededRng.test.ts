// ─── SeededRng.test.ts ────────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SeededRng } from '../../src/renderer/src/audio/ai/SeededRng.ts'

describe('SeededRng', () => {
  it('same seed produces same first value', () => {
    const a = new SeededRng(42).next()
    const b = new SeededRng(42).next()
    assert.equal(a, b, 'Same seed should give same output')
  })

  it('next() returns value in [0, 1)', () => {
    const rng = new SeededRng(12345)
    for (let i = 0; i < 100; i++) {
      const v = rng.next()
      assert.ok(v >= 0 && v < 1, `Expected [0,1), got ${v}`)
    }
  })

  it('nextInt(1, 6) returns integer in [1, 6]', () => {
    const rng = new SeededRng(99)
    for (let i = 0; i < 200; i++) {
      const v = rng.nextInt(1, 6)
      assert.ok(Number.isInteger(v), `Expected integer, got ${v}`)
      assert.ok(v >= 1 && v <= 6, `Expected [1,6], got ${v}`)
    }
  })

  it('pick returns element from array', () => {
    const rng = new SeededRng(7)
    const arr = ['a', 'b', 'c'] as const
    for (let i = 0; i < 50; i++) {
      const v = rng.pick(arr)
      assert.ok(arr.includes(v), `Expected element from array, got ${v}`)
    }
  })

  it('different seeds produce different first values', () => {
    const a = new SeededRng(1).next()
    const b = new SeededRng(2).next()
    assert.notEqual(a, b, 'Different seeds should produce different values')
  })
})
