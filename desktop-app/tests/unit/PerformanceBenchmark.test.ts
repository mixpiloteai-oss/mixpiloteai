// ─── PerformanceBenchmark.test.ts ─────────────────────────────────────────────
// Performance tests with large data sets. All use real computations.
// Generous timing margins to avoid flakiness on slow CI environments.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SeededRng } from '../../src/renderer/src/audio/ai/SeededRng'
import { convertSampleRate } from '../../src/renderer/src/audio/export/SampleRateConverter'
import { computeChecksum } from '../../src/renderer/src/audio/safety/ProjectChecksum'
import { ObjectPool } from '../../src/renderer/src/audio/perf/ObjectPool'
import { ClipRenderCache } from '../../src/renderer/src/audio/perf/ClipRenderCache'
import { AudioEditBuffer } from '../../src/renderer/src/audio/editor/AudioEditBuffer'
import { WaveformCache } from '../../src/renderer/src/audio/editor/WaveformCache'
import { OfflineRenderer } from '../../src/renderer/src/audio/export/OfflineRenderer'
import type { RenderJob } from '../../src/renderer/src/audio/export/OfflineRenderer'
import { getPattern, createVariation } from '../../src/renderer/src/audio/ai/DrumPatternLibrary'
import { generateMelody } from '../../src/renderer/src/audio/ai/MelodyGenerator'
import { generateBassline } from '../../src/renderer/src/audio/ai/BasslineGenerator'
import type { MelodyOptions } from '../../src/renderer/src/audio/ai/MelodyGenerator'
import type { BasslineOptions } from '../../src/renderer/src/audio/ai/BasslineGenerator'

const DRUM_STYLES = [
  'four-on-the-floor', 'breakbeat', 'trap', 'dnb', 'reggaeton',
  'afrobeat', 'boom-bap', 'house', 'techno', 'tribe',
] as const

const VARIATION_TYPES = [
  'ghost_notes', 'syncopation', 'fill', 'half_time', 'double_time', 'swing',
] as const

