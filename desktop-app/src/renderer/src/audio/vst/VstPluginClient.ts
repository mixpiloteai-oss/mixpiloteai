import type { ScannedPlugin, ParameterValue, MidiEvent, PresetInfo } from './vstTypes'

// ── VST Plugin Client ──────────────────────────────────────────────────────────
// IPC client wrapping window.electronAPI calls for the VST plugin system.

class VstPluginClient {
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

  async loadInstance(pluginId: string): Promise<string> {
    const result = await window.electronAPI.vstLoadInstance(pluginId)
    return result as string
  }

  async unloadInstance(instanceId: string): Promise<void> {
    await window.electronAPI.vstUnloadInstance(instanceId)
  }

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

  async getState(instanceId: string): Promise<number[]> {
    const result = await window.electronAPI.vstGetState(instanceId)
    return result as number[]
  }

  async setState(instanceId: string, state: number[]): Promise<void> {
    await window.electronAPI.vstSetState(instanceId, state)
  }

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
}

export const vstClient = new VstPluginClient()
export type { VstPluginClient }
