// ─── Plugin IPC ───────────────────────────────────────────────────────────────
// Registers all plugin-related IPC handlers and forwards crash events to the
// renderer window.

import { type IpcMain, type BrowserWindow } from 'electron'
import { scanAllPlugins }       from './pluginScanner'
import { pluginHostManager }    from './pluginHost'
import { getAll as getBlacklist, removeFromBlacklist } from './pluginBlacklist'
import { listPresets, savePreset, loadPreset, deletePreset, renamePreset } from './pluginPresets'

export function registerPluginIPC(
  ipcMain:   IpcMain,
  getWindow: () => BrowserWindow | null,
): void {

  // Forward crash events to renderer
  pluginHostManager.on('plugin-crash', (info: unknown) => {
    getWindow()?.webContents.send('plugin-crashed', info)
  })

  // ── Scanner ──────────────────────────────────────────────────────────────

  ipcMain.handle('plugin-scan', async () => {
    return scanAllPlugins()
  })

  // ── Host (load / unload / instances) ─────────────────────────────────────

  ipcMain.handle('plugin-load', async (_e, pluginPath: string, format: string) => {
    const instance = await pluginHostManager.load(pluginPath, format)
    return instance
  })

  ipcMain.handle('plugin-unload', async (_e, instanceId: string) => {
    await pluginHostManager.unload(instanceId)
    return { ok: true }
  })

  ipcMain.handle('plugin-get-instances', () => {
    return pluginHostManager.getAllInstances()
  })

  // ── Blacklist ─────────────────────────────────────────────────────────────

  ipcMain.handle('plugin-get-blacklist', () => {
    return getBlacklist()
  })

  ipcMain.handle('plugin-remove-from-blacklist', (_e, path: string) => {
    removeFromBlacklist(path)
    return { ok: true }
  })

  // ── Presets ───────────────────────────────────────────────────────────────

  ipcMain.handle('plugin-list-presets', (_e, pluginId: string) => {
    return listPresets(pluginId)
  })

  ipcMain.handle('plugin-save-preset', (_e, pluginId: string, name: string, data: Record<string, number>) => {
    return savePreset(pluginId, name, data)
  })

  ipcMain.handle('plugin-load-preset', (_e, pluginId: string, presetId: string) => {
    return loadPreset(pluginId, presetId)
  })

  ipcMain.handle('plugin-delete-preset', (_e, pluginId: string, presetId: string) => {
    deletePreset(pluginId, presetId)
    return { ok: true }
  })

  ipcMain.handle('plugin-rename-preset', (_e, pluginId: string, presetId: string, newName: string) => {
    return renamePreset(pluginId, presetId, newName)
  })
}
