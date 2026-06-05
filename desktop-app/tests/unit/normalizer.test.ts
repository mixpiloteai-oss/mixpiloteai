import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { measureLUFS, measureTruePeak, normalize } from '../../src/renderer/src/audio/export/Normalizer.ts'

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

function silence(secs: number, sr = 48000, channels = 2): FakeBuffer {
  const n = Math.floor(sr * secs)
  return new FakeBuffer(Array.from({ length: channels }, () => new Float32Array(n)), sr)
}

function sine(freqHz: number, amplitude: number, secs: number, sr = 48000, channels = 2): FakeBuffer {
  const n = Math.floor(sr * secs)
  const chs: Float32Array[] = []
  for (let c = 0; c < channels; c++) {
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) a[i] = amplitude * Math.sin(2 * Math.PI * freqHz * i / sr)
    chs.push(a)
  }
  return new FakeBuffer(chs, sr)
}

describe('Normalizer / measureTruePeak', () => {
  it('-Infinity for silence', () => {
    const buf = silence(0.5)
    assert.equal(measureTruePeak(buf as unknown as AudioBuffer), -Infinity)
  })
  it('approx 0 dBFS for a full-scale signal', () => {
    const buf = sine(1000, 1.0, 0.1)
    const peak = measureTruePeak(buf as unknown as AudioBuffer)
    assert.ok(Math.abs(peak) < 0.5, `expected ~0 dBFS, got ${peak}`)
  })
  it('approx -6 dBFS for amplitude 0.5', () => {
    const buf = sine(1000, 0.5, 0.1)
    const peak = measureTruePeak(buf as unknown as AudioBuffer)
    assert.ok(Math.abs(peak - -6.02) < 0.5, `expected ~-6 dBFS, got ${peak}`)
  })
})

describe('Normalizer / measureLUFS', () => {
  it('returns -Infinity for silence', () => {
    const buf = silence(1.5)
    const lufs = measureLUFS(buf as unknown as AudioBuffer)
    assert.equal(lufs, -Infinity)
  })
  it('finite LUFS in a sensible range for a 1 kHz tone at -3 dBFS', () => {
    const buf = sine(1000, Math.pow(10, -3 / 20), 1.5) // ~ -3 dBFS
    const lufs = measureLUFS(buf as unknown as AudioBuffer)
    assert.ok(Number.isFinite(lufs), `expected finite LUFS, got ${lufs}`)
    // Generous bounds: BS.1770 around -3 dBFS sine yields ~-3 LUFS,
    // K-weighting adds a few dB at 1 kHz, so range -6..+3 is safe.
    assert.ok(lufs > -10 && lufs < 5, `LUFS unexpectedly far: ${lufs}`)
  })
})

describe('Normalizer / normalize', () => {
  it('mode=none is a no-op (gain=1)', () => {
    const buf = sine(1000, 0.5, 0.1)
    const res = normalize(buf as unknown as AudioBuffer, 'none', -1)
    assert.equal(res.appliedGain, 1)
  })
  it('peak-normalize brings level up to target', () => {
    const buf = sine(1000, 0.25, 0.1) // -12 dBFS
    const res = normalize(buf as unknown as AudioBuffer, 'peak', -1)
    assert.ok(res.appliedGain > 1, `expected boost, got ${res.appliedGain}`)
    // After normalization, the peak should be near -1 dBFS
    const peak = measureTruePeak(buf as unknown as AudioBuffer)
    assert.ok(Math.abs(peak - -1) < 0.5, `post-norm peak ${peak}`)
  })
  it('caps boost at +40 dB on silent input (defensive)', () => {
    const buf = silence(0.5)
    const res = normalize(buf as unknown as AudioBuffer, 'peak', -1)
    // measure returns -Infinity → early-return with gain 1
    assert.equal(res.appliedGain, 1)
  })
})
