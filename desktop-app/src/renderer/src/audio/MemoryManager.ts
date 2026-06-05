// ─── Memory Manager ───────────────────────────────────────────────────────────
// LRU buffer pool for AudioBuffers. Enforces per-mode RAM budgets and evicts
// least-recently-used buffers when the limit is approached.

export interface BufferEntry {
  key:         string
  buffer:      AudioBuffer
  sizeBytes:   number
  lastAccess:  number
  pinned:      boolean   // frozen/bounced tracks: never evict
}

export type MemoryPressure = 'ok' | 'warning' | 'critical'

const BYTES_PER_SAMPLE = 4  // Float32

function bufferBytes(b: AudioBuffer): number {
  return b.length * b.numberOfChannels * BYTES_PER_SAMPLE
}

export class MemoryManager {
  private entries: Map<string, BufferEntry> = new Map()
  private _budgetBytes = 512 * 1024 * 1024   // 512 MB default
  private _usedBytes   = 0

  get budgetBytes():  number          { return this._budgetBytes }
  get usedBytes():    number          { return this._usedBytes }
  get pressure():     MemoryPressure  {
    const ratio = this._usedBytes / this._budgetBytes
    if (ratio > 0.90) return 'critical'
    if (ratio > 0.75) return 'warning'
    return 'ok'
  }

  setBudgetMB(mb: number): void {
    this._budgetBytes = mb * 1024 * 1024
    this.evictIfNeeded()
  }

  store(key: string, buffer: AudioBuffer, pin = false): void {
    const existing = this.entries.get(key)
    if (existing) {
      this._usedBytes -= existing.sizeBytes
      this.entries.delete(key)
    }
    const sizeBytes = bufferBytes(buffer)
    this._usedBytes += sizeBytes
    this.entries.set(key, { key, buffer, sizeBytes, lastAccess: Date.now(), pinned: pin })
    this.evictIfNeeded()
  }

  get(key: string): AudioBuffer | null {
    const entry = this.entries.get(key)
    if (!entry) return null
    entry.lastAccess = Date.now()
    return entry.buffer
  }

  pin(key: string): void {
    const e = this.entries.get(key)
    if (e) e.pinned = true
  }

  unpin(key: string): void {
    const e = this.entries.get(key)
    if (e) e.pinned = false
  }

  evict(key: string): void {
    const e = this.entries.get(key)
    if (!e) return
    this._usedBytes -= e.sizeBytes
    this.entries.delete(key)
  }

  clear(keepPinned = true): void {
    for (const [key, entry] of this.entries) {
      if (keepPinned && entry.pinned) continue
      this._usedBytes -= entry.sizeBytes
      this.entries.delete(key)
    }
  }

  stats(): { entries: number; usedMB: number; budgetMB: number; pressure: MemoryPressure } {
    return {
      entries:  this.entries.size,
      usedMB:   Math.round(this._usedBytes / 1024 / 1024),
      budgetMB: Math.round(this._budgetBytes / 1024 / 1024),
      pressure: this.pressure,
    }
  }

  private evictIfNeeded(): void {
    if (this._usedBytes <= this._budgetBytes) return
    // Sort unpinned by lastAccess (oldest first)
    const candidates = [...this.entries.values()]
      .filter(e => !e.pinned)
      .sort((a, b) => a.lastAccess - b.lastAccess)

    for (const entry of candidates) {
      if (this._usedBytes <= this._budgetBytes * 0.80) break
      this.evict(entry.key)
    }
  }
}

export const memoryManager = new MemoryManager()
