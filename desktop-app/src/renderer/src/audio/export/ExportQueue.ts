// ─── ExportQueue ──────────────────────────────────────────────────────────────
// Manages a sequential queue of audio export jobs.
// Each job goes through: rendering → encoding → writing → done.

import { offlineRenderer, type RenderJob } from './OfflineRenderer'
import { type MasterChainOptions } from './MasterChain'
import { applyDither, type DitherType } from './DitherEngine'
import { convertBuffer } from './SampleRateConverter'
import { encodeWav } from './WavEncoderPcm'
import { encodeFlac, type ExportFormat } from './FlacEncoderPcm'
import { encodeMp3 } from './Mp3EncoderPcm'
import type { ExportMetadata } from './ExportMetadata'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportJobStatus = 'pending' | 'rendering' | 'encoding' | 'writing' | 'done' | 'error' | 'cancelled'

export interface ExportOptions {
  format:             ExportFormat
  sampleRate:         44100 | 48000 | 88200 | 96000
  bitDepth:           16 | 24 | 32
  bitrate?:           64 | 96 | 128 | 192 | 256 | 320
  ditherType:         DitherType
  normalization:      boolean
  targetLufs?:        number
  applyMasterChain:   boolean
  masterOptions?:     Partial<MasterChainOptions>
  outputDirectory:    string
  fileNameTemplate:   string
  metadata?:          ExportMetadata
  oggQuality?:        number   // 0.0-1.0 (Vorbis quality scale)
  useFfmpeg?:         boolean  // prefer ffmpeg over pure-TS encoder
}

export interface ExportJob {
  id:               string
  name:             string
  status:           ExportJobStatus
  format:           ExportFormat
  outputPath:       string
  job:              RenderJob
  options:          ExportOptions
  createdAt:        number
  startedAt?:       number
  completedAt?:     number
  error?:           string
  progress:         number  // 0-100
  etaMs:            number | null
  renderSpeedRatio: number
  bytesWritten:     number
  cancelRequested:  boolean
}

// ─── ExportQueue ──────────────────────────────────────────────────────────────

type ProgressCallback = (job: ExportJob) => void

const MAX_HISTORY = 50

export class ExportQueue {
  private jobs:      Map<string, ExportJob> = new Map()
  private order:     string[]               = []
  private _history:  ExportJob[]            = []
  private running:   boolean                = false
  private listeners: ProgressCallback[]     = []
  private idSeq      = 0

  /**
   * Add a new export job to the queue (status = 'pending').
   */
  addJob(name: string, job: RenderJob, options: ExportOptions): ExportJob {
    const id         = `eq-${Date.now()}-${++this.idSeq}`
    const outputPath = `${options.outputDirectory}/${options.fileNameTemplate}`
    const exportJob: ExportJob = {
      id, name, status: 'pending', format: options.format,
      outputPath, job, options, createdAt: Date.now(), progress: 0,
      etaMs: null, renderSpeedRatio: 0, bytesWritten: 0, cancelRequested: false,
    }
    this.jobs.set(id, exportJob)
    this.order.push(id)
    this.emit(exportJob)
    return exportJob
  }

  cancelJob(id: string): void {
    const job = this.jobs.get(id)
    if (job) {
      job.cancelRequested = true
      if (job.status === 'pending' || job.status === 'rendering' ||
          job.status === 'encoding' || job.status === 'writing') {
        job.status      = 'cancelled'
        job.completedAt = Date.now()
        this.emit(job)
        this._moveToHistory(job)
      }
    }
  }

  /**
   * Get completed/failed/cancelled export history (last 50).
   */
  getHistory(): ExportJob[] {
    return [...this._history]
  }

  /**
   * Clear export history.
   */
  clearHistory(): void {
    this._history = []
  }

  removeJob(id: string): void {
    this.jobs.delete(id)
    this.order = this.order.filter(oid => oid !== id)
  }

  clearCompleted(): void {
    const toRemove = this.order.filter(id => {
      const s = this.jobs.get(id)?.status
      return s === 'done' || s === 'error' || s === 'cancelled'
    })
    for (const id of toRemove) this.removeJob(id)
  }

  getJobs(): ExportJob[] {
    return this.order.map(id => this.jobs.get(id)).filter((j): j is ExportJob => j !== undefined)
  }

  getJob(id: string): ExportJob | undefined {
    return this.jobs.get(id)
  }

