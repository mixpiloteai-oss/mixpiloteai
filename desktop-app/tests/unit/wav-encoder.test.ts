import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { encodeWav } from '../../src/renderer/src/audio/export/encoders/WavEncoder.ts'

// Minimal AudioBuffer polyfill — duck-typed for the encoder, which only uses
// numberOfChannels / length / sampleRate / getChannelData.
class FakeBuffer {
  numberOfChannels: number
  length: number
  sampleRate: number
  private data: Float32Array[]
  constructor(channels: Float32Array[], sampleRate: number) {
    this.numberOfChannels = channels.length
    this.length = channels[0]!.length
    this.sampleRate = sampleRate
    this.data = channels
  }
  getChannelData(c: number): Float32Array { return this.data[c]! }
}

function makeSine(freq: number, sr: number, secs: number, channels = 1): FakeBuffer {
  const n = Math.floor(sr * secs)
  const chs: Float32Array[] = []
  for (let c = 0; c < channels; c++) {
    const arr = new Float32Array(n)
    for (let i = 0; i < n; i++) arr[i] = Math.sin(2 * Math.PI * freq * i / sr) * 0.5
    chs.push(arr)
  }
  return new FakeBuffer(chs, sr)
}

function ascii(view: DataView, off: number, n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += String.fromCharCode(view.getUint8(off + i))
  return s
}

describe('WavEncoder / RIFF header', () => {
  it('writes RIFF + WAVE magic', () => {
    const buf = makeSine(440, 48000, 0.01, 1)
    const ab = encodeWav(buf as unknown as AudioBuffer, { bitDepth: 16, floatFormat: false })
    const view = new DataView(ab)
    assert.equal(ascii(view, 0, 4), 'RIFF')
    assert.equal(ascii(view, 8, 4), 'WAVE')
    assert.equal(ascii(view, 12, 4), 'fmt ')
  })
  it('declares format=1 (PCM) for int16', () => {
    const buf = makeSine(440, 48000, 0.01, 1)
    const ab = encodeWav(buf as unknown as AudioBuffer, { bitDepth: 16, floatFormat: false })
    const view = new DataView(ab)
    assert.equal(view.getUint16(20, true), 1) // PCM
  })
  it('declares format=3 (IEEE float) for 32-bit float', () => {
    const buf = makeSine(440, 48000, 0.01, 1)
    const ab = encodeWav(buf as unknown as AudioBuffer, { bitDepth: 32, floatFormat: true })
    const view = new DataView(ab)
    assert.equal(view.getUint16(20, true), 3) // IEEE float
  })
  it('declares the correct sample rate and channel count', () => {
    const buf = makeSine(440, 44100, 0.01, 2)
    const ab = encodeWav(buf as unknown as AudioBuffer, { bitDepth: 16, floatFormat: false })
    const view = new DataView(ab)
    assert.equal(view.getUint16(22, true), 2)     // numCh
    assert.equal(view.getUint32(24, true), 44100) // sample rate
    assert.equal(view.getUint16(34, true), 16)    // bitDepth
  })
})

describe('WavEncoder / data chunk roundtrip', () => {
  it('int16 samples roundtrip within ±2 LSB', () => {
    // Use known full-scale values that should map to exact int16 codes.
    const sr = 48000
    const samples = new Float32Array([0, 0.25, 0.5, -0.25, -0.5, 1, -1])
    const buf = new FakeBuffer([samples], sr)
    const ab = encodeWav(buf as unknown as AudioBuffer, { bitDepth: 16, floatFormat: false })
    const view = new DataView(ab)
    // data chunk is right after fmt (header is 12 + 8 + 16 = 36, then 'data' + size = 8 → start 44)
    const dataOff = 44
    for (let i = 0; i < samples.length; i++) {
      const code = view.getInt16(dataOff + i * 2, true)
      const decoded = code / 0x7fff
      assert.ok(Math.abs(decoded - samples[i]!) < 1.5 / 0x7fff,
        `sample ${i}: ${decoded} vs ${samples[i]}`)
    }
  })
  it('clips samples > 1 and < -1', () => {
    const samples = new Float32Array([2, -2])
    const buf = new FakeBuffer([samples], 48000)
    const ab = encodeWav(buf as unknown as AudioBuffer, { bitDepth: 16, floatFormat: false })
    const view = new DataView(ab)
    assert.equal(view.getInt16(44, true), 0x7fff)
    assert.equal(view.getInt16(46, true), -0x8000)
  })
  it('byte length matches header + fmt + data for stereo int16', () => {
    const sr = 48000
    const frames = 100
    const buf = new FakeBuffer([new Float32Array(frames), new Float32Array(frames)], sr)
    const ab = encodeWav(buf as unknown as AudioBuffer, { bitDepth: 16, floatFormat: false })
    // The encoder allocates 8 + (4 + 4 + 24 + 8 + dataLen) bytes = 48 + dataLen.
    // Data: 100 frames * 2 ch * 2 bytes = 400
    assert.equal(ab.byteLength, 48 + 400)
  })
  it('24-bit encoding produces 3 bytes per sample', () => {
    const sr = 48000
    const frames = 50
    const buf = new FakeBuffer([new Float32Array(frames)], sr)
    const ab = encodeWav(buf as unknown as AudioBuffer, { bitDepth: 24, floatFormat: false })
    assert.equal(ab.byteLength, 48 + frames * 3)
  })
})

describe('WavEncoder / metadata', () => {
  it('embeds a LIST/INFO chunk when title/artist are provided', () => {
    const buf = makeSine(440, 48000, 0.01, 1)
    const ab = encodeWav(buf as unknown as AudioBuffer, {
      bitDepth: 16,
      floatFormat: false,
      metadata: { title: 'Test', artist: 'Neurotek' },
    })
    // Search bytes for 'LIST'
    const u8 = new Uint8Array(ab)
    let found = false
    for (let i = 0; i < u8.length - 4; i++) {
      if (u8[i] === 0x4c && u8[i + 1] === 0x49 && u8[i + 2] === 0x53 && u8[i + 3] === 0x54) {
        found = true; break
      }
    }
    assert.ok(found, 'LIST chunk not found')
  })
})
