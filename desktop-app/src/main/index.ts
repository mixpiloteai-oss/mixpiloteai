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

// ── IPC: Window controls ──────────────────────────────────────
ipcMain.handle('minimize-window',  () => mainWindow?.minimize())
ipcMain.handle('maximize-window',  () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize() })
ipcMain.handle('close-window',     () => mainWindow?.close())
ipcMain.handle('is-maximized',     () => mainWindow?.isMaximized() ?? false)
ipcMain.handle('set-always-on-top', (_e, flag: boolean) => mainWindow?.setAlwaysOnTop(flag))
ipcMain.handle('open-external',    (_e, url: string) => shell.openExternal(url))
ipcMain.handle('debug-open-devtools', () => mainWindow?.webContents.toggleDevTools())

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
app.whenReady().then(() => {
  electronApp.setAppUserModelId('ai.neurotek.studio')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  audioModule.register(ipcMain)
  vstModule.register(ipcMain)
  midiModule.register(ipcMain)
  storeModule.register(ipcMain)
  autosaveModule.register(ipcMain)
  updaterModule.register(ipcMain, mainWindow)

  // Native audio engine IPC + process management
  registerAudioIPCHandlers(ipcMain, () => mainWindow)
  getAudioEngineProcess().start().catch(e => console.warn('[main] audio engine start failed:', e))

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
