import { IpcMain, app } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync, readFileSync, readdirSync, mkdirSync, unlinkSync, statSync } from 'fs'

// ─── Paths ────────────────────────────────────────────────────────────────────

const getDir        = () => join(app.getPath('userData'), 'autosave')
const getLockFile   = () => join(app.getPath('userData'), '.session-lock')
const getCheckpoint = () => join(getDir(), 'crash-checkpoint.json')

const MAX_VERSIONS = 10

// ─── Crash detection state ───────────────────────────────────────────────────

interface SessionLock { pid: number; startTime: number }
interface VersionMeta { filename: string; savedAt: string; sizeBytes: number }

let _hadCrash: boolean = false
let _checkpoint: unknown = null

// ─── Session lock helpers ─────────────────────────────────────────────────────

function ensureDir(): void {
  const dir = getDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function writeLock(): void {
  const lock: SessionLock = { pid: process.pid, startTime: Date.now() }
  try { writeFileSync(getLockFile(), JSON.stringify(lock)) } catch { /* ignore */ }
}

function clearLock(): void {
  try { unlinkSync(getLockFile()) } catch { /* ignore */ }
}

function checkCrash(): void {
  const lockPath = getLockFile()
  if (!existsSync(lockPath)) return  // clean first launch

  try {
    const lock: SessionLock = JSON.parse(readFileSync(lockPath, 'utf8'))
    if (lock.pid !== process.pid) {
      // Previous PID left lock file → unclean shutdown
      _hadCrash = true
      const cpPath = getCheckpoint()
      if (existsSync(cpPath)) {
        try { _checkpoint = JSON.parse(readFileSync(cpPath, 'utf8')) } catch { /* ignore */ }
      }
    }
  } catch {
    // Corrupt lock file → treat as crash
    _hadCrash = true
  }
}

// ─── Version metadata ─────────────────────────────────────────────────────────

function listVersionMeta(dir: string): VersionMeta[] {
  return readdirSync(dir)
    .filter(f => f.startsWith('autosave-') && f.endsWith('.json'))
    .sort()
    .map(filename => {
      let sizeBytes = 0
      try { sizeBytes = statSync(join(dir, filename)).size } catch { /* ignore */ }
      // Reconstruct ISO timestamp from filename pattern autosave-YYYY-MM-DDTHH-mm-ss-msZ.json
      const savedAt = filename
        .replace('autosave-', '')
        .replace('.json', '')
        .replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3Z')  // best-effort
      return { filename, savedAt, sizeBytes }
    })
}

// ─── Module ───────────────────────────────────────────────────────────────────

const autosaveModule = {
  /** Call before register() — detects prior crash and writes new session lock */
  init(): void {
    checkCrash()
    ensureDir()
    writeLock()
    app.on('quit', clearLock)
  },

  getCrashInfo(): { hadCrash: boolean; checkpoint: unknown } {
    return { hadCrash: _hadCrash, checkpoint: _checkpoint }
  },

  register(ipcMain: IpcMain): void {
    // ── Autosave ──────────────────────────────────────────────────────────────

    ipcMain.handle('autosave-save-now', (_e, data) => {
      ensureDir()
      const dir = getDir()
      const ts  = new Date().toISOString().replace(/[:.]/g, '-')
      writeFileSync(join(dir, `autosave-${ts}.json`), JSON.stringify(data))

      // Prune oldest beyond MAX_VERSIONS
      const metas = listVersionMeta(dir)
      while (metas.length > MAX_VERSIONS) {
        const oldest = metas.shift()!
        try { unlinkSync(join(dir, oldest.filename)) } catch { /* ignore */ }
      }

      // Update crash checkpoint on every autosave
      try { writeFileSync(getCheckpoint(), JSON.stringify(data)) } catch { /* ignore */ }

      return { savedAt: ts }
    })

    ipcMain.handle('autosave-load-latest', () => {
      const dir = getDir()
      if (!existsSync(dir)) return null
      const metas = listVersionMeta(dir)
      if (!metas.length) return null
      const last = metas[metas.length - 1]!
      try { return JSON.parse(readFileSync(join(dir, last.filename), 'utf8')) } catch { return null }
    })

    ipcMain.handle('autosave-list-versions', () => {
      const dir = getDir()
      if (!existsSync(dir)) return []
      return listVersionMeta(dir).reverse()  // newest first
    })

    ipcMain.handle('autosave-get-version', (_e, filename: string) => {
      const dir  = getDir()
      const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '')  // sanitize
      const path = join(dir, safe)
      if (!existsSync(path) || !safe.startsWith('autosave-')) return null
      try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
    })

    ipcMain.handle('autosave-delete-version', (_e, filename: string) => {
      const dir  = getDir()
      const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '')
      if (!safe.startsWith('autosave-')) return
      const path = join(dir, safe)
      if (existsSync(path)) { try { unlinkSync(path) } catch { /* ignore */ } }
    })

    ipcMain.handle('autosave-set-data',  () => null)
    ipcMain.handle('autosave-get-status', () => ({ enabled: true, intervalMs: 30000 }))

    // ── Crash checkpoint ──────────────────────────────────────────────────────

    ipcMain.handle('crash-save-checkpoint', (_e, data) => {
      ensureDir()
      try { writeFileSync(getCheckpoint(), JSON.stringify(data)) } catch { /* ignore */ }
    })

    ipcMain.handle('crash-check', () => ({
      hadCrash:   _hadCrash,
      checkpoint: _checkpoint,
    }))

    ipcMain.handle('crash-clear-checkpoint', () => {
      _hadCrash   = false
      _checkpoint = null
      try { unlinkSync(getCheckpoint()) } catch { /* ignore */ }
    })

    // ── Debug ─────────────────────────────────────────────────────────────────

    ipcMain.handle('debug-list-crash-logs',  () => [])
    ipcMain.handle('debug-clear-crash-logs', () => null)
    ipcMain.handle('debug-write-crash-log',  () => null)
    ipcMain.handle('debug-crash-dir',        () => getDir())
    ipcMain.handle('debug-get-build-info',   () => ({
      version:  app.getVersion(),
      electron: process.versions.electron,
      node:     process.versions.node,
    }))
    ipcMain.handle('debug-get-perf-stats',      () => ({ cpu: 0, memory: process.memoryUsage() }))
    ipcMain.handle('get-performance-metrics',   () => ({ cpu: 0, memory: process.memoryUsage(), uptime: process.uptime() }))
    ipcMain.handle('get-system-info',           () => ({
      platform: process.platform,
      arch:     process.arch,
      node:     process.versions.node,
      electron: process.versions.electron,
      memory:   process.memoryUsage(),
    }))
    ipcMain.handle('show-notification', () => { /* stub — notification requires display */ })
  },
}

export default autosaveModule
