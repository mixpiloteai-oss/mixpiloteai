import { getProjectSerializer } from './ProjectSerializer'
import type { ProjectSnapshot, SaveStatus } from './types'

const IDB_DB    = 'mixpilot-autosave'
const IDB_STORE = 'snapshots'
const MAX_AUTO  = 20    // max auto-save slots in IDB

// ─── AutoSaveEngine ───────────────────────────────────────────────────────────

export class AutoSaveEngine {
  private intervalSecs:   number = 30
  private timerId:        ReturnType<typeof setInterval> | null = null
  private countdownTimer: ReturnType<typeof setInterval> | null = null
  private countdown:      number = 30
  private db:             IDBDatabase | null = null
  private onStatusCb:     ((s: SaveStatus) => void) | null = null
  private isDirty:        boolean = false
  private lastSavedAt:    number | null = null
  private saveCount:      number = 0
  private currentState:   SaveStatus['state'] = 'idle'
  private lastError:      string | null = null

  async init(interval?: number): Promise<void> {
    await this._openIDB()
    if (interval !== undefined) {
      this.intervalSecs = interval
      this.countdown    = interval
    }
    this._startTimers()
    this._emitStatus()
  }

  setInterval(seconds: number): void {
    this.intervalSecs = seconds
    this.countdown    = seconds
    this._stopTimers()
    this._startTimers()
    this._emitStatus()
  }

  setOnStatus(cb: (s: SaveStatus) => void): void {
    this.onStatusCb = cb
    this._emitStatus()
  }

  markDirty(): void {
    this.isDirty      = true
    this.currentState = 'dirty'
    this._emitStatus()
  }

  markClean(): void {
    this.isDirty      = false
    this.currentState = 'idle'
    this._emitStatus()
  }

  async saveNow(label?: string): Promise<void> {
    this.currentState = 'saving'
    this.lastError    = null
    this._emitStatus()

    try {
      const serializer = getProjectSerializer()
      const snap       = serializer.makeSnapshot(
        label ?? `Auto-save #${++this.saveCount}`,
        'auto',
      )

      // Save to IDB
      await this._idbPut(snap)
      await this.pruneOld()

      // Save via Electron API (best effort, don't fail if unavailable)
      const api = window.electronAPI
      if (api) {
        try {
          await api.autosaveSaveNow(snap)
        } catch {
          // ignore — electron API may not be available in dev
        }
      }

      this.lastSavedAt  = Date.now()
      this.isDirty      = false
      this.currentState = 'idle'
    } catch (err) {
      this.currentState = 'error'
      this.lastError    = err instanceof Error ? err.message : String(err)
    }

    this._emitStatus()
  }

  async loadLatest(): Promise<ProjectSnapshot | null> {
    // Try Electron API first
    const api = window.electronAPI
    if (api) {
      try {
        const raw = await api.autosaveLoadLatest()
        if (raw !== null && raw !== undefined) {
          return raw as ProjectSnapshot
        }
      } catch {
        // fall through to IDB
      }
    }

    // Fallback to IDB latest
    const all = await this._idbGetAll()
    if (all.length === 0) return null
    all.sort((a, b) => b.createdAt - a.createdAt)
    return all[0] ?? null
  }

  async listSnapshots(): Promise<ProjectSnapshot[]> {
    const all = await this._idbGetAll()
    all.sort((a, b) => b.createdAt - a.createdAt)
    return all
  }

  async deleteSnapshot(id: string): Promise<void> {
    await this._idbDelete(id)
  }

  async pruneOld(): Promise<void> {
    const all = await this._idbGetAll()
    if (all.length <= MAX_AUTO) return

    // Sort by createdAt desc, delete the oldest beyond MAX_AUTO
    all.sort((a, b) => b.createdAt - a.createdAt)
    const toDelete = all.slice(MAX_AUTO)
    await Promise.all(toDelete.map(s => this._idbDelete(s.id)))
  }

  destroy(): void {
    this._stopTimers()
  }

  // ─── IDB helpers ─────────────────────────────────────────────────────────────

  private async _openIDB(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(IDB_DB, 1)

      req.onupgradeneeded = (e) => {
        const db    = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          const store = db.createObjectStore(IDB_STORE, { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }

      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result
        resolve()
      }

      req.onerror = () => {
        reject(new Error(`Failed to open IDB: ${req.error?.message ?? 'unknown'}`))
      }
    })
  }

  private _idbPut(snapshot: ProjectSnapshot): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { reject(new Error('IDB not initialised')); return }
      const tx  = this.db.transaction(IDB_STORE, 'readwrite')
      const req = tx.objectStore(IDB_STORE).put(snapshot)
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(new Error(req.error?.message ?? 'IDB put error'))
    })
  }

  private _idbGetAll(): Promise<ProjectSnapshot[]> {
    return new Promise<ProjectSnapshot[]>((resolve, reject) => {
      if (!this.db) { resolve([]); return }
      const tx  = this.db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).getAll()
      req.onsuccess = () => resolve(req.result as ProjectSnapshot[])
      req.onerror   = () => reject(new Error(req.error?.message ?? 'IDB getAll error'))
    })
  }

  private _idbDelete(id: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { resolve(); return }
      const tx  = this.db.transaction(IDB_STORE, 'readwrite')
      const req = tx.objectStore(IDB_STORE).delete(id)
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(new Error(req.error?.message ?? 'IDB delete error'))
    })
  }

  // ─── Timer helpers ────────────────────────────────────────────────────────────

  private _startTimers(): void {
    this.countdown = this.intervalSecs
    this.countdownTimer = setInterval(() => { this._tick() }, 1000)
  }

  private _stopTimers(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
  }

  private _tick(): void {
    this.countdown -= 1
    this._emitStatus()

    if (this.countdown <= 0) {
      this.countdown = this.intervalSecs
      // Fire-and-forget — errors handled inside saveNow
      void this.saveNow()
    }
  }

  private _emitStatus(): void {
    if (!this.onStatusCb) return
    const status: SaveStatus = {
      state:       this.currentState,
      lastSavedAt: this.lastSavedAt,
      lastError:   this.lastError,
      autoSaveIn:  Math.max(0, this.countdown),
      isDirty:     this.isDirty,
    }
    this.onStatusCb(status)
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _autoSaveInstance: AutoSaveEngine | null = null

export function getAutoSaveEngine(): AutoSaveEngine {
  if (!_autoSaveInstance) {
    _autoSaveInstance = new AutoSaveEngine()
  }
  return _autoSaveInstance
}
