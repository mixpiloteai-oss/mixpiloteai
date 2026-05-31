export interface ClipCacheEntry {
  imageData:  ImageData
  clipId:     string
  noteCount:  number    // invalidate when note count changes
  zoomX:      number    // px per beat (rounded)
  height:     number
  width:      number
}

export class ClipRenderCache {
  private static readonly MAX_ENTRIES = 128
  private _cache: Map<string, ClipCacheEntry> = new Map()

  key(clipId: string, zoomX: number, height: number): string {
    return `${clipId}:${zoomX.toFixed(2)}:${height}`
  }

  get(k: string): ClipCacheEntry | null {
    const entry = this._cache.get(k)
    if (!entry) return null
    // LRU: re-insert to bump to newest position
    this._cache.delete(k)
    this._cache.set(k, entry)
    return entry
  }

  set(k: string, entry: ClipCacheEntry): void {
    if (this._cache.has(k)) this._cache.delete(k)
    // Evict oldest (first) entry when at capacity
    if (this._cache.size >= ClipRenderCache.MAX_ENTRIES) {
      const oldest = this._cache.keys().next().value
      if (oldest !== undefined) this._cache.delete(oldest)
    }
    this._cache.set(k, entry)
  }

  invalidate(clipId: string): void {
    for (const k of this._cache.keys()) {
      if (k.startsWith(`${clipId}:`)) this._cache.delete(k)
    }
  }

  clear(): void { this._cache.clear() }

  get size(): number { return this._cache.size }
}

export const clipRenderCache = new ClipRenderCache()
