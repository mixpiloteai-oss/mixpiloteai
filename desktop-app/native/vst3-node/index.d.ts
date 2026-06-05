// Type declarations for the vst3-node native addon

export interface Vst3PluginInfoNative {
  cid: string
  name: string
  vendor: string
  version: string
  sdkVersion: string
  category: string
  subCategories: string[]
  hasEditor: boolean
  parameterCount: number
  inputBusCount: number
  outputBusCount: number
  supportsMidi: boolean
  supportsMultipleOutputs: boolean
  programCount: number
}

export interface ProcessSetupNative {
  sampleRate: number
  maxBlockSize: number
  symbolicSampleSize?: 0 | 1  // 0=float32 (default), 1=float64
  processMode?: 0 | 1          // 0=realtime (default), 1=offline
}

export interface ParamInfoNative {
  id: number
  title: string
  shortTitle: string
  units: string
  stepCount: number
  defaultNormalizedValue: number
  unitId: number
  flags: number
}

export interface ParamValueNative {
  paramId: number
  value: number
  normalized: number
  display: string
}

export interface MidiEventNative {
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'aftertouch' | 'channelPressure'
  channel: number
  note?: number
  velocity?: number
  ccNumber?: number
  ccValue?: number
  pitchBend?: number
  pressure?: number
}

export interface EditorSize {
  width: number
  height: number
}

export function scanPlugin(bundlePath: string): Vst3PluginInfoNative | null
export function createInstance(bundlePath: string, componentId: string): string
export function destroyInstance(instanceId: string): void
export function setupProcessing(instanceId: string, setup: ProcessSetupNative): boolean
export function activateInstance(instanceId: string, active: boolean): void
export function processBlock(instanceId: string, inputs: Float32Array[], outputs: Float32Array[], events: unknown[]): void
export function getParameterCount(instanceId: string): number
export function getParameterInfo(instanceId: string, index: number): ParamInfoNative
export function getParameterValue(instanceId: string, paramId: number): number
export function setParameterValue(instanceId: string, paramId: number, value: number): void
export function getParameterStringByValue(instanceId: string, paramId: number, value: number): string
export function getAllParameterValues(instanceId: string): ParamValueNative[]
export function getState(instanceId: string): Buffer
export function setState(instanceId: string, state: Buffer): void
export function attachEditor(instanceId: string, parentWindowHandle: Buffer): EditorSize
export function detachEditor(instanceId: string): void
export function resizeEditor(instanceId: string, width: number, height: number): void
export function sendMidiEvent(instanceId: string, event: MidiEventNative): void
export function getPresetCount(instanceId: string): number
export function getPresetName(instanceId: string, index: number): string
export function loadPreset(instanceId: string, presetPath: string): void
export function savePreset(instanceId: string, presetPath: string): void
