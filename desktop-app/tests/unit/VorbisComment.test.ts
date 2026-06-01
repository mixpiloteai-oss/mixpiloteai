import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildVorbisCommentBlock, insertVorbisComment } from '../../src/renderer/src/audio/export/VorbisComment.ts'
import { encodeFlacReal } from '../../src/renderer/src/audio/export/FlacEncoderReal.ts'

function encodeUtf8Str(str: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
  }
  return new Uint8Array(bytes)
}

function containsUtf8String(haystack: Uint8Array, needle: string): boolean {
  const needleBytes = encodeUtf8Str(needle)
  outer: for (let i = 0; i <= haystack.length - needleBytes.length; i++) {
    for (let j = 0; j < needleBytes.length; j++) {
      if (haystack[i + j] !== needleBytes[j]) continue outer
    }
    return true
  }
  return false
}

function makeFlac(samples = 256): Uint8Array {
  const ch = new Float32Array(samples)
  for (let i = 0; i < samples; i++) ch[i] = 0.1 * Math.sin(i * 0.1)
  return encodeFlacReal({ channels: [ch], sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
}

describe('VorbisComment', () => {
  describe('buildVorbisCommentBlock()', () => {
    it('contains TITLE=Test as UTF-8 when title is set', () => {
      const block = buildVorbisCommentBlock({ title: 'Test' })
      assert.ok(containsUtf8String(block, 'TITLE=Test'), 'Should contain TITLE=Test')
    })

    it('contains ARTIST when artist is set', () => {
      const block = buildVorbisCommentBlock({ artist: 'Neurotek' })
      assert.ok(containsUtf8String(block, 'ARTIST=Neurotek'))
    })

    it('contains ALBUM when album is set', () => {
      const block = buildVorbisCommentBlock({ album: 'My Album' })
      assert.ok(containsUtf8String(block, 'ALBUM=My Album'))
    })

    it('empty tags produces a minimal block (just vendor string + 0 comments)', () => {
      const block = buildVorbisCommentBlock({})
      // vendor_length(4) + vendor_string + count(4) = at least 8 bytes
      assert.ok(block.length >= 8)
    })

    it('returns Uint8Array', () => {
      const block = buildVorbisCommentBlock({ title: 'x' })
      assert.ok(block instanceof Uint8Array)
    })
  })

  describe('insertVorbisComment()', () => {
    it('output starts with fLaC marker', () => {
      const flac = makeFlac()
      const out  = insertVorbisComment(flac, { title: 'Test' })
      assert.strictEqual(out[0], 0x66)  // 'f'
      assert.strictEqual(out[1], 0x4c)  // 'L'
      assert.strictEqual(out[2], 0x61)  // 'a'
      assert.strictEqual(out[3], 0x43)  // 'C'
    })

    it('output length > input length (metadata was added)', () => {
      const flac = makeFlac()
      const out  = insertVorbisComment(flac, { title: 'Test Title', artist: 'Test Artist' })
      assert.ok(out.length > flac.length, `out.length(${out.length}) should be > flac.length(${flac.length})`)
    })

    it('output contains TITLE=Test in UTF-8', () => {
      const flac = makeFlac()
      const out  = insertVorbisComment(flac, { title: 'Test' })
      assert.ok(containsUtf8String(out, 'TITLE=Test'), 'Should contain TITLE=Test')
    })

    it('throws for non-FLAC input', () => {
      const notFlac = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05])
      assert.throws(() => {
        insertVorbisComment(notFlac, { title: 'x' })
      })
    })

    it('empty tags still increases file size (adds empty Vorbis Comment block)', () => {
      const flac = makeFlac()
      const out  = insertVorbisComment(flac, {})
      assert.ok(out.length > flac.length)
    })
  })
})
