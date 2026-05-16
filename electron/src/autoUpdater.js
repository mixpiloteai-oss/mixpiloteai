// ============================================================
// Auto-Updater stub — wire to electron-updater in production
// ============================================================

async function checkForUpdates(mainWindow) {
  let currentVersion = '1.0.0';
  try { currentVersion = require('../package.json').version; } catch (_) {}

  const updateInfo = { hasUpdate: false, version: currentVersion };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-info', updateInfo);
  }
  return updateInfo;
}

module.exports = { checkForUpdates };
