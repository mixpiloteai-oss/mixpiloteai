import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OfflineRenderer, offlineRenderer } from '../../src/renderer/src/audio/export/OfflineRenderer.ts'
import type { RenderJob, RenderTrack } from '../../src/renderer/src/audio/export/OfflineRenderer.ts'
import type { MasterChainOptions } from '../../src/renderer/src/audio/export/MasterChain.ts'

// ── Fixtures ────────────────────────────────────────────────────────────────

const MASTER_OPTIONS: MasterChainOptions = {
  sampleRate:           44100,
  enableLimiter:        false,
  enableSoftClipper:    false,
  limiterThresholdDb:   -0.3,
  softClipThreshold:    0.95,
  enablePeakProtection: false,
}

function makeJob(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    type:             'master',
    tracks:           [],
    sampleRate:       44100,
    startSample:      0,
    endSample:        4410,   // 0.1 second
    bpm:              120,
    applyMasterChain: false,
    masterOptions:    MASTER_OPTIONS,
    ...overrides,
  }
}

function makeTrack(overrides: Partial<RenderTrack> = {}): RenderTrack {
  return {
    id:     'track-1',
    name:   'Synth',
    type:   'midi',
    notes:  [],
    gainDb: 0,
    pan:    0,
    muted:  false,
    soloed: false,
    ...overrides,
  }
}

describe('OfflineRenderer', () => {
  describe('render() — 0 tracks', () => {
    it('masterMix has correct totalSamples length (endSample - startSample)', async () => {
      const renderer = new OfflineRenderer()
      const result   = await renderer.render(makeJob())
      assert.strictEqual(result.totalSamples, 4410)
      assert.strictEqual(result.masterMix[0]?.length, 4410)
      assert.strictEqual(result.masterMix[1]?.length, 4410)
    })

    it('masterMix is stereo (2 channels)', async () => {
      const renderer = new OfflineRenderer()
      const result   = await renderer.render(makeJob())
      assert.strictEqual(result.masterMix.length, 2)
    })

    it('silent output for 0 tracks', async () => {
      const renderer = new OfflineRenderer()
      const result   = await renderer.render(makeJob())
      const left = result.masterMix[0]!
      let sum = 0
      for (let i = 0; i < left.length; i++) sum += Math.abs(left[i]!)
      assert.strictEqual(sum, 0, 'no tracks should produce silence')
    })

    it('sampleRate matches job', async () => {
      const renderer = new OfflineRenderer()
      const result   = await renderer.render(makeJob({ sampleRate: 48000, endSample: 4800 }))
      assert.strictEqual(result.sampleRate, 48000)
    })

    it('duration = totalSamples / sampleRate', async () => {
      const renderer = new OfflineRenderer()
      const result   = await renderer.render(makeJob({ endSample: 44100 }))
      assert.ok(Math.abs(result.duration - 1.0) < 0.001)
    })
  })

  describe('render() — with notes', () => {
    it('masterMix has non-zero content with 1 note', async () => {
      const renderer = new OfflineRenderer()
      const track    = makeTrack({
        notes: [{
          pitch:           69,  // A4 = 440 Hz
          startSample:     0,
          durationSamples: 4410,
          velocity:        100,
        }],
      })
      const result = await renderer.render(makeJob({ tracks: [track] }))

      const left = result.masterMix[0]!
      let maxAbs = 0
      for (let i = 0; i < left.length; i++) maxAbs = Math.max(maxAbs, Math.abs(left[i]!))
      assert.ok(maxAbs > 0, 'should have non-zero content with a note')
    })

    it('muted tracks produce no output', async () => {
      const renderer = new OfflineRenderer()
      const track    = makeTrack({
        muted: true,
        notes: [{ pitch: 60, startSample: 0, durationSamples: 4410, velocity: 127 }],
      })
      const result = await renderer.render(makeJob({ tracks: [track] }))

      const left = result.masterMix[0]!
      let sum = 0
      for (let i = 0; i < left.length; i++) sum += Math.abs(left[i]!)
      assert.strictEqual(sum, 0, 'muted track should not appear in output')
    })
  })

  describe('stems mode', () => {
    it('channels map has entry per non-muted track', async () => {
      const renderer = new OfflineRenderer()
      const t1 = makeTrack({ id: 't1', name: 'Track 1' })
      const t2 = makeTrack({ id: 't2', name: 'Track 2' })
      const result = await renderer.render(makeJob({ type: 'stems', tracks: [t1, t2] }))

      assert.ok(result.channels.has('t1'), 'should have stem for t1')
      assert.ok(result.channels.has('t2'), 'should have stem for t2')
    })

    it('muted track is excluded from stems', async () => {
      const renderer = new OfflineRenderer()
      const t1 = makeTrack({ id: 't1', muted: true })
      const t2 = makeTrack({ id: 't2' })
      const result = await renderer.render(makeJob({ type: 'stems', tracks: [t1, t2] }))

      assert.ok(!result.channels.has('t1'), 'muted track should not appear in stems')
      assert.ok(result.channels.has('t2'), 'unmuted track should appear in stems')
    })
  })

  describe('applyMasterChain', () => {
    it('applyMasterChain=false: loudness is still measured (we always measure)', async () => {
      const renderer = new OfflineRenderer()
      const result   = await renderer.render(makeJob({ applyMasterChain: false }))
      // loudness is always measured
      assert.ok(result.loudness !== undefined)
    })

    it('applyMasterChain=true: loudness is measured', async () => {
      const renderer = new OfflineRenderer()
      const opts     = { ...MASTER_OPTIONS, enableLimiter: false, enableSoftClipper: false }
      const result   = await renderer.render(makeJob({ applyMasterChain: true, masterOptions: opts }))
      assert.ok(result.loudness !== undefined)
    })
  })

  describe('renderTimeMs', () => {
    it('renderTimeMs >= 0 after render', async () => {
      const renderer = new OfflineRenderer()
      const result   = await renderer.render(makeJob())
      assert.ok(result.renderTimeMs >= 0, `renderTimeMs should be >= 0, got ${result.renderTimeMs}`)
    })
  })

  describe('singleton', () => {
    it('offlineRenderer is an OfflineRenderer instance', () => {
      assert.ok(offlineRenderer instanceof OfflineRenderer)
    })
  })

  describe('solo logic', () => {
    it('non-soloed track is excluded when another track is soloed', async () => {
      const renderer = new OfflineRenderer()
      const t1 = makeTrack({
        id: 't1', soloed: true,
        notes: [{ pitch: 69, startSample: 0, durationSamples: 4410, velocity: 127 }],
      })
      const t2 = makeTrack({
        id: 't2', soloed: false,
        notes: [{ pitch: 60, startSample: 0, durationSamples: 4410, velocity: 127 }],
      })
      const result = await renderer.render(makeJob({ tracks: [t1, t2] }))

      // Stems map should have t1 but not t2
      assert.ok(result.channels.has('t1'), 'soloed t1 should be rendered')
      assert.ok(!result.channels.has('t2'), 'non-soloed t2 should be excluded')
    })
  })
})
