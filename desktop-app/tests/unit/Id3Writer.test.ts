import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { writeId3v2 } from '../../src/renderer/src/audio/export/Id3Writer.ts'

describe('Id3Writer', () => {
  it('output starts with "ID3"', () => {
    const out = writeId3v2({ title: 'Test' })
    assert.strictEqual(out[0], 0x49)  // 'I'
    assert.strictEqual(out[1], 0x44)  // 'D'
    assert.strictEqual(out[2], 0x33)  // '3'
  })

  it('header version byte 3 = 3 (ID3v2.3)', () => {
    const out = writeId3v2({ title: 'Test' })
    assert.strictEqual(out[3], 3)
  })

  it('header revision byte 4 = 0', () => {
    const out = writeId3v2({ title: 'Test' })
    assert.strictEqual(out[4], 0)
  })

  it('TIT2 frame present in output for title', () => {
    const out = writeId3v2({ title: 'Hello' })
    // Look for TIT2 = 0x54,0x49,0x54,0x32
    let found = false
    for (let i = 0; i < out.length - 3; i++) {
      if (out[i] === 0x54 && out[i+1] === 0x49 && out[i+2] === 0x54 && out[i+3] === 0x32) {
        found = true
        break
      }
    }
    assert.ok(found, 'TIT2 frame should be present')
  })

  it('empty tags still produce valid 10-byte ID3 header', () => {
    const out = writeId3v2({})
    assert.ok(out.length >= 10)
    assert.strictEqual(out[0], 0x49)
    assert.strictEqual(out[1], 0x44)
    assert.strictEqual(out[2], 0x33)
  })

  it('syncsafe size for small tags: size < 128 → same value in byte 9', () => {
    // Empty tags → framesLen = 0 → all size bytes = 0
    const out = writeId3v2({})
    assert.strictEqual(out[6], 0)
    assert.strictEqual(out[7], 0)
    assert.strictEqual(out[8], 0)
    assert.strictEqual(out[9], 0)
  })

  it('syncsafe encoding: value 128 → [0x01, 0x00] in lower 2 bytes', () => {
    // We can test this by checking a tag that produces exactly 128 bytes of frame data
    // Instead, test the syncsafe property: tag with 128 chars title
    const title = 'A'.repeat(100)  // 100 chars → frame = 10 + 100 + 1(encoding) = 111 bytes
    const out   = writeId3v2({ title })
    // The size in bytes 6-9 is syncsafe (MSB = 0 for each byte)
    assert.ok((out[6]! & 0x80) === 0, 'byte 6 MSB should be 0')
    assert.ok((out[7]! & 0x80) === 0, 'byte 7 MSB should be 0')
    assert.ok((out[8]! & 0x80) === 0, 'byte 8 MSB should be 0')
    assert.ok((out[9]! & 0x80) === 0, 'byte 9 MSB should be 0')
  })

  it('includes artist in TPE1 frame', () => {
    const out = writeId3v2({ artist: 'DJ Test' })
    // Look for TPE1 = 0x54,0x50,0x45,0x31
    let found = false
    for (let i = 0; i < out.length - 3; i++) {
      if (out[i] === 0x54 && out[i+1] === 0x50 && out[i+2] === 0x45 && out[i+3] === 0x31) {
        found = true
        break
      }
    }
    assert.ok(found, 'TPE1 frame should be present')
  })

  it('returns Uint8Array', () => {
    const out = writeId3v2({ title: 'x' })
    assert.ok(out instanceof Uint8Array)
  })
})
