import { IpcMain } from 'electron'
import { join } from 'path'
import { app } from 'electron'
import { existsSync, writeFileSync, readFileSync, readdirSync, mkdirSync } from 'fs'

const AUTOSAVE_DIR = () => join(app.getPath('userData'), 'autosave')
const MAX_VERSIONS = 10

const module = {
  register(ipcMain: IpcMain): void {
    ipcMain.handle('autosave-save-now', (_e, data) => {
      const dir = AUTOSAVE_DIR()
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      writeFileSync(join(dir, `autosave-${ts}.json`), JSON.stringify(data))
      // prune old versions
      const files = readdirSync(dir).filter(f => f.startsWith('autosave-')).sort()
      while (files.length > MAX_VERSIONS) {
        const oldest = files.shift()!
        require('fs').unlinkSync(join(dir, oldest))
      }
      return { savedAt: ts }
    })

    ipcMain.handle('autosave-load-latest', () => {
      const dir = AUTOSAVE_DIR()
      if (!existsSync(dir)) return null
      const files = readdirSync(dir).filter(f => f.startsWith('autosave-')).sort()
      if (!files.length) return null
      return JSON.parse(readFileSync(join(dir, files[files.length - 1]), 'utf8'))
    })

    ipcMain.handle('autosave-list-versions', () => {
      const dir = AUTOSAVE_DIR()
      if (!existsSync(dir)) return []
      return readdirSync(dir).filter(f => f.startsWith('autosave-')).sort().reverse()
    })

    ipcMain.handle('autosave-set-data',    () => null)
    ipcMain.handle('autosave-get-status',  () => ({ enabled: true, intervalMs: 60000 }))
    ipcMain.handle('crash-check',          () => false)
    ipcMain.handle('crash-clear-checkpoint', () => null)
    ipcMain.handle('debug-list-crash-logs', () => [])
    ipcMain.handle('debug-clear-crash-logs', () => null)
    ipcMain.handle('debug-write-crash-log', () => null)
    ipcMain.handle('debug-crash-dir', () => AUTOSAVE_DIR())
    ipcMain.handle('debug-get-build-info', () => ({ version: app.getVersion(), electron: process.versions.electron, node: process.versions.node }))
    ipcMain.handle('debug-get-perf-stats', () => ({ cpu: 0, memory: process.memoryUsage() }))
    ipcMain.handle('get-performance-metrics', () => ({ cpu: 0, memory: process.memoryUsage(), uptime: process.uptime() }))
    ipcMain.handle('get-system-info', () => ({
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
      electron: process.versions.electron,
      memory: process.memoryUsage(),
    }))
    ipcMain.handle('show-notification', (_e, _title: string, _body: string) => {
      // Notification stub — implement with electron.Notification when needed
    })
    ipcMain.handle('check-update', () => null)
  }
}

export default module
