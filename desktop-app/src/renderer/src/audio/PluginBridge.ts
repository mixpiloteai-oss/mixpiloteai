// ─── PluginBridge ─────────────────────────────────────────────────────────────
// Typed renderer-side wrapper for all plugin IPC calls.
// Abstracts window.electronAPI so the rest of the renderer never touches raw IPC.
//
// NOTE: Actual VST3 binary loading/processing happens in the Electron main
// process (src/main/modules/pluginHost.ts → plugin-host child process → Rust
// audio-engine binary). This bridge is the renderer side of that IPC channel.

import type { PluginInfo, PluginInstance, PluginPreset, BlacklistEntry } from '../store/pluginStore'
import { usePluginStore } from '../store/pluginStore'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ParameterDescriptor {
  id:           number
  name:         string
  minValue:     number
  maxValue:     number
  defaultValue: number
  unit:         string
  stepCount:    number
}

export interface PluginHealthInfo {
  instanceId:  string
  memoryMb:    number
  cpuPercent:  number
  uptimeMs:    number
}

export interface CrashInfo {
  instanceId:  string
  pluginPath:  string
  pluginName:  string
  crashCount:  number
  blacklisted: boolean
}

export interface RecoveryInfo {
  oldInstanceId: string
  newInstanceId: string
  pluginPath:    string
}

export interface AudioRoute {
  instanceId:           string
  trackId:              string
  inputGain:            number
  outputGain:           number
  bypassEnabled:        boolean
  latencyCompensationMs: number
}

// Lanekey format: `{instanceId}:{paramId}` — used as automation lane identifier
export type AutomationLaneKey = `${string}:${number}`

interface AutomationBinding {
  instanceId: string
  paramId:    number
  paramName:  string
  minValue:   number
  maxValue:   number
}

// ── PluginBridgeClass ─────────────────────────────────────────────────────────

class PluginBridgeClass {
  // Automation param registry: laneKey → binding metadata
  private readonly _automationMap = new Map<AutomationLaneKey, AutomationBinding>()

  // ── Scan / Registry ────────────────────────────────────────────────────────

  async scan(): Promise<PluginInfo[]> {
    const result = await window.electronAPI?.pluginScan() ?? []
    return result as PluginInfo[]
  }

  async getBlacklist(): Promise<BlacklistEntry[]> {
    const result = await window.electronAPI?.pluginGetBlacklist() ?? []
    return result
  }

  async removeFromBlacklist(path: string): Promise<boolean> {
    const result = await window.electronAPI?.pluginRemoveFromBlacklist(path)
    return result?.ok ?? false
  }

  async clearScanCache(): Promise<void> {
    await window.electronAPI?.pluginScanClearCache()
  }

  // ── Instance lifecycle ─────────────────────────────────────────────────────

  async load(
    path:    string,
    format:  string,
    pluginId: string,
  ): Promise<PluginInstance> {
    const inst = await window.electronAPI!.pluginLoad(path, format)
    return {
      instanceId:    inst.instanceId,
      pluginId,
      name:          inst.name,
      vendor:        inst.vendor,
      paramCount:    inst.paramCount,
      pid:           inst.pid,
      loadedAt:      Date.now(),
    }
  }

  async unload(instanceId: string): Promise<boolean> {
    const result = await window.electronAPI?.pluginUnload(instanceId)
    // Clean up any registered automation bindings for this instance
    for (const key of this._automationMap.keys()) {
      if (key.startsWith(`${instanceId}:`)) this._automationMap.delete(key)
    }
    return result?.ok ?? false
  }

  async getInstances(): Promise<PluginInstance[]> {
    const result = await window.electronAPI?.pluginGetInstances() ?? []
    return result as PluginInstance[]
  }

  // ── Parameters ─────────────────────────────────────────────────────────────

  async setParameter(instanceId: string, paramId: number, value: number): Promise<boolean> {
    const result = await window.electronAPI?.pluginSetParameter(instanceId, paramId, value)
    return result?.ok ?? false
  }

  async getParameter(instanceId: string, paramId: number): Promise<number | null> {
    const result = await window.electronAPI?.pluginGetParameter(instanceId, paramId)
    return result?.value ?? null
  }

  // ── Audio chain ────────────────────────────────────────────────────────────

  async addToChain(instanceId: string, trackId: string): Promise<boolean> {
    const result = await window.electronAPI?.pluginAddToChain(instanceId, trackId)
    return result?.ok ?? false
  }

  async removeFromChain(instanceId: string, trackId: string): Promise<boolean> {
    const result = await window.electronAPI?.pluginRemoveFromChain(instanceId, trackId)
    return result?.ok ?? false
  }

  async getAudioRoutes(): Promise<AudioRoute[]> {
    const result = await window.electronAPI?.pluginGetAudioRoutes() ?? []
    return result as AudioRoute[]
  }

  // ── MIDI routing ───────────────────────────────────────────────────────────

  async setMidiRoute(
    instanceId:  string,
    fromTrackId: string,
    channel:     number,
    deviceId?:   string,
  ): Promise<boolean> {
    const result = await window.electronAPI?.pluginSetMidiRoute(instanceId, fromTrackId, channel, deviceId)
    return result?.ok ?? false
  }

  // ── Presets ────────────────────────────────────────────────────────────────

  async listPresets(pluginId: string): Promise<PluginPreset[]> {
    const result = await window.electronAPI?.pluginListPresets(pluginId) ?? []
    return (result as { id: string; name: string; savedAt: number; isFactory: boolean }[]).map(p => ({
      ...p,
      pluginId,
    }))
  }

