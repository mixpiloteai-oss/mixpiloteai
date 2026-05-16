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

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startBackend();
  createWindow();
  createTray();
  registerShortcuts();

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
  globalShortcut.unregisterAll();
  if (backendProcess) backendProcess.kill();
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });
