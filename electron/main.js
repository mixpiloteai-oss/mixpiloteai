// ============================================================
// NEUROTEK AI — Electron Main Process (Full-Featured)
// ============================================================
'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain,
  Tray,
  nativeTheme,
  globalShortcut,
  dialog,
  nativeImage,
  powerMonitor,
  systemPreferences,
} = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// ─── Desktop modules ─────────────────────────────────────────────────────────
const autosave      = require('./src/autosaveManager');
const audioDevices  = require('./src/audioDeviceManager');
const settings      = require('./src/desktopSettings');
const audioCache    = require('./src/audioCacheManager');
const crashLogger   = require('./src/crashLogger');
const perfMonitor   = require('./src/performanceMonitor');
const buildInfo     = require('./src/buildInfo');

// ─── Dev / Prod detection ────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development';

const FRONTEND_URL = isDev
  ? 'http://localhost:3000'
  : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;

// ─── State ───────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let backendProcess = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

// ─── createWindow ────────────────────────────────────────────────────────────
function createWindow() {
  const windowOptions = {
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
    },
    title: 'NEUROTEK AI',
    show: false,
  };

  if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.trafficLightPosition = { x: 16, y: 16 };
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.loadURL(FRONTEND_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  buildMenu();
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
function buildMenu() {
  const viewNavItems = [
    { label: 'Dashboard',       accelerator: 'CmdOrCtrl+1', view: 'dashboard' },
    { label: 'Templates',       accelerator: 'CmdOrCtrl+2', view: 'templates' },
    { label: 'Track Organizer', accelerator: 'CmdOrCtrl+3', view: 'tracks' },
    { label: 'Mix Assistant',   accelerator: 'CmdOrCtrl+4', view: 'mix' },
    { label: 'Live Mode',       accelerator: 'CmdOrCtrl+5', view: 'live' },
    { label: 'AI Chat',         accelerator: 'CmdOrCtrl+6', view: 'chat' },
    { label: 'Packs',           accelerator: 'CmdOrCtrl+7', view: 'packs' },
    { label: 'DAW Bridge',      accelerator: 'CmdOrCtrl+8', view: 'daw' },
  ];

  const template = [
    {
      label: 'NEUROTEK AI',
      submenu: [
        { label: 'About NEUROTEK AI', role: 'about' },
        { type: 'separator' },
        { label: 'Preferences', accelerator: 'CmdOrCtrl+,', click: () => sendToRenderer('open-settings') },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        ...viewNavItems.map((item) => ({
          label: item.label,
          accelerator: item.accelerator,
          click: () => sendToRenderer('nav', item.view),
        })),
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Project',
      submenu: [
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => sendToRenderer('trigger-save') },
        { label: 'Open Project', accelerator: 'CmdOrCtrl+O', click: () => sendToRenderer('trigger-load') },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => shell.openExternal('https://mixpiloteai.vercel.app/docs') },
        { label: 'Report Issue',  click: () => shell.openExternal('https://mixpiloteai.vercel.app/support') },
        { type: 'separator' },
        { label: 'Check for Updates', click: () => sendToRenderer('check-update-request') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const trayImage = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(trayImage);
  tray.setToolTip('NEUROTEK AI');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Hide', click: () => {
        if (!mainWindow) return createWindow();
        mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

// ─── Global Shortcuts ─────────────────────────────────────────────────────────
function registerShortcuts() {
  globalShortcut.register('CmdOrCtrl+Shift+M', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
  });
  globalShortcut.register('CmdOrCtrl+Shift+L', () => {
    if (!mainWindow) createWindow(); else { mainWindow.show(); mainWindow.focus(); }
    sendToRenderer('nav', 'live');
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('get-system-info', async () => ({
  platform: process.platform, arch: process.arch,
  cpus: os.cpus().length, totalMemory: os.totalmem(),
  freeMemory: os.freemem(), hostname: os.hostname(),
}));

ipcMain.handle('get-midi-devices', async () => {
  try { return require('./src/midiManager').getMidiDevices(); }
  catch (err) { console.error('[MIDI]', err.message); return { inputs: [], outputs: [], total: 0 }; }
});

ipcMain.handle('scan-vst-plugins', async () => {
  try { return require('./src/vstScanner').scanVSTPlugins(); }
  catch (err) { console.error('[VST]', err.message); return []; }
});

ipcMain.handle('save-project', async (_event, data) => {
  if (!mainWindow) return null;
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project',
    defaultPath: path.join(os.homedir(), 'untitled.ntai'),
    filters: [{ name: 'NEUROTEK AI Project', extensions: ['ntai', 'json'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
});

ipcMain.handle('load-project', async () => {
  if (!mainWindow) return null;
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    filters: [{ name: 'NEUROTEK AI Project', extensions: ['ntai', 'json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.length) return null;
  const raw = fs.readFileSync(filePaths[0], 'utf-8');
  try { return JSON.parse(raw); } catch (_) { return raw; }
});

ipcMain.handle('check-update', async () => {
  const pkg = require('./package.json');
  return { hasUpdate: false, version: pkg.version };
});

ipcMain.handle('open-external', async (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) await shell.openExternal(url);
});

ipcMain.handle('minimize-window',   () => mainWindow?.minimize());
ipcMain.handle('maximize-window',   () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle('close-window',      () => mainWindow?.close());
ipcMain.handle('set-always-on-top', (_e, flag) => mainWindow?.setAlwaysOnTop(Boolean(flag)));

// ─── Offline store IPC ───────────────────────────────────────────────────────
ipcMain.handle('offline-save',   (_e, id, data) => require('./src/offlineStore').saveOfflineProject(id, data));
ipcMain.handle('offline-load',   (_e, id)       => require('./src/offlineStore').loadOfflineProject(id));
ipcMain.handle('offline-list',   ()             => require('./src/offlineStore').listOfflineProjects());
ipcMain.handle('offline-delete', (_e, id)       => require('./src/offlineStore').deleteOfflineProject(id));
ipcMain.handle('save-setting',   (_e, key, val) => require('./src/offlineStore').saveSettings(key, val));
ipcMain.handle('load-setting',   (_e, key)      => require('./src/offlineStore').loadSettings(key));

// ─── Autosave IPC ─────────────────────────────────────────────────────────────
ipcMain.handle('autosave-set-data',       (_e, data) => { autosave.setPendingData(data); return true; });
ipcMain.handle('autosave-save-now',       (_e, data) => { autosave.saveVersioned(data); autosave.writeCheckpoint(data); return true; });
ipcMain.handle('autosave-load-latest',    ()         => autosave.loadLatestAutosave());
ipcMain.handle('autosave-list-versions',  ()         => autosave.listAutosaveVersions());
ipcMain.handle('autosave-get-status',     ()         => autosave.getStatus());
ipcMain.handle('crash-check',             ()         => ({ wasCrash: autosave.wasCrash(), checkpoint: autosave.readCheckpoint() }));
ipcMain.handle('crash-clear-checkpoint',  ()         => { autosave.clearCheckpoint(); return true; });

// ─── Audio device IPC ────────────────────────────────────────────────────────
ipcMain.handle('get-audio-devices',    () => audioDevices.getAudioDevices());
ipcMain.handle('get-latency-profiles', () => audioDevices.getLatencyProfiles());

// ─── Desktop settings IPC ────────────────────────────────────────────────────
ipcMain.handle('settings-get',    (_e, key)      => settings.get(key));
ipcMain.handle('settings-set',    (_e, key, val) => settings.set(key, val));
ipcMain.handle('settings-get-all',()             => settings.getAll());
ipcMain.handle('settings-reset',  (_e, key)      => settings.reset(key));

// ─── Audio cache IPC ─────────────────────────────────────────────────────────────
ipcMain.handle('audio-cache-is-cached',    (_e, url)           => audioCache.isCached(url));
ipcMain.handle('audio-cache-get-path',     (_e, url)           => audioCache.getCachedPath(url));
ipcMain.handle('audio-cache-fetch',        async (_e, url)     => audioCache.fetchAndCache(url));
ipcMain.handle('audio-cache-store',        (_e, url, filePath) => audioCache.storeInCache(url, filePath));
ipcMain.handle('audio-cache-evict',        (_e, url)           => audioCache.evict(url));
ipcMain.handle('audio-cache-stats',        ()                  => audioCache.getStats());
ipcMain.handle('audio-cache-list',         ()                  => audioCache.listEntries());
ipcMain.handle('audio-cache-prune',        ()                  => audioCache.prune());
ipcMain.handle('audio-cache-clear',        ()                  => audioCache.clearAll());

// ─── Diagnostics / Debug IPC ──────────────────────────────────────────────────
ipcMain.handle('debug-get-build-info',   () => buildInfo.getBuildInfo());
ipcMain.handle('debug-get-perf-stats',   () => perfMonitor.getStats());
ipcMain.handle('debug-list-crash-logs',  () => crashLogger.listCrashLogs());
ipcMain.handle('debug-clear-crash-logs', () => crashLogger.clearCrashLogs());
ipcMain.handle('debug-write-crash-log',  (_e, type, msg, ctx) => crashLogger.writeCrashLog(type, msg, ctx ?? {}));
ipcMain.handle('debug-crash-dir',        () => crashLogger.getCrashDir());

ipcMain.handle('debug-open-devtools', () => {
  mainWindow?.webContents.openDevTools({ mode: 'detach' });
});

ipcMain.handle('debug-get-app-paths', () => ({
  userData:  app.getPath('userData'),
  logs:      app.getPath('logs'),
  temp:      app.getPath('temp'),
  downloads: app.getPath('downloads'),
  appPath:   app.getAppPath(),
  crashDir:  crashLogger.getCrashDir(),
}));

// ─── Backend process (dev only) ───────────────────────────────────────────────
function startBackend() {
  if (!isDev) return;
  const backendPath = path.join(__dirname, '../backend');
  if (!fs.existsSync(backendPath)) return;
  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: backendPath, shell: true, stdio: 'inherit', env: { ...process.env },
  });
  backendProcess.on('error', (err) => console.error('[Backend]', err.message));
}

// ─── Unhandled error logging ──────────────────────────────────────────────────
process.on('uncaughtException',  (err) => { console.error('[Main] Uncaught:', err); crashLogger.writeCrashLog('uncaught-exception', err); });
process.on('unhandledRejection', (err) => { console.error('[Main] Rejection:', err); crashLogger.writeCrashLog('unhandled-rejection', err); });

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const hadCrash = autosave.wasCrash();
  const crashCheckpoint = hadCrash ? autosave.readCheckpoint() : null;

  startBackend();
  createWindow();
  createTray();
  registerShortcuts();

  const autosaveInterval = settings.get('autosaveIntervalMs') ?? 30000;
  mainWindow.once('ready-to-show', () => {
    autosave.start(mainWindow, autosaveInterval);
    perfMonitor.start(sendToRenderer, 3000);
    if (hadCrash && crashCheckpoint) {
      setTimeout(() => sendToRenderer('crash-recovery-available', {
        hasData: true,
        timestamp: Date.now(),
      }), 2000);
    }
  });

  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) settings.set('windowBounds', mainWindow.getBounds());
  });
  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) settings.set('windowBounds', mainWindow.getBounds());
  });

  powerMonitor.on('suspend',    () => sendToRenderer('power-event', 'suspend'));
  powerMonitor.on('resume',     () => sendToRenderer('power-event', 'resume'));
  powerMonitor.on('on-ac',      () => sendToRenderer('power-event', 'on-ac'));
  powerMonitor.on('on-battery', () => sendToRenderer('power-event', 'on-battery'));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});

app.on('before-quit', () => {
  autosave.stop();
  perfMonitor.stop();
  globalShortcut.unregisterAll();
  if (backendProcess) backendProcess.kill();
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });
