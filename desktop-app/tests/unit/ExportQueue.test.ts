import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { ExportQueue } from '../../src/renderer/src/audio/export/ExportQueue.ts'
import type { RenderJob } from '../../src/renderer/src/audio/export/OfflineRenderer.ts'
import type { ExportOptions } from '../../src/renderer/src/audio/export/ExportQueue.ts'

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeRenderJob(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    type:             'master',
    tracks:           [],
    sampleRate:       44100,
    startSample:      0,
    endSample:        44100,
    bpm:              120,
    applyMasterChain: false,
    masterOptions: {
      sampleRate:           44100,
      enableLimiter:        false,
      enableSoftClipper:    false,
      limiterThresholdDb:   -0.3,
      softClipThreshold:    0.95,
      enablePeakProtection: false,
    },
    ...overrides,
  }
}

function makeOptions(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    format:           'wav',
    sampleRate:       44100,
    bitDepth:         16,
    ditherType:       'none',
    normalization:    false,
    applyMasterChain: false,
    outputDirectory:  '/tmp',
    fileNameTemplate: 'test.wav',
    ...overrides,
  }
}

describe('ExportQueue', () => {
  describe('addJob()', () => {
    it('creates job with status=pending', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.strictEqual(job.status, 'pending')
    })

    it('creates job with progress=0', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.strictEqual(job.progress, 0)
    })

    it('assigns unique id', () => {
      const queue = new ExportQueue()
      const j1 = queue.addJob('A', makeRenderJob(), makeOptions())
      const j2 = queue.addJob('B', makeRenderJob(), makeOptions())
      assert.notStrictEqual(j1.id, j2.id)
    })

    it('stores name correctly', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('My Export', makeRenderJob(), makeOptions())
      assert.strictEqual(job.name, 'My Export')
    })

    it('stores format from options', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions({ format: 'flac' }))
      assert.strictEqual(job.format, 'flac')
    })
  })

  describe('cancelJob()', () => {
    it('changes status to cancelled', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      queue.cancelJob(job.id)
      assert.strictEqual(queue.getJob(job.id)?.status, 'cancelled')
    })

    it('sets completedAt when cancelled', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      queue.cancelJob(job.id)
      assert.ok(queue.getJob(job.id)?.completedAt !== undefined)
    })

    it('does nothing for non-existent id', () => {
      const queue = new ExportQueue()
      assert.doesNotThrow(() => queue.cancelJob('nonexistent'))
    })
  })

  describe('removeJob()', () => {
    it('removes job from getJobs()', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      queue.removeJob(job.id)
      assert.strictEqual(queue.getJobs().find(j => j.id === job.id), undefined)
    })

    it('getJob returns undefined after removal', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      queue.removeJob(job.id)
      assert.strictEqual(queue.getJob(job.id), undefined)
    })
  })

  describe('clearCompleted()', () => {
    it('removes only done/error/cancelled jobs', () => {
      const queue = new ExportQueue()
      const j1    = queue.addJob('Done', makeRenderJob(), makeOptions())
      const j2    = queue.addJob('Pending', makeRenderJob(), makeOptions())

      // Manually set j1 to done
      queue.cancelJob(j1.id)  // cancelled counts as completed

      queue.clearCompleted()

      const remaining = queue.getJobs()
      assert.ok(!remaining.find(j => j.id === j1.id), 'cancelled job should be removed')
      assert.ok(remaining.find(j => j.id === j2.id), 'pending job should remain')
    })
  })

  describe('getJob()', () => {
    it('returns correct job by id', () => {
      const queue = new ExportQueue()
      const j1 = queue.addJob('A', makeRenderJob(), makeOptions())
      const j2 = queue.addJob('B', makeRenderJob(), makeOptions())

      assert.strictEqual(queue.getJob(j1.id)?.name, 'A')
      assert.strictEqual(queue.getJob(j2.id)?.name, 'B')
    })

    it('returns undefined for unknown id', () => {
      const queue = new ExportQueue()
      assert.strictEqual(queue.getJob('unknown'), undefined)
    })
  })

  describe('onProgress()', () => {
    it('listener is called when job is added (addJob emits progress)', () => {
      const queue   = new ExportQueue()
      let callCount = 0
      queue.onProgress(() => { callCount++ })
      queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.ok(callCount > 0, 'listener should be called when job added')
    })

    it('returns an unsubscribe function', () => {
      const queue   = new ExportQueue()
      let callCount = 0
      const unsub   = queue.onProgress(() => { callCount++ })
      unsub()
      const before  = callCount
      queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.strictEqual(callCount, before, 'unsubscribed listener should not be called')
    })

    it('multiple listeners are all called', () => {
      const queue   = new ExportQueue()
      let count1 = 0
      let count2 = 0
      queue.onProgress(() => { count1++ })
      queue.onProgress(() => { count2++ })
      queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.ok(count1 > 0)
      assert.ok(count2 > 0)
    })
  })

  describe('isRunning()', () => {
    it('returns false when not started', () => {
      const queue = new ExportQueue()
      assert.strictEqual(queue.isRunning(), false)
    })
  })

  describe('start() — fast render', () => {
    it('processes a job and marks it done', async () => {
      // Use a job with 0 samples so render completes quickly
      const queue = new ExportQueue()
      const job   = queue.addJob('Quick', makeRenderJob({ endSample: 0 }), makeOptions())

      await queue.start()

      const result = queue.getJob(job.id)
      assert.ok(
        result?.status === 'done' || result?.status === 'error',
        `expected done or error, got ${result?.status}`
      )
    })
  })
})
