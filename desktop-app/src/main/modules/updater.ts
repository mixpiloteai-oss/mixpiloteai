import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { BrowserWindow, ipcMain, app, dialog } from 'electron'
import { backupCurrentVersion } from './versionManager'
import { markUpdatePending } from './startupGuard'
import { verifyFileIntegrity } from './updateIntegrity'

const log = {
  info: (msg: string, ...args: unknown[]) => console.info('[updater]', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn('[updater]', msg, ...args),
  error: (msg: string, ...args: unknown[]) => console.error('[updater]', msg, ...args),
}

// Configure autoUpdater
autoUpdater.autoDownload = false  // user confirms before downloading
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease = false
autoUpdater.disableWebInstaller = false

function emit(win: BrowserWindow | null, channel: string, payload?: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

const module = {
  register(ipcMainRef: typeof ipcMain, win: BrowserWindow | null): void {
    if (!app.isPackaged) {
      log.info('running in dev mode -- auto-updater disabled')
      ipcMainRef.handle('check-update', () => ({ dev: true }))
      ipcMainRef.handle('download-update', () => null)
      ipcMainRef.handle('install-update', () => null)
      ipcMainRef.handle('get-version', () => app.getVersion())
      return
    }

    // -- Event handlers ----------------------------------------------------
    autoUpdater.on('checking-for-update', () => {
      log.info('checking for update...')
      emit(win, 'update-checking')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('update available', info.version)
      emit(win, 'update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      })
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('up to date', info.version)
      emit(win, 'update-not-available', { version: info.version })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      emit(win, 'update-progress', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info('update downloaded', info.version)
      emit(win, 'update-downloaded', { version: info.version })
      emit(win, 'update-integrity-ready', { version: info.version })
      // Show native dialog as fallback if renderer can't respond
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `Neurotek Studio ${info.version} is ready to install.`,
        detail: 'Restart now to apply the update, or it will be installed the next time you quit.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall(false, true)
      }).catch(() => { /* ignored */ })
    })

    autoUpdater.on('error', (err: Error) => {
      log.error('update error', err.message)
      emit(win, 'update-error', { message: err.message })
    })

    // -- IPC handlers ------------------------------------------------------
    ipcMainRef.handle('check-update', async () => {
      try {
        return await autoUpdater.checkForUpdates()
      } catch (e) {
        log.warn('manual check failed', (e as Error).message)
        return null
      }
    })

    ipcMainRef.handle('download-update', async () => {
      try {
        await autoUpdater.downloadUpdate()
      } catch (e) {
        log.error('download failed', (e as Error).message)
        throw e
      }
    })

    ipcMainRef.handle('install-update', () => {
      backupCurrentVersion()
      markUpdatePending()
      autoUpdater.quitAndInstall(false, true)
    })

    ipcMainRef.handle('get-version', () => app.getVersion())

    ipcMainRef.handle('verify-update-file', (_event, filePath: string, sha256: string) => {
      return verifyFileIntegrity(filePath, sha256)
    })

    // -- Schedule auto-check (5s after startup) ----------------------------
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(e => {
        log.warn('auto-check failed', (e as Error).message)
      })
    }, 5_000)

    // -- Re-check every 6 hours -------------------------------------------
    const recheckInterval = setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => { /* silent */ })
    }, 6 * 60 * 60 * 1_000)
    if (recheckInterval.unref) recheckInterval.unref()
  }
}

export default module
