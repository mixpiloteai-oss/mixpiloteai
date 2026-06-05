// ─── AudioEditBuffer.test.ts ──────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AudioEditBuffer } from '../../src/renderer/src/audio/editor/AudioEditBuffer.ts'

function makeBuffer(ch: number, data: number[][]): Float32Array[] {
  return data.map(d => new Float32Array(d))
}

describe('AudioEditBuffer / insert', () => {
  it('inserts data at offset 0', () => {
    const buf  = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    buf.insert(0, [new Float32Array([9, 8])])
    const flat = buf.flatten()
    assert.deepEqual([...flat[0]], [9, 8, 1, 2, 3])
  })

  it('inserts at end', () => {
    const buf = new AudioEditBuffer(1, [new Float32Array([1, 2])])
    buf.insert(2, [new Float32Array([3, 4])])
    assert.deepEqual([...buf.flatten()[0]], [1, 2, 3, 4])
  })

  it('inserts in the middle', () => {
    const buf = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    buf.insert(1, [new Float32Array([9])])
    assert.deepEqual([...buf.flatten()[0]], [1, 9, 2, 3])
  })

  it('inserts silence into stereo buffer', () => {
    const buf = new AudioEditBuffer(2, [new Float32Array([1, 2]), new Float32Array([3, 4])])
    buf.insert(1, [new Float32Array([0, 0]), new Float32Array([0, 0])])
    assert.equal(buf.totalLength, 4)
  })
})

describe('AudioEditBuffer / delete', () => {
  it('deletes a range', () => {
    const buf = new AudioEditBuffer(1, [new Float32Array([1, 2, 3, 4, 5])])
    buf.delete(1, 3)
    assert.deepEqual([...buf.flatten()[0]], [1, 4, 5])
  })

  it('deletes from start', () => {
    const buf = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    buf.delete(0, 2)
    assert.deepEqual([...buf.flatten()[0]], [3])
  })

  it('deletes to end', () => {
    const buf = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    buf.delete(1, 3)
    assert.deepEqual([...buf.flatten()[0]], [1])
  })

  it('no-op when start === end', () => {
    const buf = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    buf.delete(1, 1)
    assert.equal(buf.totalLength, 3)
  })
})

describe('AudioEditBuffer / replace', () => {
  it('replaces a range with different length data', () => {
    const buf = new AudioEditBuffer(1, [new Float32Array([1, 2, 3, 4])])
    buf.replace(1, 3, [new Float32Array([9, 9, 9])])
    assert.deepEqual([...buf.flatten()[0]], [1, 9, 9, 9, 4])
  })
})

describe('AudioEditBuffer / flatten', () => {
  it('produces correct total length after multiple ops', () => {
    const buf = new AudioEditBuffer(1, [new Float32Array([1, 2, 3, 4, 5])])
    buf.delete(1, 3)
    buf.insert(0, [new Float32Array([9])])
    assert.equal(buf.flatten()[0].length, 4)
  })
})

describe('AudioEditBuffer / clone', () => {
  it('clone is a deep copy — modifying clone does not affect original', () => {
    const buf   = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    const clone = buf.clone()
    clone.delete(0, 1)
    assert.equal(buf.totalLength, 3)
    assert.equal(clone.totalLength, 2)
  })

  it('clone has same data as original', () => {
    const buf   = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    const clone = buf.clone()
    assert.deepEqual([...buf.flatten()[0]], [...clone.flatten()[0]])
  })
})

describe('AudioEditBuffer / snapshot + restore', () => {
  it('snapshot produces a copy, restore sets back', () => {
    const buf  = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    const snap = buf.snapshot()
    buf.delete(0, 3)
    buf.restoreSnapshot(snap)
    assert.deepEqual([...buf.flatten()[0]], [1, 2, 3])
  })

  it('snapshot is independent — mutating snapshot does not affect buffer', () => {
    const buf  = new AudioEditBuffer(1, [new Float32Array([1, 2, 3])])
    const snap = buf.snapshot()
    snap[0][0] = 99
    assert.equal(buf.flatten()[0][0], 1)
  })
})
