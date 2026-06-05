import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { encodeWav } from '../../src/renderer/src/audio/export/encoders/WavEncoder.ts'
import { validateProjectSaveData } from '../../src/renderer/src/audio/save/projectSchema.ts'
import { generateMelody } from '../../src/renderer/src/lib/musicTheory.ts'

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

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

function bench(label: string, runs: number, fn: () => void): number {
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    fn()
    times.push(performance.now() - t0)
  }
  const med = median(times)
  // eslint-disable-next-line no-console
  console.log(`[perf] ${label}: median=${med.toFixed(2)}ms over ${runs} runs (min=${Math.min(...times).toFixed(2)} max=${Math.max(...times).toFixed(2)})`)
  return med
}

describe('perf / encodeWav 5s stereo 48k', () => {
  it('median under 500 ms', () => {
    const sr = 48000
    const frames = sr * 5
    const left  = new Float32Array(frames)
    const right = new Float32Array(frames)
    for (let i = 0; i < frames; i++) {
      const s = Math.sin(2 * Math.PI * 440 * i / sr) * 0.5
      left[i]  = s
      right[i] = s
    }
    const buf = new FakeBuffer([left, right], sr)
    const med = bench('encodeWav 5s stereo 48k 16-bit', 5, () => {
      encodeWav(buf as unknown as AudioBuffer, { bitDepth: 16, floatFormat: false })
    })
    assert.ok(med < 500, `encodeWav too slow: ${med}ms`)
  })
})

describe('perf / validateProjectSaveData with 1000 notes', () => {
  it('median under 50 ms', () => {
    const notes: unknown[] = []
    for (let i = 0; i < 1000; i++) {
      notes.push({ id: 'n' + i, pitch: 60 + (i % 24), startBeat: i * 0.25, lengthBeats: 0.5, velocity: 100 })
    }
    const data = {
      version: 1,
      savedAt: Date.now(),
      appVersion: '1.0.0',
      project: { name: 'Perf' },
      mixer: { buses: [{ id: 'master' }], channels: {} },
      transport: { bpm: 120, timeSignatureTop: 4, timeSignatureBottom: 4 },
      pianoRoll: { notes },
      midi: { seqTracks: [], drumPads: [] },
    }
    const med = bench('validateProjectSaveData 1k notes', 20, () => {
      const r = validateProjectSaveData(data)
      if (!r.ok) throw new Error(r.reason)
    })
    assert.ok(med < 50, `validate too slow: ${med}ms`)
  })
})

describe('perf / generateMelody 500-note budget', () => {
  it('500 dense bars complete under 100 ms', () => {
    // 500 bars at 4/4 dense ≈ enough notes
    const med = bench('generateMelody 500 dense bars', 5, () => {
      const notes = generateMelody('C', 'major', 500, 4, 'dense', 4, 1234)
      if (notes.length < 100) throw new Error(`unexpectedly few notes: ${notes.length}`)
    })
    assert.ok(med < 100, `generateMelody too slow: ${med}ms`)
  })
})
