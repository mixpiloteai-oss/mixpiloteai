import { app, BrowserWindow, Menu, shell, ipcMain, dialog, powerMonitor } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import audioModule from './modules/audio'
import vstModule from './modules/vst'
import midiModule from './modules/midi'
import storeModule from './modules/store'
import autosaveModule from './modules/autosave'
import updaterModule from './modules/updater'
import { registerAudioIPCHandlers } from './audio/AudioIPCHandler'
import { getAudioEngineProcess }     from './audio/AudioEngineProcess'
import { getAudioEngineWatchdog }    from './audio/AudioEngineWatchdog'
import { registerPluginIPC }         from './modules/pluginIPC'
import { logCrash, registerCrashIPC } from './modules/errorReporter'
import { initStartupGuard } from './modules/startupGuard'
import { registerVersionManagerIPC, performRollback } from './modules/versionManager'
import { startProductionMonitor, stopProductionMonitor } from './modules/productionMonitor'
import { registerStabilityIPC } from './modules/stability'
import { initCrashRecovery } from './modules/crashRecovery'
import { registerAutoSaveIPC, AutoSaveManager } from './autosave'
import { registerCrashRecoveryIPC, CrashRecoveryManager } from './crashRecovery'
import { registerRecordingIPC } from './recording/RecordingIPC'
import { RecordingFileManager } from './recording/RecordingFileManager'
import { registerSamplesIPC } from './samples/SamplesIPC'
import { SampleDatabaseManager } from './samples/SampleDatabase'

// ── Global crash safety net ───────────────────────────────────────────────────
// Plugins run in forked child processes (see modules/pluginHost.ts), so most
// uncaught exceptions in main are bugs in our own code. Log them and continue
// running — never let a single bad require/throw take down the whole app.
process.on('uncaughtException', (err) => {
  try {
    console.error('[main] uncaughtException:', err)
    void logCrash({
      source:  'main',
      message: err?.message ?? String(err),
      stack:   err?.stack,
      meta:    { kind: 'uncaughtException' },
    })
  } catch (e) {
    console.error('[main] failed to log uncaughtException:', e)
  }
})

process.on('unhandledRejection', (reason) => {
  try {
    console.error('[main] unhandledRejection:', reason)
    const err = reason instanceof Error ? reason : null
    void logCrash({
      source:  'main',
      message: err?.message ?? (typeof reason === 'string' ? reason : 'unhandledRejection'),
      stack:   err?.stack,
      meta:    { kind: 'unhandledRejection' },
    })
  } catch (e) {
    console.error('[main] failed to log unhandledRejection:', e)
  }
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    frame: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Neurotek Studio',
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
    } : {}),
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    if (is.dev) mainWindow!.webContents.openDevTools()

    // Notify renderer if prior session crashed and a checkpoint exists
    const ci = autosaveModule.getCrashInfo()
    if (ci.hadCrash) {
      mainWindow!.webContents.send('crash-recovery-available', ci)
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  buildMenu()
}

function buildMenu(): void {
  const views = [
    { label: 'Dashboard',    accelerator: 'CmdOrCtrl+1', view: 'dashboard' },
    { label: 'Piano Roll',   accelerator: 'CmdOrCtrl+2', view: 'pianoroll' },
    { label: 'Arrangement',  accelerator: 'CmdOrCtrl+3', view: 'arrangement' },
    { label: 'Mixer',        accelerator: 'CmdOrCtrl+4', view: 'mixer' },
    { label: 'AI Assistant', accelerator: 'CmdOrCtrl+5', view: 'ai' },
    { label: 'Live Mode',    accelerator: 'CmdOrCtrl+6', view: 'live' },
    { label: 'VST Plugins',  accelerator: 'CmdOrCtrl+7', view: 'vst' },
    { label: 'Routing',      accelerator: 'CmdOrCtrl+8', view: 'routing' },
  ]

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project',  accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu-action', 'new-project') },
        { label: 'Open Project', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('trigger-load') },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('trigger-save') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: views.map(v => ({
        label: v.label,
        accelerator: v.accelerator,
        click: () => mainWindow?.webContents.send('nav', v.view),
      })),
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => shell.openExternal('https://github.com/mixpiloteai-oss/mixpiloteai/wiki') },
        { label: 'Report Bug',    click: () => shell.openExternal('https://github.com/mixpiloteai-oss/mixpiloteai/issues') },
        { type: 'separator' },
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.toggleDevTools() },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── IPC: Performance metrics ──────────────────────────────────
ipcMain.handle('perf:get-memory-metrics', () => {
  const m = process.memoryUsage()
  return {
    heapUsedMB:  m.heapUsed  / 1_048_576,
    heapTotalMB: m.heapTotal / 1_048_576,
    rssMB:       m.rss       / 1_048_576,
  }
})
ipcMain.handle('perf:get-cpu-metrics', () => {
  const c = process.cpuUsage()
  return { userMs: c.user / 1000, systemMs: c.system / 1000 }
})

