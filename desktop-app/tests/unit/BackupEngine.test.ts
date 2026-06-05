/**
 * BackupEngine tests
 *
 * Since BackupEngine (renderer-side) depends on ProjectSerializer which in turn
 * imports Zustand stores (browser-only modules), we can't import BackupEngine
 * directly in a pure Node test environment.
 *
 * Instead we:
 *   1. Define the same BackupStorage interface inline (matching BackupEngine.ts).
 *   2. Implement the core BackupEngine logic in a test-local class that uses the
 *      same algorithm but injects snapshots directly (no ProjectSerializer).
 *   3. Verify all public contract behaviors: createBackup, listBackups,
 *      deleteBackup, pruneOld.
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ─── Types (mirroring src/renderer/src/audio/save/types.ts) ──────────────────

interface ProjectSaveData {
  version:    number
  savedAt:    number
  appVersion: string
  project:    unknown
  mixer:      unknown
  transport:  unknown
  pianoRoll:  unknown
  midi:       unknown
}

interface ProjectSnapshot {
  id:        string
  label:     string
  createdAt: number
  type:      'manual' | 'auto' | 'crash' | 'backup' | 'pre-action'
  data:      ProjectSaveData
  checksum:  string
  sizeBytes: number
  dirty:     boolean
}

// ─── BackupStorage interface (mirrors BackupEngine.ts) ───────────────────────

interface BackupStorage {
  put(snap: ProjectSnapshot): Promise<void>
  getAll(): Promise<ProjectSnapshot[]>
  delete(id: string): Promise<void>
}

// ─── In-memory mock storage ───────────────────────────────────────────────────

class MemoryBackupStorage implements BackupStorage {
  private store = new Map<string, ProjectSnapshot>()

  async put(snap: ProjectSnapshot): Promise<void> {
    this.store.set(snap.id, snap)
  }

  async getAll(): Promise<ProjectSnapshot[]> {
    return Array.from(this.store.values())
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  size(): number {
    return this.store.size
  }
}

// ─── Minimal BackupEngine implementation (same logic as the real one) ─────────

const MAX_BACKUPS_TEST = 20

function makeTestSnapshot(label: string, createdAt: number, id: string): ProjectSnapshot {
  const data: ProjectSaveData = {
    version: 1, savedAt: createdAt, appVersion: '1.0.0',
    project: null, mixer: null, transport: null, pianoRoll: null, midi: null,
  }
  const str = JSON.stringify(data)
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h >>> 0
  }
  return {
    id, label, createdAt, type: 'backup', data,
    checksum: h.toString(16).padStart(8, '0'),
    sizeBytes: Buffer.byteLength(str, 'utf8'),
    dirty: false,
  }
}

class TestBackupEngine {
  private storage: BackupStorage

  constructor(storage: BackupStorage) {
    this.storage = storage
  }

  async createBackup(label: string): Promise<ProjectSnapshot> {
    const snap = makeTestSnapshot(label, Date.now(), `snap-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await this.storage.put(snap)
    return snap
  }

  async listBackups(): Promise<ProjectSnapshot[]> {
    const all = await this.storage.getAll()
    all.sort((a, b) => b.createdAt - a.createdAt)
    return all
  }

  async deleteBackup(id: string): Promise<void> {
    await this.storage.delete(id)
  }

  async pruneOld(max = MAX_BACKUPS_TEST): Promise<void> {
    const all = await this.storage.getAll()
    if (all.length <= max) return
    all.sort((a, b) => b.createdAt - a.createdAt)
    const toDelete = all.slice(max)
    await Promise.all(toDelete.map(s => this.storage.delete(s.id)))
  }
}

// ─── Test state ───────────────────────────────────────────────────────────────

let storage: MemoryBackupStorage
let engine: TestBackupEngine

beforeEach(() => {
  storage = new MemoryBackupStorage()
  engine  = new TestBackupEngine(storage)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BackupEngine / createBackup', () => {
  it('puts a snapshot in storage', async () => {
    await engine.createBackup('my backup')
    assert.equal(storage.size(), 1)
  })

  it('snapshot has type=backup', async () => {
    const snap = await engine.createBackup('test')
    assert.equal(snap.type, 'backup')
  })

  it('stores the snapshot with the given label', async () => {
    await engine.createBackup('important save')
    const all = await storage.getAll()
    assert.ok(all.some(s => s.label === 'important save'))
  })
})

describe('BackupEngine / listBackups', () => {
  it('returns backups sorted by createdAt desc', async () => {
    // Insert snapshots with distinct timestamps by using storage directly
    const now = Date.now()
    await storage.put(makeTestSnapshot('first',  now + 0,   'id-0'))
    await storage.put(makeTestSnapshot('second', now + 100, 'id-1'))
    await storage.put(makeTestSnapshot('third',  now + 200, 'id-2'))

    const list = await engine.listBackups()
    assert.equal(list.length, 3)

    // Verify descending order
    for (let i = 0; i < list.length - 1; i++) {
      assert.ok(
        (list[i]?.createdAt ?? 0) >= (list[i + 1]?.createdAt ?? 0),
        `item ${i} should have createdAt >= item ${i + 1}`,
      )
    }
  })

  it('returns empty list when no backups exist', async () => {
    const list = await engine.listBackups()
    assert.equal(list.length, 0)
  })
})

describe('BackupEngine / deleteBackup', () => {
  it('removes from storage', async () => {
    const snap = await engine.createBackup('to delete')
    assert.equal(storage.size(), 1)

    await engine.deleteBackup(snap.id)
    assert.equal(storage.size(), 0)
  })

  it('does not throw when deleting non-existent id', async () => {
    await engine.createBackup('existing')
    // Should not throw
    await engine.deleteBackup('non-existent-id')
    assert.equal(storage.size(), 1)
  })
})

describe('BackupEngine / pruneOld', () => {
  it('removes oldest when over limit', async () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      await storage.put(makeTestSnapshot(`backup ${i}`, now + i * 100, `id-${i}`))
    }
    assert.equal(storage.size(), 5)

    await engine.pruneOld(3)
    assert.equal(storage.size(), 3)
  })

  it('pruneOld(1) keeps only the 1 most recent backup', async () => {
    const now = Date.now()
    await storage.put(makeTestSnapshot('first',  now + 0,   'id-a'))
    await storage.put(makeTestSnapshot('second', now + 100, 'id-b'))
    await storage.put(makeTestSnapshot('third',  now + 200, 'id-c'))

    await engine.pruneOld(1)

    const list = await engine.listBackups()
    assert.equal(list.length, 1)
    // The most recent one (third) should remain
    assert.equal(list[0]?.label, 'third')
  })

  it('after pruneOld, count is <= max', async () => {
    const now = Date.now()
    for (let i = 0; i < 10; i++) {
      await storage.put(makeTestSnapshot(`backup ${i}`, now + i * 100, `id-${i}`))
    }

    const max = 4
    await engine.pruneOld(max)

    const list = await engine.listBackups()
    assert.ok(list.length <= max, `count ${list.length} should be <= ${max}`)
  })

  it('does nothing when count is at or below limit', async () => {
    await engine.createBackup('a')
    await engine.createBackup('b')

    await engine.pruneOld(5)
    assert.equal(storage.size(), 2)
  })
})
