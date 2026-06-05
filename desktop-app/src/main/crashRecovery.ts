import { writeFile, readFile, unlink, readdir, stat, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { IpcMain } from 'electron'

interface MarkerData {
  pid:       number
  timestamp: number
  sessionId: string
}

export class CrashRecoveryManager {
  private dir: string

  constructor(opts?: { dir?: string }) {
    this.dir = opts?.dir ?? ''
  }

  private resolveDir(): string {
    if (this.dir) return this.dir
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as { app: { getPath: (k: string) => string } }
    return join(app.getPath('userData'), 'crash-markers')
  }

  private markerPath(sessionId: string): string {
    return join(this.resolveDir(), `crash-${sessionId}.marker`)
  }

  async writeCrashMarker(sessionId: string): Promise<void> {
    const dir  = this.resolveDir()
    await mkdir(dir, { recursive: true })
    const data: MarkerData = { pid: process.pid, timestamp: Date.now(), sessionId }
    await writeFile(this.markerPath(sessionId), JSON.stringify(data), 'utf8')
  }

  async hasCrashMarker(sessionId: string): Promise<boolean> {
    try {
      await readFile(this.markerPath(sessionId))
      return true
    } catch {
      return false
    }
  }

  async clearCrashMarker(sessionId: string): Promise<void> {
    try { await unlink(this.markerPath(sessionId)) } catch { /* already gone */ }
  }

  async listMarkers(): Promise<string[]> {
    const dir = this.resolveDir()
    try {
      const files = await readdir(dir)
      return files.filter(f => f.endsWith('.marker'))
    } catch {
      return []
    }
  }

  async pruneOldMarkers(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const dir   = this.resolveDir()
    const files = await this.listMarkers()
    const now   = Date.now()
    for (const filename of files) {
      const s = await stat(join(dir, filename))
      if (now - s.mtimeMs > maxAgeMs) {
        await unlink(join(dir, filename)).catch(() => undefined)
      }
    }
  }
}

export function registerCrashRecoveryIPC(ipcMain: IpcMain, mgr: CrashRecoveryManager): void {
  ipcMain.handle('perf:crash-write-marker', (_e, sessionId: string) => mgr.writeCrashMarker(sessionId))
  ipcMain.handle('perf:crash-has-marker',   (_e, sessionId: string) => mgr.hasCrashMarker(sessionId))
  ipcMain.handle('perf:crash-clear-marker', (_e, sessionId: string) => mgr.clearCrashMarker(sessionId))
  ipcMain.handle('perf:crash-list-markers', ()                       => mgr.listMarkers())
}