// ── IPC: Window controls ──────────────────────────────────────
ipcMain.handle('minimize-window',  () => mainWindow?.minimize())
ipcMain.handle('maximize-window',  () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize() })
ipcMain.handle('close-window',     () => mainWindow?.close())
ipcMain.handle('is-maximized',     () => mainWindow?.isMaximized() ?? false)
ipcMain.handle('set-always-on-top', (_e, flag: boolean) => mainWindow?.setAlwaysOnTop(flag))
ipcMain.handle('open-external',    (_e, url: string) => shell.openExternal(url))
ipcMain.handle('debug-open-devtools', () => mainWindow?.webContents.toggleDevTools())

// ── IPC: Mixer detachable window ─────────────────────────────
let mixerWindow: BrowserWindow | null = null
ipcMain.handle('mixer:open-window', () => {
  if (mixerWindow && !mixerWindow.isDestroyed()) { mixerWindow.focus(); return }
  mixerWindow = new BrowserWindow({
    width: 900, height: 420, minWidth: 600, minHeight: 320,
    title: 'Mixer',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false },
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mixerWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#mixer`)
  } else {
    void mixerWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'mixer' })
  }
  mixerWindow.on('closed', () => { mixerWindow = null })
})
ipcMain.handle('mixer:close-window', () => {
  if (mixerWindow && !mixerWindow.isDestroyed()) mixerWindow.close()
  mixerWindow = null
})

// ── IPC: File system ─────────────────────────────────────────
ipcMain.handle('open-file-dialog', async (_e, opts) => {
  const result = await dialog.showOpenDialog(mainWindow!, opts)
  return result.canceled ? null : result.filePaths
})
ipcMain.handle('save-file-dialog', async (_e, opts) => {
  const result = await dialog.showSaveDialog(mainWindow!, opts)
  return result.canceled ? null : result.filePath
})

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(async () => {
  initStartupGuard(() => { performRollback() })
  await initCrashRecovery()

  electronApp.setAppUserModelId('ai.neurotek.studio')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  autosaveModule.init()  // detect crash before registering IPC handlers

  audioModule.register(ipcMain)
  vstModule.register(ipcMain)
  midiModule.register(ipcMain)
  storeModule.register(ipcMain)
  autosaveModule.register(ipcMain)
  updaterModule.register(ipcMain, mainWindow)

  // Plugin system: sandboxed host processes, blacklist, presets
  registerVersionManagerIPC()
  registerPluginIPC(ipcMain, () => mainWindow)

  // Persistent crash log (accessible from renderer via preload `crash` API)
  registerCrashIPC(ipcMain)

  // Stability monitoring and auto-recovery
  registerStabilityIPC(ipcMain, () => mainWindow)

  // Native audio engine IPC + process management + watchdog
  registerAudioIPCHandlers(ipcMain, () => mainWindow)
  getAudioEngineProcess().start().catch(e => console.warn('[main] audio engine start failed:', e))
  getAudioEngineWatchdog().start()  // begins health polling (5s interval, unref'd)

  startProductionMonitor()

  // Perf autosave + crash recovery (new perf: namespace)
  const autoSaveMgr = new AutoSaveManager()
  registerAutoSaveIPC(ipcMain, autoSaveMgr)
  const crashRecoveryMgr = new CrashRecoveryManager()
  registerCrashRecoveryIPC(ipcMain, crashRecoveryMgr)
  const recordingFileMgr = new RecordingFileManager()
  registerRecordingIPC(ipcMain, recordingFileMgr)
  void recordingFileMgr.recoverPartialRecordings().catch(e => console.warn('[main] recording recovery:', e))
  const sampleDb = new SampleDatabaseManager()
  registerSamplesIPC(ipcMain, sampleDb, () => mainWindow)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

powerMonitor.on('suspend', () => mainWindow?.webContents.send('power-event', 'suspend'))
powerMonitor.on('resume',  () => mainWindow?.webContents.send('power-event', 'resume'))

// ── Graceful shutdown ─────────────────────────────────────────────────────
app.on('before-quit', () => {
  console.log('[main] before-quit: cleaning up')
  stopProductionMonitor()
  getAudioEngineWatchdog().stop()
  getAudioEngineProcess().stop()
})

process.on('SIGINT', () => {
  console.log('[main] SIGINT received: shutting down gracefully')
  app.quit()
})

process.on('SIGTERM', () => {
  console.log('[main] SIGTERM received: shutting down gracefully')
  app.quit()
})
