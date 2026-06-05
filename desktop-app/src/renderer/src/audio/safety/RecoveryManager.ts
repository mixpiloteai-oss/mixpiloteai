/**
 * RecoveryManager — coordinates the crash recovery flow in the renderer.
 */

import type { ProjectSnapshot } from './ProjectSerializer'

// ── Types ────────────────────────────────────────────────────────────────────

export interface BackupEntry {
  id: string
  savedAt: number
  projectName: string
  projectId: string
  size: number
  isCrashRecovery: boolean
  checksumValid: boolean
}

export interface RecoveryCheckResult {
  hasCrashRecovery: boolean
  snapshots: BackupEntry[]
  recommendation: BackupEntry | null
}

export interface RestoreResult {
  success: boolean
  snapshot: ProjectSnapshot | null
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAPI(): Window['electronAPI'] {
  return (globalThis as unknown as { window?: { electronAPI?: Window['electronAPI'] } }).window?.electronAPI
}

// ── RecoveryManager ──────────────────────────────────────────────────────────

export class RecoveryManager {
  async checkForRecovery(): Promise<RecoveryCheckResult> {
    const api = getAPI()
    const result = api?.safetyCheckRecovery
      ? await (api.safetyCheckRecovery() as Promise<{ hasCrashRecovery: boolean; snapshots: BackupEntry[] }>)
      : { hasCrashRecovery: false, snapshots: [] as BackupEntry[] }

    const { hasCrashRecovery, snapshots } = result

    // Recommendation: most recent snapshot with valid checksum
    const validSnapshots = snapshots.filter(s => s.checksumValid)
    const recommendation =
      validSnapshots.length > 0
        ? validSnapshots.reduce((a, b) => (a.savedAt >= b.savedAt ? a : b))
        : null

    return { hasCrashRecovery, snapshots, recommendation }
  }

  async restoreSnapshot(snapshotId: string): Promise<RestoreResult> {
    const api = getAPI()
    try {
      const json = api?.safetyRestoreSnapshot
        ? await (api.safetyRestoreSnapshot(snapshotId) as Promise<string | null>)
        : null

      if (!json) {
        return { success: false, snapshot: null, error: 'Snapshot not found' }
      }

      const { deserializeProject } = await import('./ProjectSerializer')
      const snapshot = deserializeProject(json)
      if (!snapshot) {
        return { success: false, snapshot: null, error: 'Corrupt snapshot' }
      }

      return { success: true, snapshot }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      return { success: false, snapshot: null, error }
    }
  }

  async discardRecovery(): Promise<void> {
    const api = getAPI()
    if (api?.safetyDiscardRecovery) {
      await (api.safetyDiscardRecovery() as Promise<void>)
    }
  }

  async listBackups(): Promise<BackupEntry[]> {
    const api = getAPI()
    if (api?.safetyListBackups) {
      return (await (api.safetyListBackups() as Promise<BackupEntry[]>)) ?? []
    }
    return []
  }

  async deleteBackup(snapshotId: string): Promise<void> {
    const api = getAPI()
    if (api?.safetyDeleteBackup) {
      await (api.safetyDeleteBackup(snapshotId) as Promise<void>)
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const recoveryManager = new RecoveryManager()
