// ─── BackupEngine ─────────────────────────────────────────────────────────────
// Renderer-side named project backup management.
// Uses a separate IDB object store 'backups' in the same database as AutoSaveEngine.

import type { ProjectSnapshot } from './types.ts'

const IDB_DB      = 'mixpilot-autosave'
const IDB_STORE   = 'backups'
const IDB_VERSION = 2   // upgrade from v1 (snapshots store) to v2 (adds backups store)

// ─── BackupStorage interface ──────────────────────────────────────────────────

export interface BackupStorage {
  put(snap: ProjectSnapshot): Promise<void>
  getAll(): Promise<ProjectSnapshot[]>
  delete(id: string): Promise<void>
}

// ─── IDBBackupStorage ─────────────────────────────────────────────────────────

export class IDBBackupStorage implements BackupStorage {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(IDB_DB, IDB_VERSION)

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        // Create snapshots store (v1) if not present
        if (!db.objectStoreNames.contains('snapshots')) {
          const s = db.createObjectStore('snapshots', { keyPath: 'id' })
          s.createIndex('createdAt', 'createdAt', { unique: false })
        }
        // Create backups store (v2)
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          const s = db.createObjectStore(IDB_STORE, { keyPath: 'id' })
          s.createIndex('createdAt', 'createdAt', { unique: false })
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

  put(snap: ProjectSnapshot): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { reject(new Error('IDB not initialised')); return }
      const tx  = this.db.transaction(IDB_STORE, 'readwrite')
      const req = tx.objectStore(IDB_STORE).put(snap)
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(new Error(req.error?.message ?? 'IDB put error'))
    })
  }

  getAll(): Promise<ProjectSnapshot[]> {
    return new Promise<ProjectSnapshot[]>((resolve, reject) => {
      if (!this.db) { resolve([]); return }
      const tx  = this.db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).getAll()
      req.onsuccess = () => resolve(req.result as ProjectSnapshot[])
      req.onerror   = () => reject(new Error(req.error?.message ?? 'IDB getAll error'))
    })
  }

  delete(id: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { resolve(); return }
      const tx  = this.db.transaction(IDB_STORE, 'readwrite')
      const req = tx.objectStore(IDB_STORE).delete(id)
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(new Error(req.error?.message ?? 'IDB delete error'))
    })
  }
}

// ─── BackupEngine ─────────────────────────────────────────────────────────────

const MAX_BACKUPS = 20

export class BackupEngine {
  private storage: BackupStorage
  private idbStorage: IDBBackupStorage | null = null

  constructor(storage?: BackupStorage) {
    if (storage) {
      this.storage = storage
    } else {
      this.idbStorage = new IDBBackupStorage()
      this.storage    = this.idbStorage
    }
  }

  /** Initialize storage (open IDB if using default storage) */
  async init(): Promise<void> {
    if (this.idbStorage) {
      await this.idbStorage.init()
    }
  }

  /** Create a named backup snapshot */
  async createBackup(label: string): Promise<ProjectSnapshot> {
    const { getProjectSerializer } = await import('./ProjectSerializer.ts')
    const snap = getProjectSerializer().makeSnapshot(label, 'backup')
    await this.storage.put(snap)
    return snap
  }

  /** List all backups, sorted by createdAt descending */
  async listBackups(): Promise<ProjectSnapshot[]> {
    const all = await this.storage.getAll()
    all.sort((a, b) => b.createdAt - a.createdAt)
    return all
  }

  /** Restore a backup by ID */
  async restoreBackup(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const all  = await this.storage.getAll()
    const snap = all.find(s => s.id === id)

    if (!snap) {
      return { ok: false, reason: `Backup not found: ${id}` }
    }

    const { getProjectSerializer } = await import('./ProjectSerializer.ts')
    const serializer = getProjectSerializer()
    if (!serializer.verify(snap)) {
      return { ok: false, reason: 'Backup checksum verification failed' }
    }

    return serializer.restore(snap.data)
  }

  /** Delete a backup by ID */
  async deleteBackup(id: string): Promise<void> {
    await this.storage.delete(id)
  }

  /** Remove oldest backups beyond max limit */
  async pruneOld(max = MAX_BACKUPS): Promise<void> {
    const all = await this.storage.getAll()
    if (all.length <= max) return

    // Sort by createdAt desc, delete oldest beyond max
    all.sort((a, b) => b.createdAt - a.createdAt)
    const toDelete = all.slice(max)
    await Promise.all(toDelete.map(s => this.storage.delete(s.id)))
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _backupEngineInstance: BackupEngine | null = null

export function getBackupEngine(): BackupEngine {
  if (!_backupEngineInstance) {
    _backupEngineInstance = new BackupEngine()
  }
  return _backupEngineInstance
}