describe('PerformanceBenchmark', () => {
  it('SeededRng generates 1,000,000 values in < 500ms', () => {
    const rng = new SeededRng(12345)
    const t0 = Date.now()
    for (let i = 0; i < 1_000_000; i++) {
      rng.next()
    }
    const elapsed = Date.now() - t0
    assert.ok(elapsed < 500, `Expected < 500ms, took ${elapsed}ms`)
  })

  it('SampleRateConverter 44100→48000 on 1M samples completes in < 2000ms', () => {
    const input = new Float32Array(1_000_000)
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin(i * 0.001)
    }

    const t0 = Date.now()
    const output = convertSampleRate(input, 44100, 48000)
    const elapsed = Date.now() - t0

    assert.ok(output.length > 0, 'Should produce output')
    assert.ok(elapsed < 2000, `Expected < 2000ms, took ${elapsed}ms`)
  })

  it('computeChecksum on 100KB string completes in < 50ms', () => {
    // Build 100KB string
    const base = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let str = ''
    while (str.length < 100_000) str += base
    str = str.slice(0, 100_000)

    const t0 = Date.now()
    const result = computeChecksum(str)
    const elapsed = Date.now() - t0

    assert.ok(typeof result === 'number', 'Should return a number')
    assert.ok(elapsed < 50, `Expected < 50ms, took ${elapsed}ms`)
  })

  it('ObjectPool: acquire+release 10,000 times stays below 2MB memory delta', () => {
    interface SimpleObj { value: number }
    const pool = new ObjectPool<SimpleObj>(
      () => ({ value: 0 }),
      (obj) => { obj.value = 0 },
      1000
    )

    const heapBefore = process.memoryUsage().heapUsed

    for (let i = 0; i < 10_000; i++) {
      const obj = pool.acquire()
      obj.value = i
      pool.release(obj)
    }

    const heapAfter = process.memoryUsage().heapUsed
    const deltaMb = (heapAfter - heapBefore) / (1024 * 1024)

    assert.ok(deltaMb < 2, `Expected < 2MB memory delta, got ${deltaMb.toFixed(2)}MB`)
  })

  it('ClipRenderCache: 130 entries stays at 128 (LRU eviction)', () => {
    const cache = new ClipRenderCache()

    for (let i = 0; i < 130; i++) {
      const key = cache.key(`clip-${i}`, 4.0, 64)
      const fakeImageData = { width: 100, height: 64, data: new Uint8ClampedArray(100 * 64 * 4), colorSpace: 'srgb' } as ImageData
      cache.set(key, {
        imageData: fakeImageData,
        clipId: `clip-${i}`,
        noteCount: 5,
        zoomX: 4.0,
        height: 64,
        width: 100,
      })
    }

    assert.ok(cache.size <= 128, `Expected cache size ≤ 128, got ${cache.size}`)
  })

  it('AudioEditBuffer: insert 10,000 samples, flatten gives correct length', () => {
    const buf = new AudioEditBuffer(1)
    const insertLen = 10_000

    const insertData = [new Float32Array(insertLen).fill(0.5)]

    const t0 = Date.now()
    buf.insert(0, insertData)
    const flattened = buf.flatten()
    const elapsed = Date.now() - t0

    assert.equal(flattened[0]!.length, insertLen,
      `Expected length ${insertLen}, got ${flattened[0]!.length}`)
    assert.ok(elapsed < 500, `Expected < 500ms, took ${elapsed}ms`)
  })

  it('WaveformCache: computePeaks on 88200 samples (2s at 44100Hz) completes in < 200ms', () => {
    const cache = new WaveformCache()
    const buffer = new Float32Array(88200)
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.sin(i * 0.001) * 0.5
    }

    const t0 = Date.now()
    const peaks = cache.computePeaks(buffer, 512)
    const elapsed = Date.now() - t0

    assert.ok(peaks.min.length > 0, 'Should produce peaks')
    assert.ok(elapsed < 200, `Expected < 200ms, took ${elapsed}ms`)
  })

  it('OfflineRenderer: render 10 tracks × 1000 notes in < 3000ms', async () => {
    const sampleRate = 44100
    const tracks = Array.from({ length: 10 }, (_, ti) => ({
      id: `track-${ti}`,
      name: `Track ${ti}`,
      type: 'instrument',
      notes: Array.from({ length: 1000 }, (_, ni) => ({
        pitch: 36 + (ni % 48),
        startSample: ni * 44,
        durationSamples: 100,
        velocity: 80,
      })),
      gainDb: 0,
      pan: 0,
      muted: false,
      soloed: false,
    }))

    const job: RenderJob = {
      type: 'master',
      tracks,
      sampleRate,
      startSample: 0,
      endSample: sampleRate * 2, // 2 seconds
      bpm: 120,
      applyMasterChain: false,
      masterOptions: {
        sampleRate,
        enableLimiter: false,
        enableSoftClipper: false,
        limiterThresholdDb: -0.3,
        softClipThreshold: 0.95,
        enablePeakProtection: false,
      },
    }

    const renderer = new OfflineRenderer()
    const t0 = Date.now()
    const result = await renderer.render(job)
    const elapsed = Date.now() - t0

    assert.ok(result.masterMix[0]!.length > 0, 'Should produce output')
    assert.ok(elapsed < 3000, `Expected < 3000ms, took ${elapsed}ms`)
  })

  it('DrumPatternLibrary: generate all 10 styles + 6 variations in < 100ms', () => {
    const t0 = Date.now()

    for (const style of DRUM_STYLES) {
      const base = getPattern(style, 2, 42)
      for (const variation of VARIATION_TYPES) {
        createVariation(base, variation, 99)
      }
    }

    const elapsed = Date.now() - t0
    assert.ok(elapsed < 100, `Expected < 100ms, took ${elapsed}ms`)
  })

  it('MelodyGenerator + BasslineGenerator: generate 32 bars in < 200ms', () => {
    const melodyOpts: MelodyOptions = {
      key: { root: 0, mode: 'major' },
      scale: 'major',
      style: 'techno',
      bars: 32,
      startOctave: 4,
      noteDensity: 'dense',
      contour: 'random_walk',
      seed: 42,
    }

    const bassOpts: BasslineOptions = {
      key: { root: 0, mode: 'minor' },
      style: 'techno',
      bassStyle: 'walking',
      bars: 32,
      octave: 2,
      seed: 42,
    }

    const t0 = Date.now()
    const melody = generateMelody(melodyOpts)
    const bass = generateBassline(bassOpts)
    const elapsed = Date.now() - t0

    assert.ok(melody.notes.length > 0, 'Melody should have notes')
    assert.ok(bass.notes.length > 0, 'Bass should have notes')
    assert.ok(elapsed < 200, `Expected < 200ms, took ${elapsed}ms`)
  })
})
