// ============================================================
// NEUROTEK AI — Electron Main Process
// ============================================================
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';
const FRONTEND_URL = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;

let mainWindow = null;
let backendProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev,
    },
    icon: path.join(__dirname, '../frontend/public/icon.svg'),
    title: 'NEUROTEK AI',
  });

  mainWindow.loadURL(FRONTEND_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Custom menu
  const template = [
    {
      label: 'NEUROTEK AI',
      submenu: [
        { label: 'About NEUROTEK AI', role: 'about' },
        { type: 'separator' },
        { label: 'Preferences', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('open-settings') },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send('nav', 'dashboard') },
        { label: 'Templates', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send('nav', 'templates') },
        { label: 'Track Organizer', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.send('nav', 'tracks') },
        { label: 'Mix Assistant', accelerator: 'CmdOrCtrl+4', click: () => mainWindow?.webContents.send('nav', 'mix') },
        { label: 'Live Mode', accelerator: 'CmdOrCtrl+5', click: () => mainWindow?.webContents.send('nav', 'live') },
        { label: 'AI Chat', accelerator: 'CmdOrCtrl+6', click: () => mainWindow?.webContents.send('nav', 'chat') },
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startBackend() {
  if (!isDev) return; // In production, backend would be bundled
  const backendPath = path.join(__dirname, '../backend');
  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: backendPath,
    shell: true,
    stdio: 'inherit',
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
