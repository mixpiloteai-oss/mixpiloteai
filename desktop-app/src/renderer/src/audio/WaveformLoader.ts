/**
 * WaveformLoader
 *
 * Loads audio files into AudioBuffers and computes waveform visualisation
 * data for the arrangement view clip blocks.
 *
 * Features:
 *   - In-memory LRU cache (max 128 buffers, evicts least-recently-used)
 *   - Deduplicates concurrent requests for the same URL
 *   - Supports file:// paths (local samples) and http(s):// URLs
 *   - Returns WaveformData (RMS + peak per pixel column) for rendering
 */

import type { WaveformData } from './types'
import { AudioEngine } from './AudioEngine'
import { logger } from '../lib/logger'

const MAX_CACHE_ENTRIES = 128
const MAX_AUDIO_BYTES   = 200 * 1024 * 1024 // 200 MB hard cap — prevents OOM on huge files

interface CacheEntry {
  buffer:    AudioBuffer
  waveform:  WaveformData | null
  lastUsed:  number
}

export class WaveformLoader {
  private readonly engine: AudioEngine
  private _cache:   Map<string, CacheEntry>   = new Map()
  private _pending: Map<string, Promise<AudioBuffer | null>> = new Map()

  // Worker-based decoding
  private _decodeWorker: Worker | null = null
  private _decodeCallbacks = new Map<string, { resolve: (buf: AudioBuffer) => void; reject: (e: Error) => void }>()
  private _decodeIdCounter = 0

  constructor(engine: AudioEngine) {
    this.engine = engine
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Load a URL and return the decoded AudioBuffer.
   * Concurrent calls for the same URL share one network request.
   *
   * Returns `null` on any failure (oversized payload, network error, decode
   * failure) so a corrupt file can never crash the renderer.
   */
  async load(url: string): Promise<AudioBuffer | null> {
    const cached = this._cache.get(url)
    if (cached) {
      cached.lastUsed = Date.now()
      return cached.buffer
    }

    // Deduplicate in-flight requests
    const inflight = this._pending.get(url)
    if (inflight) return inflight

    const promise = this._fetch(url)
    this._pending.set(url, promise)

    try {
      const buffer = await promise
      if (!buffer) return null
      this._store(url, buffer)
      return buffer
    } finally {
      this._pending.delete(url)
    }
  }

  /**
   * Returns cached WaveformData for the given URL, computing it if needed.
   * `width` is the number of pixel columns in the render target.
   *
   * Throws if the buffer could not be loaded — callers (e.g. useWaveform)
   * already handle this and surface the error to the UI.
   */
  async getWaveform(url: string, width: number): Promise<WaveformData> {
    const buffer = await this.load(url)
    if (!buffer) throw new Error(`WaveformLoader: failed to load "${url}"`)
    const entry  = this._cache.get(url)!

    if (entry.waveform && entry.waveform.rms.length === width) {
      return entry.waveform
    }

    const waveform      = computeWaveform(buffer, width)
    entry.waveform      = waveform
    return waveform
  }

  evict(url: string): void {
    this._cache.delete(url)
  }

  clearCache(): void {
    this._cache.clear()
  }

  get cacheSize(): number { return this._cache.size }

  isCached(url: string): boolean {
    return this._cache.has(url)
  }

  // ── Worker decode ────────────────────────────────────────────────────────

  private _getDecodeWorker(): Worker {
    if (!this._decodeWorker) {
      this._decodeWorker = new Worker(
        new URL('./workers/AudioDecodeWorker.ts', import.meta.url),
        { type: 'module' },
      )
      this._decodeWorker.onmessage = (e) => {
        const { id, ok, channels, sampleRate, length, numberOfChannels, error } = e.data as {
          id: string; ok: boolean; channels: Float32Array<ArrayBuffer>[]; sampleRate: number
          length: number; numberOfChannels: number; error?: string
        }
        const cb = this._decodeCallbacks.get(id)
        if (!cb) return
        this._decodeCallbacks.delete(id)
        if (!ok) { cb.reject(new Error(error ?? 'decode failed')); return }
        const buf = this.engine.ctx.createBuffer(numberOfChannels, length, sampleRate)
        for (let c = 0; c < numberOfChannels; c++) buf.copyToChannel(channels[c], c)
        cb.resolve(buf)
      }
      this._decodeWorker.onerror = () => {
        for (const cb of this._decodeCallbacks.values()) cb.reject(new Error('Worker error'))
        this._decodeCallbacks.clear()
        this._decodeWorker = null
      }
    }
    return this._decodeWorker
  }

  private _decodeWithWorker(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      const id = String(++this._decodeIdCounter)
      this._decodeCallbacks.set(id, { resolve, reject })
      try {
        this._getDecodeWorker().postMessage(
          { id, buffer: arrayBuffer, sampleRate: this.engine.ctx.sampleRate },
          [arrayBuffer],
        )
      } catch (err) {
        this._decodeCallbacks.delete(id)
        reject(err)
      }
    })
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async _fetch(url: string): Promise<AudioBuffer | null> {
    let res: Response
    try {
      res = await fetch(url)
    } catch (err) {
      logger.warn('WaveformLoader: fetch failed', url, err)
      return null
    }
    if (!res.ok) {
      logger.warn('WaveformLoader: HTTP', res.status, 'for', url)
      return null
    }

    // Reject huge files BEFORE downloading when Content-Length is advertised
    const advertised = Number(res.headers.get('content-length') ?? 0)
    if (advertised > MAX_AUDIO_BYTES) {
      logger.warn('WaveformLoader: refused — advertised size', advertised, 'exceeds cap for', url)
      return null
    }

    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await res.arrayBuffer()
    } catch (err) {
      logger.warn('WaveformLoader: arrayBuffer read failed for', url, err)
      return null
    }