  /**
   * Subscribe to progress events. Returns an unsubscribe function.
   */
  onProgress(cb: ProgressCallback): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb)
    }
  }

  isRunning(): boolean {
    return this.running
  }

  /**
   * Process the queue sequentially. Safe to call multiple times.
   */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    try {
      let next: ExportJob | undefined
      while ((next = this.nextPending()) !== undefined) {
        await this.processJob(next)
      }
    } finally {
      this.running = false
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private nextPending(): ExportJob | undefined {
    return this.order
      .map(id => this.jobs.get(id))
      .find((j): j is ExportJob => j !== undefined && j.status === 'pending')
  }

  private emit(job: ExportJob): void {
    for (const cb of this.listeners) {
      try { cb(job) } catch { /* listener errors must not break the queue */ }
    }
  }

  private setProgress(job: ExportJob, progress: number, status?: ExportJobStatus): void {
    job.progress = progress
    if (status) job.status = status
    // Update ETA based on elapsed time and progress
    if (job.startedAt !== undefined && progress > 0 && progress < 100) {
      const elapsed = Date.now() - job.startedAt
      job.etaMs     = Math.round((elapsed / progress) * (100 - progress))
    }
    this.emit(job)
  }

  private _moveToHistory(job: ExportJob): void {
    // Avoid duplicate entries
    if (this._history.some(h => h.id === job.id)) return
    this._history.unshift({ ...job })
    if (this._history.length > MAX_HISTORY) {
      this._history = this._history.slice(0, MAX_HISTORY)
    }
  }

  private async processJob(job: ExportJob): Promise<void> {
    if (job.status === 'cancelled' || job.cancelRequested) return

    try {
      // Step 1: Render
      job.status    = 'rendering'
      job.startedAt = Date.now()
      job.etaMs     = null
      this.setProgress(job, 0, 'rendering')

      const renderResult = await offlineRenderer.render(job.job)

      // Calculate render speed ratio
      if (job.startedAt !== undefined) {
        const elapsedMs        = Date.now() - job.startedAt
        const audioSamples     = renderResult.totalSamples
        if (elapsedMs > 0 && audioSamples > 0) {
          job.renderSpeedRatio = audioSamples / (elapsedMs / 1000 * job.options.sampleRate)
        }
      }

      if (job.cancelRequested) {
        job.status      = 'cancelled'
        job.completedAt = Date.now()
        this.emit(job)
        this._moveToHistory(job)
        return
      }

      this.setProgress(job, 40)

      // Step 2: Encode
      this.setProgress(job, 40, 'encoding')

      const { options }  = job
      let channels       = renderResult.masterMix

      // Sample rate conversion if needed
      if (renderResult.sampleRate !== options.sampleRate) {
        channels = convertBuffer(channels, renderResult.sampleRate, options.sampleRate)
      }

      // Apply dither before bit reduction
      if (options.bitDepth < 32 && options.ditherType !== 'none') {
        channels = channels.map(ch => applyDither(ch, options.bitDepth, options.ditherType))
      }

      // Encode to bytes
      let encoded: Uint8Array
      if (options.format === 'flac') {
        encoded = encodeFlac({
          channels,
          sampleRate:       options.sampleRate,
          bitDepth:         options.bitDepth === 32 ? 24 : options.bitDepth as 16 | 24,
          compressionLevel: 5,
        })
      } else if (options.format === 'mp3') {
        encoded = encodeMp3({
          channels,
          sampleRate: options.sampleRate,
          bitrate:    (options.bitrate ?? 320) as 128 | 192 | 256 | 320,
          quality:    2,
        })
      } else {
        encoded = encodeWav(channels, options.sampleRate, options.bitDepth)
      }

      job.bytesWritten = encoded.length
      this.setProgress(job, 80)

      if (job.cancelRequested) {
        job.status      = 'cancelled'
        job.completedAt = Date.now()
        this.emit(job)
        this._moveToHistory(job)
        return
      }

      // Step 3: Write file
      this.setProgress(job, 80, 'writing')
      const api = (globalThis as Record<string, unknown>)['electronAPI'] as
        | { exportWriteFile?: (path: string, data: Uint8Array) => Promise<void> }
        | undefined
      if (api?.exportWriteFile) {
        await api.exportWriteFile(job.outputPath, encoded)
      }
      // If no electronAPI available (tests / browser), skip writing silently

      job.status      = 'done'
      job.completedAt = Date.now()
      job.etaMs       = 0
      this.setProgress(job, 100, 'done')
      this._moveToHistory(job)

    } catch (err) {
      job.status      = 'error'
      job.completedAt = Date.now()
      job.error       = err instanceof Error ? err.message : String(err)
      this.setProgress(job, job.progress, 'error')
      this._moveToHistory(job)
    }
  }
}

/** Singleton export queue. */
export const exportQueue = new ExportQueue()
