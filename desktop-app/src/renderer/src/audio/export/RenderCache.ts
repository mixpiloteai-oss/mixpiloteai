// ─── RenderCache ───────────────────────────────────────────────────────────────
// Caches rendered Float32Array[] buffers to avoid re-rendering unchanged tracks.

export interface RenderCacheEntry {
  key:         string
  channels:    Float32Array[]
  sampleRate:  number
  renderedAt:  number
  hitCount:    number
}

export class RenderCache {
  private _cache = new Map<string, RenderCacheEntry>()
  private readonly MAX_ENTRIES     = 32
  private readonly MAX_TOTAL_SAMPLES = 50_000_000  // ~1100MB at float32 stereo

  /**
   * Build a cache key from track parameters.
   */
  buildKey(
    trackId:     string,
    startSample: number,
    endSample:   number,
    trackHash:   number,
  ): string {
    return `${trackId}_${startSample}_${endSample}_${trackHash}`
  }

  /**
   * Get cached channels for a key. Returns null if not found.
   * Updates hitCount on hit.
   */
  get(key: string): Float32Array[] | null {
    const entry = this._cache.get(key)
    if (!entry) return null
    entry.hitCount++
    return entry.channels
  }

  /**
   * Cache rendered channels. Evicts old entries if limits are exceeded.
   */
  set(key: string, channels: Float32Array[], sampleRate: number): void {
    // Replace existing entry if present
    if (this._cache.has(key)) {
      const existing = this._cache.get(key)!
      existing.channels   = channels
      existing.sampleRate = sampleRate
      existing.renderedAt = Date.now()
      return
    }

    // Evict if over total sample limit
    if (this.totalSamples + this._countSamples(channels) > this.MAX_TOTAL_SAMPLES) {
      this._evictOne()
    }

    // Evict if over entry count limit
    if (this._cache.size >= this.MAX_ENTRIES) {
      this._evictOne()
    }

    this._cache.set(key, {
      key,
      channels,
      sampleRate,
      renderedAt: Date.now(),
      hitCount:   0,
    })
  }

  /**
   * Remove all cache entries whose key starts with the given trackId prefix.
   */
  invalidate(trackId: string): void {
    for (const key of this._cache.keys()) {
      if (key.startsWith(trackId)) {
        this._cache.delete(key)
      }
    }
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this._cache.clear()
  }

  /**
   * Total number of samples across all cached entries.
   */
  get totalSamples(): number {
    let total = 0
    for (const entry of this._cache.values()) {
      total += this._countSamples(entry.channels)
    }
    return total
  }

  /**
   * Number of cached entries.
   */
  get entryCount(): number {
    return this._cache.size
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _countSamples(channels: Float32Array[]): number {
    return channels.reduce((acc, ch) => acc + ch.length, 0)
  }

  private _evictOne(): void {
    // Remove entry with lowest hitCount (LRU-like)
    let lowestKey: string | null   = null
    let lowestHit: number          = Infinity

    for (const [key, entry] of this._cache.entries()) {
      if (entry.hitCount < lowestHit) {
        lowestHit = entry.hitCount
        lowestKey = key
      }
    }

    if (lowestKey !== null) {
      this._cache.delete(lowestKey)
    }
  }
}

/** Singleton render cache. */
export const renderCache = new RenderCache()
