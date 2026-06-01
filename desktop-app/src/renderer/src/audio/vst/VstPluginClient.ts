import type {
  ScannedPlugin,
  ParameterValue,
  MidiEvent,
  PresetInfo,
  PluginCollection,
  SearchFilters,
  PluginWindowInfo,
  ScanProgress,
} from './vstTypes'

// ── VST Plugin Client ──────────────────────────────────────────────────────────
// IPC client wrapping window.electronAPI calls for the VST plugin system.

class VstPluginClient {
  private get api() {
    if (!window.electronAPI) throw new Error('electronAPI not available outside Electron')
    return window.electronAPI
  }

  // ── Core scan / list / search ──────────────────────────────────────────────

  async scanPlugins(): Promise<void> {
    await this.api.vstScan()
  }

  async listPlugins(): Promise<ScannedPlugin[]> {
    const result = await this.api.vstList()
    return result as ScannedPlugin[]
  }

  async searchPlugins(query: string): Promise<ScannedPlugin[]> {
    const result = await this.api.vstSearch(query)
    return result as ScannedPlugin[]
  }

  async searchAdvanced(query: string, filters: SearchFilters): Promise<ScannedPlugin[]> {
    const result = await this.api.vstSearchAdvanced(query, filters)
    return result as ScannedPlugin[]
  }

  // ── Instance lifecycle ────────────────────────────────────────────────────

  async loadInstance(pluginId: string): Promise<string> {
    const result = await this.api.vstLoadInstance(pluginId)
    return result as string
  }

  async unloadInstance(instanceId: string): Promise<void> {
    await this.api.vstUnloadInstance(instanceId)
  }

  // ── Parameters ────────────────────────────────────────────────────────────

  async setParameter(instanceId: string, paramIndex: number, value: number): Promise<void> {
    await this.api.vstSetParameter(instanceId, paramIndex, value)
  }

  async getParameter(instanceId: string, paramIndex: number): Promise<number> {
    const result = await this.api.vstGetParameter(instanceId, paramIndex)
    return result as number
  }

  async getAllParameters(instanceId: string): Promise<ParameterValue[]> {
    const result = await this.api.vstGetAllParameters(instanceId)
    return result as ParameterValue[]
  }

  // ── State ─────────────────────────────────────────────────────────────────

  async getState(instanceId: string): Promise<number[]> {
    const result = await this.api.vstGetState(instanceId)
    return result as number[]
  }

  async setState(instanceId: string, state: number[]): Promise<void> {
    await this.api.vstSetState(instanceId, state)
  }

  // ── MIDI / presets / bypass ───────────────────────────────────────────────

  async sendMidi(instanceId: string, event: MidiEvent): Promise<void> {
    await this.api.vstSendMidi(instanceId, event)
  }

  async getPresets(instanceId: string): Promise<PresetInfo[]> {
    const result = await this.api.vstGetPresets(instanceId)
    return result as PresetInfo[]
  }

  async loadPreset(instanceId: string, presetId: string): Promise<void> {
    await this.api.vstLoadPreset(instanceId, presetId)
  }

  async setBypass(instanceId: string, bypassed: boolean): Promise<void> {
    await this.api.vstBypass(instanceId, bypassed)
  }

  // ── Plugin windows ────────────────────────────────────────────────────────

  async openWindow(instanceId: string, pluginName: string): Promise<PluginWindowInfo> {
    const result = await this.api.vstOpenWindow(instanceId, pluginName)
    return result as PluginWindowInfo
  }

  async closeWindow(instanceId: string): Promise<void> {
    await this.api.vstCloseWindow(instanceId)
  }

  async resizeWindow(instanceId: string, w: number, h: number): Promise<void> {
    await this.api.vstResizeWindow(instanceId, w, h)
  }

  async pinWindow(instanceId: string, pinned: boolean): Promise<void> {
    await this.api.vstPinWindow(instanceId, pinned)
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  async addFavorite(pluginId: string): Promise<void> {
    await this.api.vstAddFavorite(pluginId)
  }

  async removeFavorite(pluginId: string): Promise<void> {
    await this.api.vstRemoveFavorite(pluginId)
  }

  async getFavorites(): Promise<ScannedPlugin[]> {
    const result = await this.api.vstGetFavorites()
    return result as ScannedPlugin[]
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  async addTag(pluginId: string, tag: string): Promise<void> {
    await this.api.vstAddTag(pluginId, tag)
  }

  async removeTag(pluginId: string, tag: string): Promise<void> {
    await this.api.vstRemoveTag(pluginId, tag)
  }

  async getAllTags(): Promise<string[]> {
    const result = await this.api.vstGetAllTags()
    return result as string[]
  }

  // ── Collections ───────────────────────────────────────────────────────────

  async createCollection(name: string): Promise<PluginCollection> {
    const result = await this.api.vstCreateCollection(name)
    return result as PluginCollection
  }

  async addToCollection(collId: string, pluginId: string): Promise<void> {
    await this.api.vstAddToCollection(collId, pluginId)
  }

  async removeFromCollection(collId: string, pluginId: string): Promise<void> {
    await this.api.vstRemoveFromCollection(collId, pluginId)
  }

  async getCollections(): Promise<PluginCollection[]> {
    const result = await this.api.vstGetCollections()
    return result as PluginCollection[]
  }

  // ── Scan progress listener ────────────────────────────────────────────────

  onScanProgress(cb: (p: ScanProgress) => void): () => void {
    return this.api.vstOnScanProgress(cb as (p: unknown) => void)
  }
}

export const vstClient = new VstPluginClient()
export type { VstPluginClient }
