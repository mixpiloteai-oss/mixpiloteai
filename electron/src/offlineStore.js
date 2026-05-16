// ============================================================
// Offline Project Store — CommonJS module
// Uses electron-store for persistent local storage.
// Gracefully degrades if electron-store is unavailable.
// ============================================================

let Store;
try { Store = require('electron-store'); } catch (_) { Store = null; }

let store = null;

function getStore() {
  if (!store && Store) {
    try {
      store = new Store({
        name: 'mixpiloteai-offline',
        encryptionKey: 'nt-offline-key-v1',
        schema: {
          projects: { type: 'object', default: {} },
          settings: { type: 'object', default: {} },
        },
      });
    } catch (err) {
      console.error('[OfflineStore] Failed to initialise electron-store:', err.message);
      store = null;
    }
  }
  return store;
}

function saveOfflineProject(id, data) {
  try { getStore()?.set(`projects.${id}`, data); return true; } catch { return false; }
}

function loadOfflineProject(id) {
  try { return getStore()?.get(`projects.${id}`) ?? null; } catch { return null; }
}

function listOfflineProjects() {
  try { return Object.values(getStore()?.get('projects') ?? {}); } catch { return []; }
}

function deleteOfflineProject(id) {
  try { getStore()?.delete(`projects.${id}`); return true; } catch { return false; }
}

function saveSettings(key, value) {
  try { getStore()?.set(`settings.${key}`, value); return true; } catch { return false; }
}

function loadSettings(key) {
  try { return getStore()?.get(`settings.${key}`) ?? null; } catch { return null; }
}

module.exports = { saveOfflineProject, loadOfflineProject, listOfflineProjects, deleteOfflineProject, saveSettings, loadSettings };
