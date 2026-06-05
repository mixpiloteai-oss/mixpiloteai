// ─── WaveformCache ────────────────────────────────────────────────────────────
// LRU cache (max 32) for waveform peak data keyed by bufferId + samplesPerPixel.

export interface WaveformPeaks {
  min: Float32Array
  max: Float32Array
  rms: Float32Array
}

const MAX_ENTRIES = 32

export class WaveformCache {
  private cache = new Map<string, WaveformPeaks>()

  computePeaks(buffer: Float32Array, samplesPerPixel: number): WaveformPeaks {
    const pixels = Math.max(1, Math.ceil(buffer.length / samplesPerPixel))
    const min    = new Float32Array(pixels)
    const max    = new Float32Array(pixels)
    const rms    = new Float32Array(pixels)

    for (let px = 0; px < pixels; px++) {
      const s  = px * samplesPerPixel
      const e  = Math.min(s + samplesPerPixel, buffer.length)
      let mn   = Infinity, mx = -Infinity, sum2 = 0
      for (let i = s; i < e; i++) {
        const v = buffer[i]
        if (v < mn) mn = v
        if (v > mx) mx = v
        sum2 += v * v
      }
      const n    = e - s
      min[px]    = mn === Infinity  ? 0 : mn
      max[px]    = mx === -Infinity ? 0 : mx
      rms[px]    = n > 0 ? Math.sqrt(sum2 / n) : 0
    }

    return { min, max, rms }
  }

  get(key: string): WaveformPeaks | undefined {
    const entry = this.cache.get(key)
    if (entry === undefined) return undefined
    // Promote to most-recently-used
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry
  }

  set(key: string, peaks: WaveformPeaks): void {
    if (this.cache.has(key)) this.cache.delete(key)
    this.cache.set(key, peaks)
    if (this.cache.size > MAX_ENTRIES) {
      // Evict oldest (first inserted)
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
  }

  invalidate(hash: string): void {
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(hash)) this.cache.delete(key)
    }
  }

  cacheKey(bufferId: string, samplesPerPixel: number): string {
    return `${bufferId}:${samplesPerPixel}`
  }

  get size(): number { return this.cache.size }
}
