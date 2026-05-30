export type AudioDriver = 'ASIO' | 'WASAPI' | 'CoreAudio' | 'ALSA' | 'Default'
export type PluginCategory = 'instrument' | 'effect' | 'analyzer' | 'utility'
export type PluginFormat = 'VST2' | 'VST3' | 'AU' | 'CLAP'

export interface AudioDevice {
  id: string
  name: string
  type: 'input' | 'output'
  driver: AudioDriver
  sampleRates: number[]
  bufferSizes: number[]
  channels: number
}

export interface AudioEngineState {
  initialized: boolean
  device: AudioDevice | null
  sampleRate: number
  bufferSize: number
  latencyMs: number
  cpuUsage: number
  xruns: number
}

export interface VSTPlugin {
  id: string
  name: string
  vendor: string
  path: string
  format: PluginFormat
  category: PluginCategory
  hasEditor: boolean
  paramCount: number
  isFavorite: boolean
}

export type MidiMessageType = 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'clock' | 'sysex'

export interface MidiMessage {
  type: MidiMessageType
  channel: number
  data1: number
  data2: number
  timestamp: number
}

export interface MidiDevice {
  id: string
  name: string
  type: 'input' | 'output'
}

// Audio routing — used by routing matrix
export interface RoutingNode {
  id: string
  label: string
  kind: 'track' | 'bus' | 'master' | 'hardware'
}

export interface RoutingConnection {
  fromId: string
  toId: string
  gainDb: number
  enabled: boolean
}
