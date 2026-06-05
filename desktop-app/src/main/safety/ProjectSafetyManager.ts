/**
 * ProjectSafetyManager — main-process coordinator for the Project Safety System.
 *
 * Owns CrashGuard + BackupRotator and registers all IPC handlers.
 */

import { join } from 'path'
import { CrashGuard } from './CrashGuard'
import { BackupRotator } from './BackupRotator'
import type { IpcMain } from 'electron'

// ── ProjectSafetyManager ─────────────────────────────────────────────────────

export class ProjectSafetyManager {
  private readonly userDataPath: string
  private crashGuard!: CrashGuard
  private backupRotator!: BackupRotator

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath
  }

  async initialize(): Promise<{ hasCrashed: boolean }> {
    const backupDir = join(this.userDataPath, 'safety-backups')
    this.crashGuard = new CrashGuard(this.userDataPath)
    await this.crashGuard.initialize()
    this.backupRotator = new BackupRotator(backupDir, 20)
    return { hasCrashed: this.crashGuard.hasCrashed }
  }

  registerIpcHandlers(ipcMain: IpcMain): void {
    // Save a project snapshot (fire-and-forget from renderer)
    ipcMain.handle(
      'safety:autosave',
      async (_e, json: string, projectId: string, projectName: string) => {
        return this.backupRotator.saveSnapshot(json, projectId, projectName, false)
      },
    )

    // Check whether a crash recovery is available
    ipcMain.handle('safety:check-recovery', async () => {
      const hasCrashRecovery = this.crashGuard.hasCrashed
      const snapshots = await this.backupRotator.listSnapshots()
      return { hasCrashRecovery, snapshots }
    })

    // Restore a specific snapshot (returns raw JSON string)
    ipcMain.handle('safety:restore-snapshot', async (_e, id: string) => {
      return this.backupRotator.loadSnapshot(id)
    })

    // Discard recovery: mark CrashGuard clean + clear crash flags on backups
    ipcMain.handle('safety:discard-recovery', async () => {
      await this.crashGuard.markClean()
      await this.backupRotator.clearCrashRecovery()
    })

    // List all backups
    ipcMain.handle('safety:list-backups', async () => {
      return this.backupRotator.listSnapshots()
    })

    // Delete a specific backup
    ipcMain.handle('safety:delete-backup', async (_e, id: string) => {
      return this.backupRotator.deleteSnapshot(id)
    })

    // Mark the current session as clean (called on graceful quit)
    ipcMain.handle('safety:mark-clean', async () => {
      await this.crashGuard.markClean()
    })
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export const createSafetyManager = (userDataPath: string): ProjectSafetyManager =>
  new ProjectSafetyManager(userDataPath)
