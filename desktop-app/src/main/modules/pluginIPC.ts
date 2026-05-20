// ─── Plugin IPC ───────────────────────────────────────────────────────────────
// Registers all plugin-related IPC handlers and forwards crash events to the
// renderer window.

import { type IpcMain, type BrowserWindow } from 'electron'
import { scanAllPlugins }       from './pluginScanner'
import { pluginHostManager }    from './pluginHost'
import { getAll as getBlacklist, removeFromBlacklist } from './pluginBlacklist'
import { listPresets, savePreset, loadPreset, deletePreset, renamePreset } from './pluginPresets'
import { logCrash } from './errorReporter'
import { pluginHealthMonitor }  from './pluginHealth'
import { pluginRecovery }       from './pluginRecovery'
import { pluginScanCache }      from './pluginScanCache'

export function registerPluginIPC(
  ipcMain:   IpcMain,
  getWindow: () => BrowserWindow | null,
): void {

  // Initialize health monitoring and recovery
  pluginHealthMonitor.start()
  pluginRecovery.init()

  // Forward crash events to renderer + persist to crash log
  pluginHostManager.on('plugin-crash', (info: unknown) => {
    getWindow()?.webContents.send('plugin-crashed', info)
    try {
      const i = (info && typeof info === 'object') ? info as Record<string, unknown> : {}
      void logCrash({
        source:  'plugin',
        message: typeof i.pluginName === 'string'
          ? `Plugin crashed: ${i.pluginName}`
          : 'Plugin crashed',
        meta: i,
      })
    } catch {
      /* swallow */
    }
  })

  // Forward recovery events to renderer
  pluginRecovery.on('plugin-recovered', (info) => {
    getWindow()?.webContents.send('plugin-recovered', info)
  })
  pluginRecovery.on('plugin-recovery-abandoned', (info) => {
    getWindow()?.webContents.send('plugin-recovery-abandoned', info)
  })
  pluginRecovery.on('plugin-recovery-failed', (info) => {
    getWindow()?.webContents.send('plugin-recovery-failed', info)
  })

  // Forward health warnings
  pluginHealthMonitor.on('plugin-resource-warning', (info) => {
    getWindow()?.webContents.send('plugin-resource-warning', info)
  })

  // ── Scanner ──────────────────────────────────────────────────────────────

  ipcMain.handle('plugin-scan', async () => {
    await pluginScanCache.load()
    const plugins = scanAllPlugins()
    // Update cache with scanned plugins
    for (const plugin of plugins) {
      void pluginScanCache.store(plugin).catch(() => { /* ignore */ })
    }
    await pluginScanCache.save()
    return plugins
  })

  ipcMain.handle('plugin-scan-clear-cache', async () => {
    await pluginScanCache.clear()
    return { ok: true }
  })

  ipcMain.handle('plugin-scan-cleanup-cache', async () => {
    const removed = await pluginScanCache.cleanup()
    return { ok: true, removed }
  })

  ipcMain.handle('plugin-scan-cache-stats', () => {
    return pluginScanCache.getStats()
  })

  // ── Host (load / unload / instances) ─────────────────────────────────────

  ipcMain.handle('plugin-load', async (_e, pluginPath: string, format: string) => {
    const instance = await pluginHostManager.load(pluginPath, format)
    // Register with health monitor
    // @ts-expect-error access proc from manager
    const proc = pluginHostManager['procs'].get(instance.instanceId)?.proc
    if (proc) {
      pluginHealthMonitor.register(instance.instanceId, pluginPath, instance.name, proc)
    }
    // Initialize empty state for recovery
    pluginRecovery.saveState(instance.instanceId, {
      instanceId: instance.instanceId,
      pluginPath,
      format,
      parameters: {},
    })
    return instance
  })

  ipcMain.handle('plugin-unload', async (_e, instanceId: string) => {
    pluginHealthMonitor.unregister(instanceId)
    pluginRecovery.clearState(instanceId)
    await pluginHostManager.unload(instanceId)
    return { ok: true }
  })

  ipcMain.handle('plugin-get-instances', () => {
    return pluginHostManager.getAllInstances()
  })

  // ── Health monitoring ────────────────────────────────────────────────────

  ipcMain.handle('plugin-get-health', () => {
    return pluginHealthMonitor.getMetrics()
  })

  ipcMain.handle('plugin-get-instance-health', (_e, instanceId: string) => {
    return pluginHealthMonitor.getInstanceMetrics(instanceId)
  })

  // ── Recovery / hot reload ────────────────────────────────────────────────

  ipcMain.handle('plugin-hot-reload', async (_e, instanceId: string) => {
    return pluginRecovery.hotReload(instanceId)
  })

  ipcMain.handle('plugin-save-state', (_e, instanceId: string, pluginPath: string, format: string, parameters: Record<string, number>, trackId?: string) => {
    pluginRecovery.saveState(instanceId, { instanceId, pluginPath, format, parameters, trackId })
    return { ok: true }
  })

  ipcMain.handle('plugin-get-recovered-id', (_e, oldInstanceId: string) => {
    return pluginRecovery.getRecoveredId(oldInstanceId)
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
