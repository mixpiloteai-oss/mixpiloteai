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
  // ── Core scan / list / search ──────────────────────────────────────────────

  async scanPlugins(): Promise<void> {
    await window.electronAPI.vstScan()
  }

  async listPlugins(): Promise<ScannedPlugin[]> {
    const result = await window.electronAPI.vstList()
    return result as ScannedPlugin[]
  }

  async searchPlugins(query: string): Promise<ScannedPlugin[]> {
    const result = await window.electronAPI.vstSearch(query)
    return result as ScannedPlugin[]
  }

  async searchAdvanced(query: string, filters: SearchFilters): Promise<ScannedPlugin[]> {
    const result = await window.electronAPI.vstSearchAdvanced(query, filters)
    return result as ScannedPlugin[]
  }

  // ── Instance lifecycle ────────────────────────────────────────────────────

  async loadInstance(pluginId: string): Promise<string> {
    const result = await window.electronAPI.vstLoadInstance(pluginId)
    return result as string
  }

  async unloadInstance(instanceId: string): Promise<void> {
    await window.electronAPI.vstUnloadInstance(instanceId)
  }

  // ── Parameters ────────────────────────────────────────────────────────────

  async setParameter(instanceId: string, paramIndex: number, value: number): Promise<void> {
    await window.electronAPI.vstSetParameter(instanceId, paramIndex, value)
  }

  async getParameter(instanceId: string, paramIndex: number): Promise<number> {
    const result = await window.electronAPI.vstGetParameter(instanceId, paramIndex)
    return result as number
  }

  async getAllParameters(instanceId: string): Promise<ParameterValue[]> {
    const result = await window.electronAPI.vstGetAllParameters(instanceId)
    return result as ParameterValue[]
  }

  // ── State ─────────────────────────────────────────────────────────────────

  async getState(instanceId: string): Promise<number[]> {
    const result = await window.electronAPI.vstGetState(instanceId)
    return result as number[]
  }

  async setState(instanceId: string, state: number[]): Promise<void> {
    await window.electronAPI.vstSetState(instanceId, state)
  }

  // ── MIDI / presets / bypass ───────────────────────────────────────────────

  async sendMidi(instanceId: string, event: MidiEvent): Promise<void> {
    await window.electronAPI.vstSendMidi(instanceId, event)
  }

  async getPresets(instanceId: string): Promise<PresetInfo[]> {
    const result = await window.electronAPI.vstGetPresets(instanceId)
    return result as PresetInfo[]
  }

  async loadPreset(instanceId: string, presetId: string): Promise<void> {
    await window.electronAPI.vstLoadPreset(instanceId, presetId)
  }

  async setBypass(instanceId: string, bypassed: boolean): Promise<void> {
    await window.electronAPI.vstBypass(instanceId, bypassed)
  }

  // ── Plugin windows ────────────────────────────────────────────────────────

  async openWindow(instanceId: string, pluginName: string): Promise<PluginWindowInfo> {
    const result = await window.electronAPI.vstOpenWindow(instanceId, pluginName)
    return result as PluginWindowInfo
  }

  async closeWindow(instanceId: string): Promise<void> {
    await window.electronAPI.vstCloseWindow(instanceId)
  }

  async resizeWindow(instanceId: string, w: number, h: number): Promise<void> {
    await window.electronAPI.vstResizeWindow(instanceId, w, h)
  }

  async pinWindow(instanceId: string, pinned: boolean): Promise<void> {
    await window.electronAPI.vstPinWindow(instanceId, pinned)
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  async addFavorite(pluginId: string): Promise<void> {
    await window.electronAPI.vstAddFavorite(pluginId)
  }

  async removeFavorite(pluginId: string): Promise<void> {
    await window.electronAPI.vstRemoveFavorite(pluginId)
  }

  async getFavorites(): Promise<ScannedPlugin[]> {
    const result = await window.electronAPI.vstGetFavorites()
    return result as ScannedPlugin[]
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  async addTag(pluginId: string, tag: string): Promise<void> {
    await window.electronAPI.vstAddTag(pluginId, tag)
  }

  async removeTag(pluginId: string, tag: string): Promise<void> {
    await window.electronAPI.vstRemoveTag(pluginId, tag)
  }

  async getAllTags(): Promise<string[]> {
    const result = await window.electronAPI.vstGetAllTags()
    return result as string[]
  }

  // ── Collections ───────────────────────────────────────────────────────────

  async createCollection(name: string): Promise<PluginCollection> {
    const result = await window.electronAPI.vstCreateCollection(name)
    return result as PluginCollection
  }

  async addToCollection(collId: string, pluginId: string): Promise<void> {
    await window.electronAPI.vstAddToCollection(collId, pluginId)
  }

  async removeFromCollection(collId: string, pluginId: string): Promise<void> {
    await window.electronAPI.vstRemoveFromCollection(collId, pluginId)
  }

  async getCollections(): Promise<PluginCollection[]> {
    const result = await window.electronAPI.vstGetCollections()
    return result as PluginCollection[]
  }

  // ── Scan progress listener ────────────────────────────────────────────────

  onScanProgress(cb: (p: ScanProgress) => void): () => void {
    return window.electronAPI.vstOnScanProgress(cb)
  }
}

export const vstClient = new VstPluginClient()
export type { VstPluginClient }
