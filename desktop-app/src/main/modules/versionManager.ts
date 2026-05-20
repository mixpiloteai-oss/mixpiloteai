// Version backup/rollback manager.
// Backs up the current app.asar before each update is applied,
// allowing one-level rollback if the new version is broken.

import { app, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

const HISTORY_FILE = () => path.join(app.getPath('userData'), 'version-history.json')
const BACKUP_DIR   = () => path.join(app.getPath('userData'), 'backups')

interface VersionEntry {
  version:     string
  installedAt: number
  backupPath:  string | null   // path to backed-up asar, null if not available
}

interface HistoryData {
  current:  string
  entries:  VersionEntry[]  // most recent first, max 3
}

function loadHistory(): HistoryData {
  try {
    const raw = fs.readFileSync(HISTORY_FILE(), 'utf8')
    return JSON.parse(raw) as HistoryData
  } catch {
    return { current: app.getVersion(), entries: [] }
  }
}

function saveHistory(h: HistoryData): void {
  try {
    fs.writeFileSync(HISTORY_FILE(), JSON.stringify(h, null, 2), 'utf8')
  } catch { /* ignore */ }
}

// Called just before quitting to install an update.
// Backs up current asar to userData/backups/app-{version}.asar.
export function backupCurrentVersion(): void {
  const version   = app.getVersion()
  const asarPath  = app.getAppPath()   // e.g. /path/to/app.asar in packaged mode
  const backupDir = BACKUP_DIR()
  let backupPath: string | null = null

  if (app.isPackaged && fs.existsSync(asarPath)) {
    try {
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
      backupPath = path.join(backupDir, `app-${version}.asar`)
      fs.copyFileSync(asarPath, backupPath)
    } catch (e) {
      console.warn('[versionManager] backup failed:', (e as Error).message)
      backupPath = null
    }
  }

  const history = loadHistory()
  const entry: VersionEntry = { version, installedAt: Date.now(), backupPath }

  // Prepend current version, keep only last 3
  history.entries = [entry, ...history.entries.filter(e => e.version !== version)].slice(0, 3)
  history.current = version
  saveHistory(history)
}

// Returns true if a rollback target exists (previous asar backup on disk).
export function canRollback(): boolean {
  const history = loadHistory()
  const prev = history.entries.find(e => e.version !== history.current && e.backupPath !== null)
  if (!prev || !prev.backupPath) return false
  return fs.existsSync(prev.backupPath)
}

// Performs rollback: copies the backup asar over current, relaunches.
// Returns an error string if rollback isn't possible.
export function performRollback(): string | null {
  const history = loadHistory()
  const prev = history.entries.find(e => e.version !== history.current && e.backupPath !== null)
  if (!prev || !prev.backupPath) return 'No rollback target available'
  if (!fs.existsSync(prev.backupPath)) return `Backup not found: ${prev.backupPath}`
  if (!app.isPackaged) return 'Rollback only available in packaged builds'

  const asarPath = app.getAppPath()
  try {
    fs.copyFileSync(prev.backupPath, asarPath)
    // Update history to reflect rollback
    history.current = prev.version
    saveHistory(history)
    // Relaunch
    app.relaunch()
    app.exit(0)
    return null
  } catch (e) {
    return `Rollback failed: ${(e as Error).message}`
  }
}

export function getVersionHistory(): HistoryData {
  return loadHistory()
}

// IPC registration
export function registerVersionManagerIPC(): void {
  ipcMain.handle('version-can-rollback', () => canRollback())
  ipcMain.handle('version-history', () => getVersionHistory())
  ipcMain.handle('version-rollback', async () => {
    const confirmed = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Rollback Update',
      message: 'Roll back to the previous version?',
      detail: 'This will restore the previous version of Neurotek Studio and restart the app.',
      buttons: ['Rollback', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    if (confirmed !== 0) return { ok: false, reason: 'Cancelled' }
    const err = performRollback()
    if (err) return { ok: false, reason: err }
    return { ok: true }
  })
}
