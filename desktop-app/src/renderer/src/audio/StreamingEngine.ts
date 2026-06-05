// ─── Streaming Engine ─────────────────────────────────────────────────────────
// Loads large audio files in chunks so the UI stays responsive.
// Prefetches the next chunk while the current one plays.
// Integrates with SmartCache for L1/L2 buffer reuse.

import { getCachedBuffer, cacheAudioBuffer } from './SmartCache'
import { AudioEngine } from './AudioEngine'

export interface StreamChunk {
  index:    number
  startSec: number
  endSec:   number
  buffer:   AudioBuffer
}

export type ChunkReadyCallback = (chunk: StreamChunk) => void
export type StreamProgressCallback = (loaded: number, total: number) => void

const DEFAULT_CHUNK_SEC = 15

export class StreamingEngine {
  private chunkSec: number
  private inflight: Map<string, Promise<StreamChunk>> = new Map()

  constructor(chunkSec = DEFAULT_CHUNK_SEC) {
    this.chunkSec = chunkSec
  }

  setChunkSec(sec: number): void { this.chunkSec = sec }

  /**
   * Streams a full audio file in chunks, calling onChunk for each decoded chunk.
   * Caches each chunk in SmartCache. Skips chunks already cached.
   */
  async stream(
    url:         string,
    onChunk:     ChunkReadyCallback,
    onProgress?: StreamProgressCallback,
  ): Promise<void> {
    const ctx = AudioEngine.getInstance().ctx

    // Fetch raw bytes
    const res = await fetch(url)
    if (!res.ok) throw new Error(`StreamingEngine: fetch failed ${res.status}`)
    const arrayBuf = await res.arrayBuffer()
    onProgress?.(arrayBuf.byteLength, arrayBuf.byteLength)

    // Decode full buffer first (Web Audio has no partial decode API)
    const fullBuffer = await ctx.decodeAudioData(arrayBuf.slice(0))
    const totalSec   = fullBuffer.duration
    const chunkCount = Math.ceil(totalSec / this.chunkSec)
    const sr         = fullBuffer.sampleRate
    const ch         = fullBuffer.numberOfChannels

    for (let i = 0; i < chunkCount; i++) {
      const cacheKey  = `${url}#chunk${i}`
      const startSamp = Math.floor(i * this.chunkSec * sr)
      const endSamp   = Math.min(startSamp + Math.floor(this.chunkSec * sr), fullBuffer.length)
      const chunkLen  = endSamp - startSamp

      // L1/L2 cache hit
      let chunkBuf = await getCachedBuffer(cacheKey, ctx)
      if (!chunkBuf) {
        chunkBuf = ctx.createBuffer(ch, chunkLen, sr)
        for (let c = 0; c < ch; c++) {
          const src  = fullBuffer.getChannelData(c).subarray(startSamp, endSamp)
          chunkBuf.copyToChannel(src, c)
        }
        cacheAudioBuffer(cacheKey, chunkBuf)
      }

      onChunk({ index: i, startSec: i * this.chunkSec, endSec: Math.min((i + 1) * this.chunkSec, totalSec), buffer: chunkBuf })
    }
  }

  /**
   * Prefetch a specific chunk from a file URL.
   * Useful for look-ahead loading: call with the next chunk index while playing.
   */
  async prefetch(url: string, chunkIndex: number): Promise<void> {
    const key = `${url}#chunk${chunkIndex}`
    if (this.inflight.has(key)) return   // already in flight

    const ctx = AudioEngine.getInstance().ctx
    const existing = await getCachedBuffer(key, ctx)
    if (existing) return   // already cached

    const promise = fetch(url)
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(fullBuf => {
        const sr  = fullBuf.sampleRate
        const ch  = fullBuf.numberOfChannels
        const start = Math.floor(chunkIndex * this.chunkSec * sr)
        const end   = Math.min(start + Math.floor(this.chunkSec * sr), fullBuf.length)
        const slice = ctx.createBuffer(ch, end - start, sr)
        for (let c = 0; c < ch; c++) {
          slice.copyToChannel(fullBuf.getChannelData(c).subarray(start, end), c)
        }
        cacheAudioBuffer(key, slice)
        this.inflight.delete(key)
        return { index: chunkIndex, startSec: chunkIndex * this.chunkSec, endSec: (chunkIndex + 1) * this.chunkSec, buffer: slice }
      })
      .catch(err => { this.inflight.delete(key); throw err })

    this.inflight.set(key, promise)
  }
}

export const streamingEngine = new StreamingEngine()
