// ─── AssetCache ───────────────────────────────────────────────────────────────
// Pure-TS LRU cache for remote audio assets. No IDB — fully testable in Node.

export interface CacheEntry<T> {
  key: string
  value: T
  size: number
  cachedAt: number
  hits: number
}

export class LRUAssetCache<T> {
  private _maxEntries: number
  private _maxBytes: number
  private _map = new Map<string, CacheEntry<T>>()
  /** LRU order: index 0 = least recently used, last = most recently used */
  private _order: string[] = []
  private _bytesUsed = 0
  private _totalHits = 0
  private _totalMisses = 0

  constructor(opts: { maxEntries?: number; maxBytes?: number } = {}) {
    this._maxEntries = opts.maxEntries ?? 128
    this._maxBytes = opts.maxBytes ?? 50 * 1024 * 1024 // 50 MB
  }

  get(key: string): T | null {
    const entry = this._map.get(key)
    if (!entry) {
      this._totalMisses++
      return null
    }
    this._totalHits++
    entry.hits++
    // Move to MRU position
    this._order = this._order.filter((k) => k !== key)
    this._order.push(key)
    return entry.value
  }

  set(key: string, value: T, size: number): void {
    // If key already exists, remove it first
    if (this._map.has(key)) {
      this.delete(key)
    }
    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      cachedAt: Date.now(),
      hits: 0,
    }
    this._map.set(key, entry)
    this._order.push(key)
    this._bytesUsed += size
    this._evict()
  }

  has(key: string): boolean {
    return this._map.has(key)
  }

  delete(key: string): boolean {
    const entry = this._map.get(key)
    if (!entry) return false
    this._map.delete(key)
    this._order = this._order.filter((k) => k !== key)
    this._bytesUsed -= entry.size
    return true
  }

  clear(): void {
    this._map.clear()
    this._order = []
    this._bytesUsed = 0
  }

  get size(): number {
    return this._map.size
  }

  get totalBytes(): number {
    return this._bytesUsed
  }

  stats(): {
    entries: number
    totalBytes: number
    maxBytes: number
    hitRate: number
  } {
    const total = this._totalHits + this._totalMisses
    const hitRate = total === 0 ? 0 : this._totalHits / total
    return {
      entries: this._map.size,
      totalBytes: this._bytesUsed,
      maxBytes: this._maxBytes,
      hitRate,
    }
  }

  private _evict(): void {
    while (
      (this._map.size > this._maxEntries || this._bytesUsed > this._maxBytes) &&
      this._order.length > 0
    ) {
      const lruKey = this._order[0]!
      this._order.shift()
      const entry = this._map.get(lruKey)
      if (entry) {
        this._map.delete(lruKey)
        this._bytesUsed -= entry.size
      }
    }
  }
}

// ── Audio asset singleton ─────────────────────────────────────────────────────
let _audioAssetCache: LRUAssetCache<ArrayBuffer> | null = null

export function getAudioAssetCache(): LRUAssetCache<ArrayBuffer> {
  if (!_audioAssetCache) {
    _audioAssetCache = new LRUAssetCache<ArrayBuffer>({
      maxEntries: 64,
      maxBytes: 100 * 1024 * 1024, // 100 MB
    })
  }
  return _audioAssetCache
}

export const AudioAssetCache = getAudioAssetCache()
