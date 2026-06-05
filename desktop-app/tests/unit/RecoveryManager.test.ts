import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { RecoveryManager } from '../../src/renderer/src/audio/safety/RecoveryManager.ts'
import type { BackupEntry } from '../../src/renderer/src/audio/safety/RecoveryManager.ts'
import { serializeProject } from '../../src/renderer/src/audio/safety/ProjectSerializer.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<BackupEntry> = {}): BackupEntry {
  return {
    id: 'snap-1',
    savedAt: Date.now(),
    projectName: 'Test Project',
    projectId: 'proj-1',
    size: 1024,
    isCrashRecovery: true,
    checksumValid: true,
    ...overrides,
  }
}

function makeValidSnapshotJson(): string {
  const state = { bpm: 128, tracks: [] }
  return JSON.stringify(serializeProject(state))
}

type MockAPI = {
  safetyCheckRecovery: () => Promise<{ hasCrashRecovery: boolean; snapshots: BackupEntry[] }>
  safetyRestoreSnapshot: (id: string) => Promise<string | null>
  safetyDiscardRecovery: () => Promise<void>
  safetyListBackups: () => Promise<BackupEntry[]>
  safetyDeleteBackup: (id: string) => Promise<void>
}

function setGlobalAPI(api: Partial<MockAPI>): void {
  (globalThis as { window?: { electronAPI?: Partial<MockAPI> } }).window = { electronAPI: api }
}

function clearGlobalAPI(): void {
  (globalThis as { window?: unknown }).window = undefined
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecoveryManager', () => {
  let manager: RecoveryManager

  beforeEach(() => {
    manager = new RecoveryManager()
    clearGlobalAPI()
  })

  describe('checkForRecovery', () => {
    it('returns hasCrashRecovery=false and recommendation=null when no crash', async () => {
      setGlobalAPI({
        safetyCheckRecovery: async () => ({ hasCrashRecovery: false, snapshots: [] }),
      })
      const result = await manager.checkForRecovery()
      assert.equal(result.hasCrashRecovery, false)
      assert.equal(result.recommendation, null)
    })

    it('returns hasCrashRecovery=true with snapshots when crash occurred', async () => {
      const snap1 = makeEntry({ id: 'snap-old', savedAt: Date.now() - 10000 })
      const snap2 = makeEntry({ id: 'snap-new', savedAt: Date.now() })
      setGlobalAPI({
        safetyCheckRecovery: async () => ({ hasCrashRecovery: true, snapshots: [snap1, snap2] }),
      })
      const result = await manager.checkForRecovery()
      assert.equal(result.hasCrashRecovery, true)
      assert.equal(result.snapshots.length, 2)
    })

    it('recommendation is the most recent valid snapshot', async () => {
      const older = makeEntry({ id: 'snap-a', savedAt: 1000, checksumValid: true })
      const newer = makeEntry({ id: 'snap-b', savedAt: 2000, checksumValid: true })
      setGlobalAPI({
        safetyCheckRecovery: async () => ({ hasCrashRecovery: true, snapshots: [older, newer] }),
      })
      const result = await manager.checkForRecovery()
      assert.ok(result.recommendation !== null)
      assert.equal(result.recommendation!.id, 'snap-b')
    })

    it('recommendation is null if no checksumValid snapshot', async () => {
      const invalid = makeEntry({ id: 'snap-x', checksumValid: false })
      setGlobalAPI({
        safetyCheckRecovery: async () => ({ hasCrashRecovery: true, snapshots: [invalid] }),
      })
      const result = await manager.checkForRecovery()
      assert.equal(result.recommendation, null)
    })

    it('returns safe defaults when electronAPI is unavailable', async () => {
      clearGlobalAPI()
      const result = await manager.checkForRecovery()
      assert.equal(result.hasCrashRecovery, false)
      assert.equal(result.recommendation, null)
    })
  })

  describe('restoreSnapshot', () => {
    it('returns success=true with a valid snapshot', async () => {
      const json = makeValidSnapshotJson()
      setGlobalAPI({
        safetyRestoreSnapshot: async (_id) => json,
      })
      const result = await manager.restoreSnapshot('snap-1')
      assert.equal(result.success, true)
      assert.ok(result.snapshot !== null)
    })

    it('returns success=false when snapshot is not found', async () => {
      setGlobalAPI({
        safetyRestoreSnapshot: async (_id) => null,
      })
      const result = await manager.restoreSnapshot('missing-id')
      assert.equal(result.success, false)
      assert.equal(result.snapshot, null)
    })

    it('returns success=false for corrupt JSON', async () => {
      setGlobalAPI({
        safetyRestoreSnapshot: async (_id) => '{"invalid":true,"checksum":999}',
      })
      const result = await manager.restoreSnapshot('corrupt-id')
      assert.equal(result.success, false)
    })
  })

  describe('discardRecovery', () => {
    it('calls safetyDiscardRecovery on the API', async () => {
      let called = false
      setGlobalAPI({
        safetyDiscardRecovery: async () => { called = true },
      })
      await manager.discardRecovery()
      assert.equal(called, true)
    })

    it('does not throw when API is unavailable', async () => {
      clearGlobalAPI()
      await assert.doesNotReject(() => manager.discardRecovery())
    })
  })

  describe('listBackups', () => {
    it('returns an array of BackupEntry objects', async () => {
      const entries = [makeEntry({ id: 'b1' }), makeEntry({ id: 'b2' })]
      setGlobalAPI({
        safetyListBackups: async () => entries,
      })
      const result = await manager.listBackups()
      assert.equal(result.length, 2)
      assert.equal(result[0].id, 'b1')
    })

    it('returns empty array when API is unavailable', async () => {
      clearGlobalAPI()
      const result = await manager.listBackups()
      assert.deepEqual(result, [])
    })
  })
})
