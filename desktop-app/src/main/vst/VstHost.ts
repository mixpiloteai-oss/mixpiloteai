import type { IpcMain, WebContents } from 'electron'
import { VstDatabase, type ScannedPlugin, type PluginCategory, type SearchFilters } from './VstDatabase'
import { VstCrashGuard } from './VstCrashGuard'
import { VstSandboxManager, type MidiEventData } from './VstSandbox'
import { VstScanner } from './VstScanner'
import { VstWindowManager } from './VstWindowManager'

export interface PluginInstance {
  instanceId: string
  pluginId: string
  bypassed: boolean
  parameters: Map<number, number>
  state: number[] | null
}

export class VstHost {
  private database: VstDatabase
  private crashGuard: VstCrashGuard
  private sandboxManager: VstSandboxManager
  private scanner: VstScanner
  private windowManager: VstWindowManager
  private instances: Map<string, PluginInstance> = new Map()
  private webContents: WebContents | null = null

  constructor() {
    this.database = new VstDatabase()
    this.crashGuard = new VstCrashGuard()
    this.sandboxManager = new VstSandboxManager()
    this.scanner = new VstScanner()
    this.windowManager = new VstWindowManager()
  }

  /** Provide the renderer WebContents for pushing scan progress events */
  setWebContents(wc: WebContents): void {
    this.webContents = wc
  }

  registerIpcHandlers(ipcMain: IpcMain): void {
    // ── Core scan / list / search ──────────────────────────────────────────

    ipcMain.handle('vst:scan', async () => {
      return await this.triggerScan()
    })

    ipcMain.handle('vst:list', () => {
      return this.database.getAllPlugins()
    })

    ipcMain.handle('vst:search', (_e, query: string) => {
      return this.database.search(query)
    })

    ipcMain.handle('vst:search-advanced', (_e, query: string, filters: SearchFilters) => {
      return this.database.searchAdvanced(query, filters ?? {})
    })

    // ── Instance lifecycle ────────────────────────────────────────────────

    ipcMain.handle('vst:load-instance', async (_e, pluginId: string) => {
      return await this.loadInstance(pluginId)
    })

    ipcMain.handle('vst:unload-instance', async (_e, instanceId: string) => {
      return await this.unloadInstance(instanceId)
    })

    // ── Parameters ───────────────────────────────────────────────────────

    ipcMain.handle('vst:set-parameter', (_e, instanceId: string, paramIndex: number, value: number) => {
      return this.setParameter(instanceId, paramIndex, value)
    })

    ipcMain.handle('vst:get-parameter', (_e, instanceId: string, paramIndex: number) => {
      return this.getParameter(instanceId, paramIndex)
    })

    ipcMain.handle('vst:get-all-parameters', (_e, instanceId: string) => {
      return this.getAllParameters(instanceId)
    })

    // ── State ────────────────────────────────────────────────────────────

    ipcMain.handle('vst:get-state', (_e, instanceId: string) => {
      return this.getState(instanceId)
    })

    ipcMain.handle('vst:set-state', (_e, instanceId: string, state: number[]) => {
      return this.setState(instanceId, state)
    })

    // ── MIDI / presets / bypass ───────────────────────────────────────────

    ipcMain.handle('vst:send-midi', (_e, instanceId: string, event: MidiEventData) => {
      return this.sendMidi(instanceId, event)
    })

    ipcMain.handle('vst:get-presets', (_e, instanceId: string) => {
      return this.getPresets(instanceId)
    })

    ipcMain.handle('vst:load-preset', (_e, instanceId: string, presetId: string) => {
      return this.loadPreset(instanceId, presetId)
    })

    ipcMain.handle('vst:bypass', (_e, instanceId: string, bypassed: boolean) => {
      return this.setBypass(instanceId, bypassed)
    })

    // ── Plugin windows ────────────────────────────────────────────────────

    ipcMain.handle('vst:open-window', async (_e, instanceId: string, pluginName: string) => {
      return await this.windowManager.openPluginWindow(instanceId, pluginName)
    })

    ipcMain.handle('vst:close-window', (_e, instanceId: string) => {
      this.windowManager.closePluginWindow(instanceId)
    })

    ipcMain.handle('vst:resize-window', (_e, instanceId: string, w: number, h: number) => {
      this.windowManager.resizePluginWindow(instanceId, w, h)
    })

    ipcMain.handle('vst:pin-window', (_e, instanceId: string, pinned: boolean) => {
      this.windowManager.pinPluginWindow(instanceId, pinned)
    })

    // ── Favorites ─────────────────────────────────────────────────────────

    ipcMain.handle('vst:favorites', (_e, action: string, pluginId: string) => {
      if (action === 'add') {
        this.database.addFavorite(pluginId)
        void this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
        return { ok: true }
      } else if (action === 'remove') {
        this.database.removeFavorite(pluginId)
        void this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
        return { ok: true }
      } else if (action === 'list') {
        return this.database.getFavorites()
      } else if (action === 'check') {
        return { isFavorite: this.database.isFavorite(pluginId) }
      }
      return { ok: false, error: `Unknown favorites action: ${action}` }
    })

    // ── Tags ──────────────────────────────────────────────────────────────

    ipcMain.handle('vst:tags', (_e, action: string, pluginId: string, tag?: string) => {
      if (action === 'add' && tag) {
        this.database.addTag(pluginId, tag)
        void this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
        return { ok: true }
      } else if (action === 'remove' && tag) {
        this.database.removeTag(pluginId, tag)
        void this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
        return { ok: true }
      } else if (action === 'get') {
        return this.database.getTags(pluginId)
      } else if (action === 'all') {
        return this.database.getAllTags()
      }
      return { ok: false, error: `Unknown tags action: ${action}` }
    })

    // ── Blacklist ─────────────────────────────────────────────────────────

    ipcMain.handle('vst:blacklist', (_e, pluginId: string, reason?: string) => {
      this.database.markFailed(pluginId, reason ?? 'Manually blacklisted')
      this.crashGuard.recordCrash(pluginId)
      void this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
      return { ok: true }
    })

    // ── Collections ───────────────────────────────────────────────────────

    ipcMain.handle('vst:collections', async (_e, action: string, ...args: unknown[]) => {
      if (action === 'list') {
        return this.database.getAllCollections()
      } else if (action === 'create') {
        const name = args[0] as string
        const coll = this.database.createCollection(name)
        await this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
        return coll
      } else if (action === 'add') {
        const collId = args[0] as string
        const pluginId = args[1] as string
        this.database.addToCollection(collId, pluginId)
        await this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
        return { ok: true }
      } else if (action === 'remove') {
        const collId = args[0] as string
        const pluginId = args[1] as string
        this.database.removeFromCollection(collId, pluginId)
        await this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
        return { ok: true }
      } else if (action === 'delete') {
        const collId = args[0] as string
        this.database.deleteCollection(collId)
        await this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
        return { ok: true }
      }
      return { ok: false, error: `Unknown collections action: ${action}` }
    })
  }

