import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeChecksum, hasChanged, checksumObject } from '../../src/renderer/src/audio/safety/ProjectChecksum.ts'

describe('ProjectChecksum', () => {
  describe('computeChecksum', () => {
    it('is deterministic — same input produces same output', () => {
      const a = computeChecksum('hello')
      const b = computeChecksum('hello')
      assert.equal(a, b)
    })

    it('produces different values for different inputs', () => {
      const a = computeChecksum('hello')
      const b = computeChecksum('world')
      assert.notEqual(a, b)
    })

    it('returns a defined number for empty string', () => {
      const result = computeChecksum('')
      assert.ok(typeof result === 'number')
      assert.ok(!Number.isNaN(result))
    })

    it('returns an unsigned 32-bit integer (>= 0)', () => {
      const result = computeChecksum('test data')
      assert.ok(result >= 0)
      assert.ok(result <= 0xffffffff)
    })
  })

  describe('hasChanged', () => {
    it('returns true when checksums differ', () => {
      assert.equal(hasChanged(1, 2), true)
    })

    it('returns false when checksums are the same', () => {
      assert.equal(hasChanged(42, 42), false)
    })
  })

  describe('checksumObject', () => {
    it('returns the same value for the same object shape', () => {
      const obj = { bpm: 120, name: 'test' }
      const a = checksumObject(obj)
      const b = checksumObject(obj)
      assert.equal(a, b)
    })

    it('returns different values for different objects', () => {
      const a = checksumObject({ bpm: 120 })
      const b = checksumObject({ bpm: 145 })
      assert.notEqual(a, b)
    })

    it('is consistent with computeChecksum(JSON.stringify(obj))', () => {
      const obj = { x: 1, y: [2, 3] }
      assert.equal(checksumObject(obj), computeChecksum(JSON.stringify(obj)))
    })
  })
})
