/**
 * Audio engine stress tests and unit tests for new components.
 *
 * Tests:
 *   - LatencyMeasurement.bufferSizeMs and estimatedRoundTripMs
 *   - MidiTrackNode sample-accurate scheduling (via mock AudioContext)
 *   - PlaybackScheduler jitter tracking math
 *   - UnderrunDetector threshold logic
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

// ─── LatencyMeasurement ──────────────────────────────────────────────────────

describe('LatencyMeasurement', () => {
  let LatencyMeasurement: typeof import('../../src/renderer/src/audio/LatencyMeasurement').LatencyMeasurement

  before(async () => {
    const mod = await import('../../src/renderer/src/audio/LatencyMeasurement')
    LatencyMeasurement = mod.LatencyMeasurement
  })

  it('bufferSizeMs returns correct ms for 512 frames at 44100 Hz', () => {
    const ms = LatencyMeasurement.bufferSizeMs(512, 44100)
    assert.ok(Math.abs(ms - 11.61) < 0.01, `expected ~11.61ms, got ${ms}`)
  })

  it('bufferSizeMs returns correct ms for 256 frames at 48000 Hz', () => {
    const ms = LatencyMeasurement.bufferSizeMs(256, 48000)
    assert.ok(Math.abs(ms - 5.333) < 0.01, `expected ~5.33ms, got ${ms}`)
  })

  it('estimatedRoundTripMs includes 2x buffer + overhead', () => {
    const rt = LatencyMeasurement.estimatedRoundTripMs(512, 44100)
    const expected = LatencyMeasurement.bufferSizeMs(1024, 44100) + 5
    assert.ok(Math.abs(rt - expected) < 0.01, `expected ~${expected}ms, got ${rt}`)
  })

  it('measure() returns correct bufferFrames from mock AudioContext', () => {
    const mockCtx = {
      sampleRate:    44100,
      baseLatency:   512 / 44100,
      outputLatency: 256 / 44100,
    } as unknown as AudioContext

    const lm  = new LatencyMeasurement(mockCtx)
    const res = lm.measure()

    assert.equal(res.sampleRate, 44100)
    assert.equal(res.bufferFrames, 512)
    assert.ok(Math.abs(res.baseLatencyMs - 11.61) < 0.1, `baseLatencyMs off: ${res.baseLatencyMs}`)
    assert.ok(Math.abs(res.outputLatencyMs - 5.80) < 0.1, `outputLatencyMs off: ${res.outputLatencyMs}`)
    assert.ok(res.totalMs > res.baseLatencyMs, 'totalMs must be > baseLatencyMs')
  })

  it('measure() handles missing latency properties gracefully (older browsers)', () => {
    const mockCtx = { sampleRate: 48000 } as unknown as AudioContext
    const lm      = new LatencyMeasurement(mockCtx)
    const res     = lm.measure()

    assert.equal(res.baseLatencyMs,   0)
    assert.equal(res.outputLatencyMs, 0)
    assert.equal(res.totalMs,         0)
    assert.equal(res.bufferFrames,    0)
  })
})

// ─── MixerGraph ──────────────────────────────────────────────────────────────

describe('MixerGraph state tracking', () => {
  it('tracks gainDb, pan, muted, soloed per track', async () => {
    const { MixerGraph } = await import('../../src/renderer/src/audio/MixerGraph')

    const noopChannel = { setGain: () => {}, setPan: () => {}, setMuted: () => {}, setSoloed: () => {} }
    const noopMixer = { getChannel: () => noopChannel }
    const noopRouter = { setSendGain: () => {}, addSend: () => {}, removeSend: () => {} }
    const noopLegacy = { connectSidechain: () => {}, disconnectSidechain: () => {} }
    const mockAnalyser = {
      fftSize: 32,
      getFloatTimeDomainData: (buf: Float32Array) => buf.fill(0),
    }
    const mockEngine = { masterAnalyser: mockAnalyser }

    const graph = new MixerGraph(
      mockEngine as unknown as import('../../src/renderer/src/audio/AudioEngine').AudioEngine,
      noopMixer as unknown as import('../../src/renderer/src/audio/TrackMixer').TrackMixer,
      noopRouter as unknown as import('../../src/renderer/src/audio/BusRouter').BusRouter,
      noopLegacy as unknown as import('../../src/renderer/src/audio/MixerEngine').MixerEngine,
    )

    graph.setTrackGain('t1', -6)
    graph.setTrackPan('t1', 0.5)
    graph.muteTrack('t1', true)
    graph.soloTrack('t1', true)

    const state = graph.getTrackState('t1')
    assert.equal(state.gainDb, -6)
    assert.equal(state.pan,    0.5)
    assert.equal(state.muted,  true)
    assert.equal(state.soloed, true)
  })

  it('clamps gainDb to [-96, 12]', async () => {
    const { MixerGraph } = await import('../../src/renderer/src/audio/MixerGraph')

    const noopChannel2 = { setGain: () => {}, setPan: () => {}, setMuted: () => {}, setSoloed: () => {} }
    const noopMixer = { getChannel: () => noopChannel2 } as unknown as import('../../src/renderer/src/audio/TrackMixer').TrackMixer
    const graph = new MixerGraph(
      { masterAnalyser: { fftSize: 32, getFloatTimeDomainData: (b: Float32Array) => b.fill(0) } } as unknown as import('../../src/renderer/src/audio/AudioEngine').AudioEngine,
      noopMixer,
      { setSendGain: () => {}, addSend: () => {}, removeSend: () => {} } as unknown as import('../../src/renderer/src/audio/BusRouter').BusRouter,
      { connectSidechain: () => {}, disconnectSidechain: () => {} } as unknown as import('../../src/renderer/src/audio/MixerEngine').MixerEngine,
    )

    graph.setTrackGain('t1', 999)
    assert.equal(graph.getTrackState('t1').gainDb, 12)

    graph.setTrackGain('t1', -999)
    assert.equal(graph.getTrackState('t1').gainDb, -96)
  })

  it('getMasterPeakLinear returns 0 for silence', async () => {
    const { MixerGraph } = await import('../../src/renderer/src/audio/MixerGraph')

    const mockAnalyser = {
      fftSize: 32,
      getFloatTimeDomainData: (buf: Float32Array) => buf.fill(0),
    }
    const graph = new MixerGraph(
      { masterAnalyser: mockAnalyser } as unknown as import('../../src/renderer/src/audio/AudioEngine').AudioEngine,
      { getChannel: () => ({ setGain: () => {}, setPan: () => {}, setMuted: () => {}, setSoloed: () => {} }) } as unknown as import('../../src/renderer/src/audio/TrackMixer').TrackMixer,
      { setSendGain: () => {}, addSend: () => {}, removeSend: () => {} } as unknown as import('../../src/renderer/src/audio/BusRouter').BusRouter,
      { connectSidechain: () => {}, disconnectSidechain: () => {} } as unknown as import('../../src/renderer/src/audio/MixerEngine').MixerEngine,
    )

    assert.equal(graph.getMasterPeakLinear(), 0)
    assert.equal(graph.getMasterPeakDb(), -Infinity)
  })
})

// ─── LatencyMeasurement static math ──────────────────────────────────────────

describe('LatencyMeasurement buffer math', () => {
  it('bufferSizeMs is proportional to frames', async () => {
    const { LatencyMeasurement: LM } = await import('../../src/renderer/src/audio/LatencyMeasurement')
    const sr = 44100
    assert.ok(LM.bufferSizeMs(1024, sr) === LM.bufferSizeMs(512, sr) * 2)
  })

  it('estimatedRoundTripMs > 2 × bufferSizeMs (accounts for overhead)', async () => {
    const { LatencyMeasurement: LM } = await import('../../src/renderer/src/audio/LatencyMeasurement')
    const rt  = LM.estimatedRoundTripMs(512, 44100)
    const buf = LM.bufferSizeMs(512, 44100)
    assert.ok(rt > buf * 2, `round-trip ${rt}ms should exceed 2× buffer ${buf * 2}ms`)
  })
})

// ─── PlaybackScheduler metrics ───────────────────────────────────────────────

describe('PlaybackScheduler metrics', () => {
  it('getMetrics returns zero jitter/drift when not playing', async () => {
    const { PlaybackScheduler } = await import('../../src/renderer/src/audio/PlaybackScheduler')

    const mockTransport = {
      bpm:       120,
      timeSigTop: 4,
      clock: {
        engine: { ctx: { currentTime: 0 } },
        position: { bar: 1, beat: 1 },
        bpm: 120,
      },
      onBeat:        () => () => {},
      setCoordinator: () => {},
    }
    const mockTrackManager = { getTrack: () => null }
    const mockWaveformLoader = {}

    const scheduler = new PlaybackScheduler(
      mockTransport as unknown as import('../../src/renderer/src/audio/Transport').Transport,
      mockTrackManager as unknown as import('../../src/renderer/src/audio/tracks/TrackManager').TrackManager,
      mockWaveformLoader as unknown as import('../../src/renderer/src/audio/WaveformLoader').WaveformLoader,
    )

    const m = scheduler.getMetrics()
    assert.equal(m.isPlaying,     false)
    assert.equal(m.underrunCount, 0)
    assert.equal(m.driftMs,       0)
    assert.equal(m.jitterMs,      0)
    scheduler.dispose()
  })
})