  private async triggerScan(): Promise<ScannedPlugin[]> {
    const paths = this.scanner.getPlatformVstPaths()
    const found = await this.scanner.scanDirectories(paths)

    // Report progress as we go
    for (let i = 0; i < found.length; i++) {
      const plugin = found[i]
      this.database.addPlugin(plugin)

      if (this.webContents && !this.webContents.isDestroyed()) {
        this.webContents.send('vst:scan-progress', {
          scanned: i + 1,
          total: found.length,
          currentPlugin: plugin.name,
        })
      }
    }

    await this.database.save().catch(e => console.warn('[VstHost] save failed:', e))
    return found
  }

  private async loadInstance(pluginId: string): Promise<string> {
    const plugin = this.database.getPlugin(pluginId)
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`)

    if (this.crashGuard.isBlacklisted(pluginId)) {
      throw new Error(`Plugin is blacklisted due to repeated crashes: ${pluginId}`)
    }

    const instanceId = `${pluginId}_${Date.now()}`

    // NATIVE-ADDON: real VST3 loading happens here via native Node.js addon
    this.sandboxManager.createProcess(pluginId, instanceId)

    const instance: PluginInstance = {
      instanceId,
      pluginId,
      bypassed: false,
      parameters: new Map(),
      state: null,
    }
    this.instances.set(instanceId, instance)

    return instanceId
  }

  private async unloadInstance(instanceId: string): Promise<void> {
    this.sandboxManager.terminateProcess(instanceId)
    this.windowManager.closePluginWindow(instanceId)
    this.instances.delete(instanceId)
  }

  private setParameter(instanceId: string, paramIndex: number, value: number): void {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new Error(`Instance not found: ${instanceId}`)
    // NATIVE-ADDON: real VST3 setParameter happens here via native Node.js addon
    instance.parameters.set(paramIndex, value)
  }

  private getParameter(instanceId: string, paramIndex: number): number {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new Error(`Instance not found: ${instanceId}`)
    // NATIVE-ADDON: real VST3 getParameter happens here via native Node.js addon
    return instance.parameters.get(paramIndex) ?? 0.5
  }

  private getAllParameters(instanceId: string): Array<{ index: number; value: number }> {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new Error(`Instance not found: ${instanceId}`)
    // NATIVE-ADDON: real VST3 getAllParameters happens here via native Node.js addon
    return Array.from(instance.parameters.entries()).map(([index, value]) => ({ index, value }))
  }

  private getState(instanceId: string): number[] {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new Error(`Instance not found: ${instanceId}`)
    // NATIVE-ADDON: real VST3 getState (IComponent::getState) happens here via native Node.js addon
    return instance.state ?? []
  }

  private setState(instanceId: string, state: number[]): void {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new Error(`Instance not found: ${instanceId}`)
    // NATIVE-ADDON: real VST3 setState (IComponent::setState) happens here via native Node.js addon
    instance.state = state
  }

  private sendMidi(instanceId: string, _event: MidiEventData): void {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new Error(`Instance not found: ${instanceId}`)
    // NATIVE-ADDON: real MIDI event routing to VST3 IMidiMapping happens here via native Node.js addon
  }

  private getPresets(_instanceId: string): Array<{ id: string; name: string; category: string }> {
    // NATIVE-ADDON: real VST3 preset enumeration via IUnitInfo happens here via native Node.js addon
    return []
  }

  private loadPreset(instanceId: string, _presetId: string): void {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new Error(`Instance not found: ${instanceId}`)
    // NATIVE-ADDON: real VST3 preset loading happens here via native Node.js addon
  }

  private setBypass(instanceId: string, bypassed: boolean): void {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new Error(`Instance not found: ${instanceId}`)
    instance.bypassed = bypassed
  }

  getDatabase(): VstDatabase {
    return this.database
  }

  getCrashGuard(): VstCrashGuard {
    return this.crashGuard
  }

  getSandboxManager(): VstSandboxManager {
    return this.sandboxManager
  }

  getWindowManager(): VstWindowManager {
    return this.windowManager
  }

  // Expose for testing/introspection
  getInstances(): Map<string, PluginInstance> {
    return this.instances
  }
}

// Unused import suppression — PluginCategory used by external callers
export type { PluginCategory, ScannedPlugin }

export const vstHost = new VstHost()
