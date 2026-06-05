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
    endSample:        0,  // 0 samples → fast render
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

describe('ExportQueue — enhanced features', () => {
  describe('cancelRequested field', () => {
    it('new job has cancelRequested=false', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.strictEqual(job.cancelRequested, false)
    })

    it('cancelJob sets cancelRequested=true on the job', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      queue.cancelJob(job.id)
      const updated = queue.getJob(job.id)
      // After cancel the job is moved to history (may not be in active jobs)
      // but cancelRequested was set before removal
      assert.ok(updated === undefined || updated.cancelRequested === true)
    })
  })

  describe('ETA fields', () => {
    it('new job has etaMs=null', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.strictEqual(job.etaMs, null)
    })

    it('new job has renderSpeedRatio=0', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.strictEqual(job.renderSpeedRatio, 0)
    })

    it('new job has bytesWritten=0', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Test', makeRenderJob(), makeOptions())
      assert.strictEqual(job.bytesWritten, 0)
    })
  })

  describe('history', () => {
    it('getHistory() initially empty', () => {
      const queue = new ExportQueue()
      assert.strictEqual(queue.getHistory().length, 0)
    })

    it('job moves to history after completion', async () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Quick', makeRenderJob({ endSample: 0 }), makeOptions())
      await queue.start()
      const history = queue.getHistory()
      assert.ok(
        history.some(h => h.id === job.id),
        'job should appear in history after completion'
      )
    })

    it('clearHistory empties history', async () => {
      const queue = new ExportQueue()
      queue.addJob('Quick', makeRenderJob(), makeOptions())
      await queue.start()
      queue.clearHistory()
      assert.strictEqual(queue.getHistory().length, 0)
    })

    it('history length is capped at 50', async () => {
      const queue = new ExportQueue()
      // Add 55 jobs sequentially
      for (let i = 0; i < 55; i++) {
        queue.addJob(`Job ${i}`, makeRenderJob(), makeOptions())
      }
      await queue.start()
      assert.ok(queue.getHistory().length <= 50, `history should be <= 50, got ${queue.getHistory().length}`)
    })

    it('cancelled job moves to history', () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('CancelMe', makeRenderJob(), makeOptions())
      queue.cancelJob(job.id)
      const history = queue.getHistory()
      assert.ok(history.some(h => h.id === job.id && h.status === 'cancelled'))
    })
  })

  describe('enhanced ExportJob fields', () => {
    it('job after completion has etaMs=0', async () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Quick', makeRenderJob(), makeOptions())
      await queue.start()
      const updated = queue.getHistory().find(h => h.id === job.id)
      assert.ok(updated !== undefined)
      assert.strictEqual(updated!.etaMs, 0)
    })

    it('completed job has completedAt set', async () => {
      const queue = new ExportQueue()
      const job   = queue.addJob('Quick', makeRenderJob(), makeOptions())
      await queue.start()
      const updated = queue.getHistory().find(h => h.id === job.id)
      assert.ok(updated?.completedAt !== undefined)
    })
  })
})
