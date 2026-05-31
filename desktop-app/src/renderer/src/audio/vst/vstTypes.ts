// ── VST Types shared between renderer and main process ────────────────────────

export type PluginCategory = 'instrument' | 'effect' | 'midi-effect' | 'analyzer' | 'unknown'

export interface ScannedPlugin {
  id: string
  name: string
  vendor: string
  version: string
  category: PluginCategory
  path: string
  hasEditor: boolean
  paramCount: number
  inputBusCount: number
  outputBusCount: number
  supportsMidi: boolean
  supportsMultiOut: boolean
  scanTimestamp: number
}

export interface ParameterValue {
  index: number
  value: number
  normalizedValue: number
  name: string
  displayValue: string
  unit: string
}

export interface MidiEvent {
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'aftertouch'
  channel: number
  note?: number
  velocity?: number
  ccNumber?: number
  ccValue?: number
  pitchBend?: number
}

export interface PresetInfo {
  id: string
  name: string
  category: string
}

export interface LoadedInstance {
  instanceId: string
  pluginId: string
  pluginName: string
  bypassed: boolean
}

export interface FxSlotSnapshot {
  slotId: string
  pluginId: string
  bypassed: boolean
  gainDb: number
  instanceState: number[] | null
}

export interface SerializedFxChain {
  trackId: string
  slots: FxSlotSnapshot[]
}

export interface RackLayerSnapshot {
  layerId: string
  pluginId: string
  noteRangeLow: number
  noteRangeHigh: number
  velocityLow: number
  velocityHigh: number
  gainDb: number
  active: boolean
  instanceState: number[] | null
}

export interface SerializedRack {
  trackId: string
  layers: RackLayerSnapshot[]
}

export interface AudioRoute {
  routeId: string
  fromInstanceId: string
  fromBusIndex: number
  toInstanceId: string | 'mixer'
  toBusIndex: number
  gainDb: number
}

export interface MidiRoute {
  routeId: string
  sourceTrackId: string
  targetInstanceId: string
  channelFilter: number | 'all'
  noteTranspose: number
  velocityScale: number
}

export interface AutomationPoint {
  beatPosition: number
  value: number
  curve: 'linear' | 'step' | 'exponential'
}

export interface SerializedAutomation {
  instances: Record<string, Record<number, AutomationPoint[]>>
}
