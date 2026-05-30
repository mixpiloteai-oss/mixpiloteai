// ─── Smart Cache ──────────────────────────────────────────────────────────────
// Two-level cache for decoded AudioBuffers and waveform data:
//   L1 — in-memory Map (fast, lost on reload)
//   L2 — IndexedDB     (persistent across sessions, slower)
//
// Serialises AudioBuffers as Float32Array[] (one per channel) for IDB storage.

import { memoryManager } from './MemoryManager'

const DB_NAME    = 'mixpilot-audio-cache-v1'
const DB_VERSION = 1
const STORE_PCM  = 'pcm'
const STORE_WAVE = 'waveform'

const TTL_MS = 7 * 24 * 60 * 60 * 1000   // 7 days

// ── IDB helpers ───────────────────────────────────────────────────────────────

interface PCMRecord {
  key:         string
  channels:    Float32Array[]
  sampleRate:  number
  length:      number
  savedAt:     number
}

interface WaveRecord {
  key:     string
  data:    number[]
  savedAt: number
}

class SmartCacheDB {
  private db: IDBDatabase | null = null

  async open(): Promise<void> {
    if (this.db) return
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = e => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_PCM))
          db.createObjectStore(STORE_PCM, { keyPath: 'key' })
        if (!db.objectStoreNames.contains(STORE_WAVE))
          db.createObjectStore(STORE_WAVE, { keyPath: 'key' })
      }
      req.onsuccess = e => { this.db = (e.target as IDBOpenDBRequest).result; resolve() }
      req.onerror   = e => reject((e.target as IDBOpenDBRequest).error)
    })
  }

  private tx(store: string, mode: IDBTransactionMode) {
    return this.db!.transaction(store, mode).objectStore(store)
  }

  async getPCM(key: string): Promise<PCMRecord | null> {
    await this.open()
    return new Promise((resolve, reject) => {
      const req = this.tx(STORE_PCM, 'readonly').get(key)
      req.onsuccess = e => resolve((e.target as IDBRequest<PCMRecord | undefined>).result ?? null)
      req.onerror   = e => reject((e.target as IDBRequest).error)
    })
  }

  async putPCM(rec: PCMRecord): Promise<void> {
    await this.open()
    return new Promise((resolve, reject) => {
      const req = this.tx(STORE_PCM, 'readwrite').put(rec)
      req.onsuccess = () => resolve()
      req.onerror   = e => reject((e.target as IDBRequest).error)
    })
  }

  async getWave(key: string): Promise<WaveRecord | null> {
    await this.open()
    return new Promise((resolve, reject) => {
      const req = this.tx(STORE_WAVE, 'readonly').get(key)
      req.onsuccess = e => resolve((e.target as IDBRequest<WaveRecord | undefined>).result ?? null)
      req.onerror   = e => reject((e.target as IDBRequest).error)
    })
  }

  async putWave(rec: WaveRecord): Promise<void> {
    await this.open()
    return new Promise((resolve, reject) => {
      const req = this.tx(STORE_WAVE, 'readwrite').put(rec)
      req.onsuccess = () => resolve()
      req.onerror   = e => reject((e.target as IDBRequest).error)
    })
  }

  async deleteOldEntries(): Promise<void> {
    await this.open()
    const cutoff = Date.now() - TTL_MS
    for (const storeName of [STORE_PCM, STORE_WAVE]) {
      await new Promise<void>((resolve) => {
        const store  = this.tx(storeName, 'readwrite')
        const cursor = store.openCursor()
        cursor.onsuccess = (e) => {
          const cur = (e.target as IDBRequest<IDBCursorWithValue | null>).result
          if (!cur) { resolve(); return }
          if ((cur.value as { savedAt: number }).savedAt < cutoff) cur.delete()
          cur.continue()
        }
        cursor.onerror = () => resolve()
      })
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const idb = new SmartCacheDB()

export async function cacheAudioBuffer(key: string, buffer: AudioBuffer, pin = false): Promise<void> {
  memoryManager.store(key, buffer, pin)
  // Persist to IDB in background
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c).slice())
  }
  idb.putPCM({ key, channels, sampleRate: buffer.sampleRate, length: buffer.length, savedAt: Date.now() })
    .catch(() => { /* IDB write failure is non-fatal */ })
}

export async function getCachedBuffer(key: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  // L1 check
  const l1 = memoryManager.get(key)
  if (l1) return l1

  // L2 check
  try {
    const rec = await idb.getPCM(key)
    if (!rec || Date.now() - rec.savedAt > TTL_MS) return null
    const buf = ctx.createBuffer(rec.channels.length, rec.length, rec.sampleRate)
    for (let c = 0; c < rec.channels.length; c++) {
      buf.copyToChannel(rec.channels[c]! as Float32Array<ArrayBuffer>, c)
    }
    memoryManager.store(key, buf)
    return buf
  } catch {
    return null
  }
}

export async function cacheWaveform(key: string, data: number[]): Promise<void> {
  idb.putWave({ key, data, savedAt: Date.now() }).catch(() => {})
}

export async function getCachedWaveform(key: string): Promise<number[] | null> {
  try {
    const rec = await idb.getWave(key)
    if (!rec || Date.now() - rec.savedAt > TTL_MS) return null
    return rec.data
  } catch {
    return null
  }
}

export function evictBuffer(key: string): void {
  memoryManager.evict(key)
}

/** Run periodically to clean up stale IDB entries. */
export function pruneCache(): void {
  idb.deleteOldEntries().catch(() => {})
}
