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

const MAX_CACHE_ENTRIES = 128

interface CacheEntry {
  buffer:    AudioBuffer
  waveform:  WaveformData | null
  lastUsed:  number
}

export class WaveformLoader {
  private readonly engine: AudioEngine
  private _cache:   Map<string, CacheEntry>   = new Map()
  private _pending: Map<string, Promise<AudioBuffer>> = new Map()

  constructor(engine: AudioEngine) {
    this.engine = engine
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Load a URL and return the decoded AudioBuffer.
   * Concurrent calls for the same URL share one network request.
   */
  async load(url: string): Promise<AudioBuffer> {
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
      this._store(url, buffer)
      return buffer
    } finally {
      this._pending.delete(url)
    }
  }

  /**
   * Returns cached WaveformData for the given URL, computing it if needed.
   * `width` is the number of pixel columns in the render target.
   */
  async getWaveform(url: string, width: number): Promise<WaveformData> {
    const buffer = await this.load(url)
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

  // ── Internals ───────────────────────────────────────────────────────────

  private async _fetch(url: string): Promise<AudioBuffer> {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`WaveformLoader: failed to load "${url}" — HTTP ${res.status}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    return this.engine.ctx.decodeAudioData(arrayBuffer)
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
