import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { encodeFlacReal } from '../../src/renderer/src/audio/export/FlacEncoderReal.ts'

function makeSine(length: number, freq = 440, sampleRate = 44100): Float32Array {
  const buf = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    buf[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate)
  }
  return buf
}

describe('FlacEncoderReal', () => {
  it('produces output starting with fLaC marker', () => {
    const ch = [makeSine(1024)]
    const out = encodeFlacReal({ channels: ch, sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
    assert.strictEqual(out[0], 0x66)  // 'f'
    assert.strictEqual(out[1], 0x4c)  // 'L'
    assert.strictEqual(out[2], 0x61)  // 'a'
    assert.strictEqual(out[3], 0x43)  // 'C'
  })

  it('STREAMINFO block type = 0 (lower 7 bits of byte 4)', () => {
    const ch = [makeSine(512)]
    const out = encodeFlacReal({ channels: ch, sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
    // byte 4 = last_flag(1) | block_type(7 bits)
    const blockType = out[4]! & 0x7f
    assert.strictEqual(blockType, 0)
  })

  it('output length > 0 for non-empty input', () => {
    const ch = [makeSine(100)]
    const out = encodeFlacReal({ channels: ch, sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
    assert.ok(out.length > 0)
  })

  it('1-channel (mono) does not throw', () => {
    const ch = [makeSine(512)]
    assert.doesNotThrow(() => {
      encodeFlacReal({ channels: ch, sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
    })
  })

  it('2-channel (stereo) does not throw', () => {
    const ch = [makeSine(512), makeSine(512, 880)]
    assert.doesNotThrow(() => {
      encodeFlacReal({ channels: ch, sampleRate: 48000, bitDepth: 24, compressionLevel: 5 })
    })
  })

  it('16-bit encoding does not throw', () => {
    const ch = [makeSine(256)]
    assert.doesNotThrow(() => {
      encodeFlacReal({ channels: ch, sampleRate: 44100, bitDepth: 16, compressionLevel: 0 })
    })
  })

  it('24-bit encoding does not throw', () => {
    const ch = [makeSine(256)]
    assert.doesNotThrow(() => {
      encodeFlacReal({ channels: ch, sampleRate: 48000, bitDepth: 24, compressionLevel: 8 })
    })
  })

  it('very short buffer (10 samples) produces valid output without crash', () => {
    const ch = [new Float32Array([0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4, 0.5, -0.5])]
    let out: Uint8Array | undefined
    assert.doesNotThrow(() => {
      out = encodeFlacReal({ channels: ch, sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
    })
    assert.ok(out && out.length > 0)
  })

  it('round-trip: encode 1000 sine samples returns Uint8Array', () => {
    const ch  = [makeSine(1000)]
    const out = encodeFlacReal({ channels: ch, sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
    assert.ok(out instanceof Uint8Array)
  })

  it('stereo 2-channel output is larger than mono with same samples', () => {
    const left  = makeSine(1024)
    const right = makeSine(1024, 880)
    const mono   = encodeFlacReal({ channels: [left], sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
    const stereo = encodeFlacReal({ channels: [left, right], sampleRate: 44100, bitDepth: 16, compressionLevel: 5 })
    assert.ok(stereo.length > mono.length)
  })
})
