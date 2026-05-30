// ─── Server-side TTL cache ────────────────────────────────────────────────────
// LRU-style in-memory cache with per-entry TTL and max-size eviction.
// Single-process only — for multi-instance scale, swap backing store to Redis.

interface CacheEntry<T> {
  value:     T
  expiresAt: number
  hitCount:  number
}

interface CacheStats {
  size:      number
  hits:      number
  misses:    number
  evictions: number
}

export class ServerCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>()
  private stats: CacheStats = { size: 0, hits: 0, misses: 0, evictions: 0 }
  private pruneTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly maxSize        = 1000,
    private readonly defaultTtlMs   = 5 * 60_000,
    private readonly pruneInterval  = 60_000,
  ) {
    this.pruneTimer = setInterval(() => this.prune(), this.pruneInterval)
    if (this.pruneTimer.unref) this.pruneTimer.unref()
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) { this.stats.misses++; return undefined }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.stats.evictions++; this.stats.misses++
      return undefined
    }
    entry.hitCount++; this.stats.hits++
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) { this.store.delete(oldest); this.stats.evictions++ }
    }
    this.store.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs), hitCount: 0 })
    this.stats.size = this.store.size
  }

  delete(key: string): void { this.store.delete(key); this.stats.size = this.store.size }

  invalidatePrefix(prefix: string): number {
    let n = 0
    for (const k of this.store.keys()) { if (k.startsWith(prefix)) { this.store.delete(k); n++ } }
    this.stats.size = this.store.size
    return n
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses
    return { ...this.stats, size: this.store.size, hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : 'N/A' }
  }

  private prune(): void {
    const now = Date.now()
    for (const [k, e] of this.store) { if (now > e.expiresAt) { this.store.delete(k); this.stats.evictions++ } }
    this.stats.size = this.store.size
  }

  destroy(): void {
    if (this.pruneTimer) { clearInterval(this.pruneTimer); this.pruneTimer = null }
    this.store.clear()
  }
}

// Pre-built singletons

/** 30s TTL — trending scores, live stats */
export const shortCache   = new ServerCache<unknown>(500,   30_000,  30_000)
/** 5min TTL — marketplace listings, search results */
export const mediumCache  = new ServerCache<unknown>(1000,  5 * 60_000, 60_000)
/** 1hr TTL — packs, templates, plan definitions */
export const longCache    = new ServerCache<unknown>(500,  60 * 60_000, 5 * 60_000)
/** 60s TTL — AI prompt deduplication */
export const aiDedupCache = new ServerCache<string>(200,  60_000, 30_000)
/** 5min TTL — user profile lookups */
export const userCache    = new ServerCache<unknown>(2000, 5 * 60_000, 60_000)