    if (arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
      logger.warn('WaveformLoader: refused — size', arrayBuffer.byteLength, 'exceeds 200MB cap for', url)
      return null
    }

    // Try worker-based decode first (unblocks main thread), fall back to main thread
    try {
      return await this._decodeWithWorker(arrayBuffer)
    } catch {
      // Worker unavailable or failed — fall back to main-thread decode
      try {
        return await this.engine.ctx.decodeAudioData(arrayBuffer)
      } catch (err) {
        logger.warn('WaveformLoader: decodeAudioData failed for', url, err)
        return null
      }
    }
  }

  private _store(url: string, buffer: AudioBuffer): void {
    // LRU eviction: remove oldest entry when at capacity
    if (this._cache.size >= MAX_CACHE_ENTRIES) {
      let oldestKey  = ''
      let oldestTime = Infinity
      for (const [k, v] of this._cache) {
        if (v.lastUsed < oldestTime) { oldestTime = v.lastUsed; oldestKey = k }
      }
      if (oldestKey) this._cache.delete(oldestKey)
    }

    this._cache.set(url, { buffer, waveform: null, lastUsed: Date.now() })
  }
}

// ── Pure computation ────────────────────────────────────────────────────────

/**
 * Computes per-column RMS and peak for `width` pixel columns.
 * Uses channel 0 only (left / mono).
 */
function computeWaveform(buffer: AudioBuffer, width: number): WaveformData {
  const channel   = buffer.getChannelData(0)
  const blockSize = Math.floor(channel.length / width)

  const rms   = new Float32Array(width)
  const peaks = new Float32Array(width)

  for (let col = 0; col < width; col++) {
    const start = col * blockSize
    const end   = Math.min(start + blockSize, channel.length)
    let sumSq   = 0
    let peak    = 0

    for (let i = start; i < end; i++) {
      const v = Math.abs(channel[i])
      sumSq  += v * v
      if (v > peak) peak = v
    }

    rms[col]   = Math.sqrt(sumSq / (end - start))
    peaks[col] = peak
  }

  // Normalise to 0..1 based on the loudest column
  const maxPeak = peaks.reduce((m, v) => Math.max(m, v), 0)
  if (maxPeak > 0) {
    for (let i = 0; i < width; i++) {
      rms[i]   /= maxPeak
      peaks[i] /= maxPeak
    }
  }

  return {
    rms,
    peaks,
    duration:   buffer.duration,
    sampleRate: buffer.sampleRate,
  }
}
