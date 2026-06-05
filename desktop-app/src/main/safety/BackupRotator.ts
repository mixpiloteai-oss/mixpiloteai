/**
 * BackupRotator — manages a rotating collection of project snapshots on disk.
 *
 * Files are stored as `<backupDir>/<id>.bak.json`.
 * An `index.json` manifest (array of BackupEntry, newest first) is kept in sync.
 */

import { promises as fs } from 'fs'
import { join } from 'path'

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

// ── BackupRotator ─────────────────────────────────────────────────────────────

export class BackupRotator {
  private readonly backupDir: string
  private readonly maxBackups: number
  private readonly indexPath: string

  constructor(backupDir: string, maxBackups: number) {
    this.backupDir = backupDir
    this.maxBackups = maxBackups
    this.indexPath = join(backupDir, 'index.json')
  }

  async saveSnapshot(
    json: string,
    projectId: string,
    projectName: string,
    isCrashRecovery = false,
  ): Promise<BackupEntry> {
    await this.ensureDir()

    const id = `${projectId}_${Date.now()}`
    const filePath = join(this.backupDir, `${id}.bak.json`)
    await fs.writeFile(filePath, json, 'utf8')

    const stat = await fs.stat(filePath)
    const entry: BackupEntry = {
      id,
      savedAt: Date.now(),
      projectName,
      projectId,
      size: stat.size,
      isCrashRecovery,
      checksumValid: true,
    }

    const entries = await this.readIndex()
    entries.unshift(entry)

    // Prune old entries
    while (entries.length > this.maxBackups) {
      const oldest = entries.pop()!
      await this.deleteFile(oldest.id)
    }

    await this.writeIndex(entries)
    return entry
  }

  async listSnapshots(projectId?: string): Promise<BackupEntry[]> {
    const entries = await this.readIndex()
    const filtered = projectId ? entries.filter(e => e.projectId === projectId) : entries
    // Sort newest first
    return filtered.sort((a, b) => b.savedAt - a.savedAt)
  }

  async loadSnapshot(id: string): Promise<string | null> {
    try {
      const filePath = join(this.backupDir, `${id}.bak.json`)
      return await fs.readFile(filePath, 'utf8')
    } catch {
      return null
    }
  }

  async deleteSnapshot(id: string): Promise<void> {
    await this.deleteFile(id)
    const entries = await this.readIndex()
    await this.writeIndex(entries.filter(e => e.id !== id))
  }

  async clearCrashRecovery(projectId?: string): Promise<void> {
    const entries = await this.readIndex()
    const updated = entries.map(e => {
      if (projectId && e.projectId !== projectId) return e
      return { ...e, isCrashRecovery: false }
    })
    await this.writeIndex(updated)
  }

  async getMostRecent(projectId?: string): Promise<BackupEntry | null> {
    const list = await this.listSnapshots(projectId)
    return list[0] ?? null
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true })
  }

  private async readIndex(): Promise<BackupEntry[]> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf8')
      return JSON.parse(raw) as BackupEntry[]
    } catch {
      return []
    }
  }

  private async writeIndex(entries: BackupEntry[]): Promise<void> {
    await this.ensureDir()
    await fs.writeFile(this.indexPath, JSON.stringify(entries, null, 2), 'utf8')
  }

  private async deleteFile(id: string): Promise<void> {
    try {
      await fs.unlink(join(this.backupDir, `${id}.bak.json`))
    } catch {
      // Ignore
    }
  }
}
