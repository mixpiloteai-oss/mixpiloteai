// ─── StressTest.test.ts ───────────────────────────────────────────────────────
// Stress tests with extreme inputs.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AudioEditBuffer } from '../../src/renderer/src/audio/editor/AudioEditBuffer'
import { FxChain } from '../../src/renderer/src/audio/vst/FxChain'
import { InstrumentRack } from '../../src/renderer/src/audio/vst/InstrumentRack'
import { VstMidiRouter } from '../../src/renderer/src/audio/vst/VstMidiRouter'
import { SeededRng } from '../../src/renderer/src/audio/ai/SeededRng'
import { ObjectPool } from '../../src/renderer/src/audio/perf/ObjectPool'
import { WorkflowActionQueue } from '../../src/renderer/src/audio/workflow/WorkflowActionQueue'
import { detectBpm } from '../../src/renderer/src/audio/editor/BpmDetector'
import { detectTransients } from '../../src/renderer/src/audio/editor/TransientDetector'
import { ExportQueue } from '../../src/renderer/src/audio/export/ExportQueue'
import type { RenderJob } from '../../src/renderer/src/audio/export/OfflineRenderer'

describe('StressTest', () => {
  it('AudioEditBuffer: 50 sequential inserts then flatten — no crash, correct length', () => {
    const buf = new AudioEditBuffer(1)
    const insertLen = 100

    for (let i = 0; i < 50; i++) {
      const data = new Float32Array(insertLen).fill(0.1)
      buf.insert(buf.flatten()[0] ? buf.flatten()[0]!.length : 0, [data])
    }

    const flat = buf.flatten()
    assert.equal(flat[0]!.length, 50 * insertLen,
      `Expected ${50 * insertLen} samples, got ${flat[0]!.length}`)
  })

  it('FxChain: 16 slots added, all retrieved correctly', () => {
    const chain = new FxChain('track-stress-1')

    for (let i = 0; i < 16; i++) {
      chain.addEffect(`plugin-${i}`, `Plugin ${i}`)
    }

    const slots = chain.getSlots()
    assert.equal(slots.length, 16, `Expected 16 slots, got ${slots.length}`)

    for (let i = 0; i < 16; i++) {
      assert.equal(slots[i]!.pluginId, `plugin-${i}`)
    }
  })

  it('InstrumentRack: 8 layers, getActiveLayersForNote returns correct subset', () => {
    const rack = new InstrumentRack('track-stress-2')

    // Add 8 layers with alternating note ranges
    const layerIds: string[] = []
    for (let i = 0; i < 8; i++) {
      const layer = rack.addLayer(`plugin-${i}`, `Synth ${i}`, `inst-${i}`)
      // Even layers: note range 40-80
      // Odd layers: note range 80-127
      if (i % 2 === 0) {
        rack.setLayerNoteRange(layer.layerId, 40, 80)
      } else {
        rack.setLayerNoteRange(layer.layerId, 80, 127)
      }
      layerIds.push(layer.layerId)
    }

    // Note 60 should hit even layers (40-80) = 4 layers
    const active60 = rack.getActiveLayersForNote(60, 100)
    assert.equal(active60.length, 4, `Expected 4 active layers for note 60, got ${active60.length}`)

    // Note 90 should hit odd layers (80-127) = 4 layers
    const active90 = rack.getActiveLayersForNote(90, 100)
    assert.equal(active90.length, 4, `Expected 4 active layers for note 90, got ${active90.length}`)
  })

  it('VstMidiRouter: 100 routes, routeEvent returns correct count', () => {
    const router = new VstMidiRouter()

    for (let i = 0; i < 100; i++) {
      router.addRoute({
        sourceTrackId: 'track-stress',
        targetInstanceId: `synth-${i}`,
        channelFilter: 'all',
        noteTranspose: 0,
        velocityScale: 1.0,
      })
    }

    const event = { type: 'noteOn' as const, channel: 1, note: 60, velocity: 100 }
    const results = router.routeEvent('track-stress', event)

    assert.equal(results.length, 100, `Expected 100 routed events, got ${results.length}`)
  })

  it('SeededRng: 1,000,000 values all in [0, 1)', () => {
    const rng = new SeededRng(777)
    let outOfRange = 0

    for (let i = 0; i < 1_000_000; i++) {
      const v = rng.next()
      if (v < 0 || v >= 1) outOfRange++
    }

    assert.equal(outOfRange, 0, `${outOfRange} values were out of [0, 1) range`)
  })

  it('ObjectPool: acquire 1000 objects, releaseAll — activeCount=0', () => {
    interface Obj { v: number }
    const pool = new ObjectPool<Obj>(
      () => ({ v: 0 }),
      (o) => { o.v = 0 },
      500
    )

    for (let i = 0; i < 1000; i++) {
      const obj = pool.acquire()
      obj.v = i
    }

    assert.equal(pool.activeCount, 1000, `Expected 1000 active, got ${pool.activeCount}`)
    pool.releaseAll()
    assert.equal(pool.activeCount, 0, `Expected 0 active after releaseAll, got ${pool.activeCount}`)
  })

  it('WorkflowActionQueue: adding 15 items keeps max 10', () => {
    const queue = new WorkflowActionQueue()

    for (let i = 0; i < 15; i++) {
      queue.enqueue({
        type: 'set_track_gain',
        description: `Set gain ${i}`,
        trackId: `track-${i}`,
        payload: { gainDb: i },
        previousValue: 0,
      })
    }

    const pending = queue.getPending()
    assert.ok(pending.length <= 10,
      `Expected at most 10 pending actions, got ${pending.length}`)
  })

  it('BpmDetector: synthetic click track at 120 BPM detected within ±5 BPM', () => {
    const bpm = 120
    const sr = 44100
    const numBeats = 16
    const beatSamples = Math.round(sr * 60 / bpm)
    const totalLen = beatSamples * numBeats + 1024
    const buf = new Float32Array(totalLen)

    for (let b = 0; b < numBeats; b++) {
      const pos = b * beatSamples
      const half = Math.min(64, beatSamples / 4)
      for (let i = 0; i < half; i++) {
        const v = Math.sin(i / half * Math.PI)
        if (pos + i < buf.length) buf[pos + i] += v
      }
    }

    const result = detectBpm(buf, sr)
    assert.ok(Math.abs(result.bpm - bpm) <= 5,
      `Expected BPM within ±5 of ${bpm}, got ${result.bpm}`)
  })

  it('TransientDetector: silence produces 0 transients', () => {
    const buf = new Float32Array(44100) // 1 second of silence
    const transients = detectTransients(buf, 44100)
    assert.equal(transients.length, 0, `Expected 0 transients for silence, got ${transients.length}`)
  })

  it('ExportQueue: 20 jobs added, cancelled, cleared — queue empty', () => {
    const queue = new ExportQueue()

    const dummyJob: RenderJob = {
      type: 'master',
      tracks: [],
      sampleRate: 44100,
      startSample: 0,
      endSample: 44100,
      bpm: 120,
      applyMasterChain: false,
      masterOptions: {
        sampleRate: 44100,
        enableLimiter: false,
        enableSoftClipper: false,
        limiterThresholdDb: -0.3,
        softClipThreshold: 0.95,
        enablePeakProtection: false,
      },
    }

    // Add 20 jobs
    const addedJobs = []
    for (let i = 0; i < 20; i++) {
      const j = queue.addJob(`export-${i}`, dummyJob, {
        format: 'wav',
        sampleRate: 44100,
        bitDepth: 16,
        ditherType: 'none',
        normalization: false,
        applyMasterChain: false,
        outputDirectory: '/tmp',
        fileNameTemplate: `export-${i}.wav`,
      })
      addedJobs.push(j)
    }

    // Cancel all
    for (const j of addedJobs) {
      queue.cancelJob(j.id)
    }

    // Clear completed/cancelled
    queue.clearCompleted()

    assert.equal(queue.getJobs().length, 0,
      `Expected empty queue after cancel+clear, got ${queue.getJobs().length}`)
  })
})
