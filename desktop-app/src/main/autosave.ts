// AutoSaveManager — atomic file-based autosave with rotation (max 10 versions)
import { writeFile, rename, mkdir, readFile, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { IpcMain } from 'electron'

export interface AutosaveVersion {
  filename: string
  savedAt:  string
  sizeBytes: number
}

export class AutoSaveManager {
  private dir: string
  private maxVersions: number

  constructor(opts?: { dir?: string; maxVersions?: number }) {
    // When dir not provided, defer to app.getPath at call time
    this.dir = opts?.dir ?? ''
    this.maxVersions = opts?.maxVersions ?? 10
  }

  private resolveDir(): string {
    if (this.dir) return this.dir
    // Lazy import to avoid requiring electron in tests
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as { app: { getPath: (k: string) => string } }
    return join(app.getPath('userData'), 'autosave2')
  }

  async save(data: unknown): Promise<{ savedAt: string }> {
    const dir = this.resolveDir()
    await mkdir(dir, { recursive: true })
    const savedAt  = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `autosave-${savedAt}.json`
    const tmpPath  = join(dir, filename + '.tmp')
    const finalPath = join(dir, filename)
    await writeFile(tmpPath, JSON.stringify(data), 'utf8')
    await rename(tmpPath, finalPath)
    await this._prune(dir)
    return { savedAt }
  }

  async loadLatest(): Promise<unknown> {
    const versions = await this.listVersions()
    if (versions.length === 0) return null
    const latest = versions[versions.length - 1]
    return this.getVersion(latest.filename)
  }

  async listVersions(): Promise<AutosaveVersion[]> {
    const dir = this.resolveDir()
    await mkdir(dir, { recursive: true })
    const files = (await readdir(dir)).filter(f => f.startsWith('autosave-') && f.endsWith('.json')).sort()
    const results: AutosaveVersion[] = []
    for (const filename of files) {
      const s = await stat(join(dir, filename))
      results.push({ filename, savedAt: filename.replace('autosave-', '').replace('.json', ''), sizeBytes: s.size })
    }
    return results
  }

  async getVersion(filename: string): Promise<unknown> {
    // Path sanitisation: only allow safe autosave filenames
    if (!/^autosave-[\w\-:]+\.json$/.test(filename)) return null
    const dir = this.resolveDir()
    try {
      const content = await readFile(join(dir, filename), 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  private async _prune(dir: string): Promise<void> {
    const files = (await readdir(dir)).filter(f => f.startsWith('autosave-') && f.endsWith('.json')).sort()
    while (files.length > this.maxVersions) {
      await unlink(join(dir, files.shift()!))
    }
  }
}

export function registerAutoSaveIPC(ipcMain: IpcMain, mgr: AutoSaveManager): void {
  ipcMain.handle('perf:autosave-save',          (_e, data: unknown) => mgr.save(data))
  ipcMain.handle('perf:autosave-load-latest',   ()                  => mgr.loadLatest())
  ipcMain.handle('perf:autosave-list-versions', ()                  => mgr.listVersions())
  ipcMain.handle('perf:autosave-get-version',   (_e, fn: string)    => mgr.getVersion(fn))
}