  async savePreset(
    pluginId:   string,
    name:       string,
    params:     Record<string, number>,
  ): Promise<PluginPreset | null> {
    const result = await window.electronAPI?.pluginSavePreset(pluginId, name, params)
    if (!result) return null
    return { id: result.id, pluginId, name: result.name, savedAt: Date.now(), isFactory: false }
  }

  async loadPreset(pluginId: string, presetId: string): Promise<Record<string, number> | null> {
    const result = await window.electronAPI?.pluginLoadPreset(pluginId, presetId)
    return result?.data ?? null
  }

  async deletePreset(pluginId: string, presetId: string): Promise<boolean> {
    const result = await window.electronAPI?.pluginDeletePreset(pluginId, presetId)
    return result?.ok ?? false
  }

  async renamePreset(pluginId: string, presetId: string, name: string): Promise<boolean> {
    const result = await window.electronAPI?.pluginRenamePreset(pluginId, presetId, name)
    return result !== null && result !== undefined
  }

  // ── Health & recovery ──────────────────────────────────────────────────────

  async getHealth(): Promise<PluginHealthInfo[]> {
    const result = await window.electronAPI?.pluginGetHealth() ?? []
    return result as PluginHealthInfo[]
  }

  async getInstanceHealth(instanceId: string): Promise<PluginHealthInfo | null> {
    const raw = await window.electronAPI?.pluginGetInstanceHealth(instanceId)
    if (!raw) return null
    return { instanceId, ...raw }
  }

  async hotReload(instanceId: string): Promise<boolean> {
    const result = await window.electronAPI?.pluginHotReload(instanceId)
    return result?.ok ?? false
  }

  async saveState(
    instanceId:  string,
    pluginPath:  string,
    format:      string,
    parameters:  Record<string, number>,
    trackId?:    string,
  ): Promise<boolean> {
    const result = await window.electronAPI?.pluginSaveState(instanceId, pluginPath, format, parameters, trackId)
    return result?.ok ?? false
  }

  async getRecoveredId(oldInstanceId: string): Promise<string | null> {
    const result = await window.electronAPI?.pluginGetRecoveredId(oldInstanceId)
    return result?.newInstanceId ?? null
  }

  // ── Event subscriptions ────────────────────────────────────────────────────

  onCrash(cb: (info: CrashInfo) => void): void {
    window.electronAPI?.onPluginCrashed(raw => {
      const info = raw as CrashInfo
      cb(info)
      // Mirror into Zustand store for UI notification
      usePluginStore.getState().setLastCrash({
        instanceId:  info.instanceId,
        pluginName:  info.pluginName,
        crashCount:  info.crashCount,
        blacklisted: info.blacklisted,
      })
      // Update isBlacklisted flag in plugins list
      const { plugins, setPlugins } = usePluginStore.getState()
      if (info.blacklisted) {
        setPlugins(plugins.map(p =>
          p.path === info.pluginPath ? { ...p, isBlacklisted: true, crashCount: info.crashCount } : p,
        ))
      }
    })
  }

  onRecovered(cb: (info: RecoveryInfo) => void): void {
    window.electronAPI?.onPluginRecovered(raw => cb(raw as RecoveryInfo))
  }

  onRecoveryFailed(cb: (info: unknown) => void): void {
    window.electronAPI?.onPluginRecoveryFailed(cb)
  }

  onRecoveryAbandoned(cb: (info: unknown) => void): void {
    window.electronAPI?.onPluginRecoveryAbandoned(cb)
  }

  onResourceWarning(cb: (info: unknown) => void): void {
    window.electronAPI?.onPluginResourceWarning(cb)
  }

  removeListeners(channel: string): void {
    window.electronAPI?.removeAllListeners(channel)
  }

  // ── Automation integration ─────────────────────────────────────────────────

  /**
   * Register a plugin parameter as an automation lane.
   * Returns the laneKey used as the automation lane identifier.
   * Lane name format: `{instanceId}:{paramId}`
   *
   * This is the integration point between the AutomationEngine and the plugin
   * system. When automation evaluates a point at a given beat, it calls
   * `applyAutomatedValue(laneKey, normalizedValue)` to drive the parameter.
   */
  registerAutomationLane(
    instanceId: string,
    paramId:    number,
    paramName:  string,
    minValue:   number,
    maxValue:   number,
  ): AutomationLaneKey {
    const key = `${instanceId}:${paramId}` as AutomationLaneKey
    this._automationMap.set(key, { instanceId, paramId, paramName, minValue, maxValue })
    return key
  }

  unregisterAutomationLane(laneKey: AutomationLaneKey): void {
    this._automationMap.delete(laneKey)
  }

  getAutomationBinding(laneKey: AutomationLaneKey): AutomationBinding | undefined {
    return this._automationMap.get(laneKey)
  }

  /**
   * Called by AutomationEngine during playback to apply a normalized [0,1]
   * value to the mapped plugin parameter. Scales to [minValue, maxValue].
   */
  async applyAutomatedValue(laneKey: AutomationLaneKey, normalizedValue: number): Promise<void> {
    const entry = this._automationMap.get(laneKey)
    if (!entry) return
    const { instanceId, paramId, minValue, maxValue } = entry
    const value = minValue + normalizedValue * (maxValue - minValue)
    await this.setParameter(instanceId, paramId, value)
  }

  // ── Latency compensation helper ────────────────────────────────────────────

  /**
   * Returns latency in samples for a given instance.
   * This is read from the PluginInstance stored in the Zustand store.
   * The main process populates latencySamples when load() resolves.
   */
  getInstanceLatency(instanceId: string): number {
    const instances = usePluginStore.getState().instances
    const inst = instances.find(i => i.instanceId === instanceId) as (PluginInstance & { latencySamples?: number }) | undefined
    return inst?.latencySamples ?? 0
  }
}

// Singleton — one bridge per renderer process
export const PluginBridge = new PluginBridgeClass()
