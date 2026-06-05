// ── Native VST3 Adapter Interface ─────────────────────────────────────────────
// The native VST3 adapter interface.
// A real implementation requires linking against the Steinberg VST3 SDK.
// Compatible Node.js native addons: vst3-node, node-vst3, or a custom napi-rs crate.

export interface Vst3PluginInfo {
  cid: string                    // VST3 class ID (FUID as hex string)
  name: string
  vendor: string
  version: string
  sdkVersion: string
  category: string               // e.g. "Instrument|Synth" or "Fx|Dynamics"
  subCategories: string[]
  hasEditor: boolean
  parameterCount: number
  inputBusCount: number
  outputBusCount: number
  sideChainInputCount: number
  supportsMidi: boolean
  supportsMultipleOutputs: boolean
  programCount: number
}

export interface Vst3ProcessSetup {
  sampleRate: number
  maxBlockSize: number
  symbolicSampleSize: 0 | 1      // 0=float32, 1=float64
  processMode: 0 | 1             // 0=realtime, 1=offline
}

export interface Vst3ParamInfo {
  id: number
  title: string
  shortTitle: string
  units: string
  stepCount: number
  defaultNormalizedValue: number
  unitId: number
  flags: number                  // bitmask: kCanAutomate=1, kIsReadOnly=2, kIsBypass=16
}

export interface Vst3Event {
  type: 'noteOn' | 'noteOff' | 'polyPressure' | 'dataEvent' | 'paramChange'
  sampleOffset: number
  ppqPosition: number
  isLive: boolean
  noteOn?: { channel: number; pitch: number; tuning: number; velocity: number; length: number; noteId: number }
  noteOff?: { channel: number; pitch: number; velocity: number; noteId: number; tuning: number }
  paramChange?: { paramId: number; value: number }
}

export interface Vst3MidiEvent {
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'aftertouch' | 'channelPressure'
  channel: number
  note?: number
  velocity?: number
  ccNumber?: number
  ccValue?: number
  pitchBend?: number
  pressure?: number
}

export interface IVst3Adapter {
  // Plugin discovery
  scanPlugin(pluginPath: string): Promise<Vst3PluginInfo | null>
  getPluginCategories(pluginPath: string): Promise<string[]>

  // Lifecycle
  createInstance(pluginPath: string, componentId: string): Promise<string>  // returns instanceId
  destroyInstance(instanceId: string): Promise<void>

  // Processing setup
  setupProcessing(instanceId: string, setup: Vst3ProcessSetup): Promise<boolean>
  activateInstance(instanceId: string, active: boolean): Promise<void>

  // Audio processing (called per buffer from audio thread)
  processBlock(instanceId: string, inputs: Float32Array[][], outputs: Float32Array[][], events: Vst3Event[]): Promise<void>

  // Parameters
  getParameterCount(instanceId: string): Promise<number>
  getParameterInfo(instanceId: string, paramIndex: number): Promise<Vst3ParamInfo>
  getParameterValue(instanceId: string, paramId: number): Promise<number>
  setParameterValue(instanceId: string, paramId: number, value: number): Promise<void>
  getParameterStringByValue(instanceId: string, paramId: number, value: number): Promise<string>
  getAllParameterValues(instanceId: string): Promise<Array<{ paramId: number; value: number; normalized: number; display: string }>>

  // State (opaque binary blob)
  getState(instanceId: string): Promise<Buffer>
  setState(instanceId: string, state: Buffer): Promise<void>

  // Editor window
  attachEditor(instanceId: string, parentWindowHandle: Buffer): Promise<{ width: number; height: number }>
  detachEditor(instanceId: string): Promise<void>
  resizeEditor(instanceId: string, width: number, height: number): Promise<void>

  // MIDI
  sendMidiEvent(instanceId: string, event: Vst3MidiEvent): Promise<void>

  // Presets
  getPresetCount(instanceId: string): Promise<number>
  getPresetName(instanceId: string, index: number): Promise<string>
  loadPreset(instanceId: string, presetPath: string): Promise<void>
  savePreset(instanceId: string, presetPath: string): Promise<void>
}

// Null implementation used until native addon is linked:
export class NullVst3Adapter implements IVst3Adapter {
  // Every method throws with a clear message pointing to this file
  private notAvailable(method: string): never {
    throw new Error(
      `VST3 native addon not loaded — ${method} requires vst3-node or equivalent. ` +
      `See src/main/vst/native/IVst3Adapter.ts`
    )
  }

  scanPlugin(_path: string): Promise<Vst3PluginInfo | null> { this.notAvailable('scanPlugin') }
  getPluginCategories(_path: string): Promise<string[]> { this.notAvailable('getPluginCategories') }
  createInstance(_path: string, _cid: string): Promise<string> { this.notAvailable('createInstance') }
  destroyInstance(_id: string): Promise<void> { this.notAvailable('destroyInstance') }
  setupProcessing(_id: string, _s: Vst3ProcessSetup): Promise<boolean> { this.notAvailable('setupProcessing') }
  activateInstance(_id: string, _a: boolean): Promise<void> { this.notAvailable('activateInstance') }
  processBlock(_id: string, _i: Float32Array[][], _o: Float32Array[][], _e: Vst3Event[]): Promise<void> { this.notAvailable('processBlock') }
  getParameterCount(_id: string): Promise<number> { this.notAvailable('getParameterCount') }
  getParameterInfo(_id: string, _i: number): Promise<Vst3ParamInfo> { this.notAvailable('getParameterInfo') }
  getParameterValue(_id: string, _p: number): Promise<number> { this.notAvailable('getParameterValue') }
  setParameterValue(_id: string, _p: number, _v: number): Promise<void> { this.notAvailable('setParameterValue') }
  getParameterStringByValue(_id: string, _p: number, _v: number): Promise<string> { this.notAvailable('getParameterStringByValue') }
  getAllParameterValues(_id: string): Promise<Array<{ paramId: number; value: number; normalized: number; display: string }>> { this.notAvailable('getAllParameterValues') }
  getState(_id: string): Promise<Buffer> { this.notAvailable('getState') }
  setState(_id: string, _s: Buffer): Promise<void> { this.notAvailable('setState') }
  attachEditor(_id: string, _h: Buffer): Promise<{ width: number; height: number }> { this.notAvailable('attachEditor') }
  detachEditor(_id: string): Promise<void> { this.notAvailable('detachEditor') }
  resizeEditor(_id: string, _w: number, _h: number): Promise<void> { this.notAvailable('resizeEditor') }
  sendMidiEvent(_id: string, _e: Vst3MidiEvent): Promise<void> { this.notAvailable('sendMidiEvent') }
  getPresetCount(_id: string): Promise<number> { this.notAvailable('getPresetCount') }
  getPresetName(_id: string, _i: number): Promise<string> { this.notAvailable('getPresetName') }
  loadPreset(_id: string, _p: string): Promise<void> { this.notAvailable('loadPreset') }
  savePreset(_id: string, _p: string): Promise<void> { this.notAvailable('savePreset') }
}

// Native addon wrapper — adapts the flat C++ exports to IVst3Adapter

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AddonModule = Record<string, (...args: unknown[]) => unknown>

class NativeVst3Adapter implements IVst3Adapter {
  private readonly addon: AddonModule
  constructor(addon: AddonModule) { this.addon = addon }

  scanPlugin(pluginPath: string): Promise<Vst3PluginInfo | null> {
    return Promise.resolve(
      (this.addon['scanPlugin'] as (p: string) => Vst3PluginInfo | null)(pluginPath)
    )
  }
  getPluginCategories(pluginPath: string): Promise<string[]> {
    const info = (this.addon['scanPlugin'] as (p: string) => Vst3PluginInfo | null)(pluginPath)
    return Promise.resolve(info ? info.subCategories : [])
  }
  createInstance(pluginPath: string, componentId: string): Promise<string> {
    return Promise.resolve(
      (this.addon['createInstance'] as (p: string, c: string) => string)(pluginPath, componentId)
    )
  }
  destroyInstance(instanceId: string): Promise<void> {
    ;(this.addon['destroyInstance'] as (id: string) => void)(instanceId)
    return Promise.resolve()
  }
  setupProcessing(instanceId: string, setup: Vst3ProcessSetup): Promise<boolean> {
    return Promise.resolve(
      (this.addon['setupProcessing'] as (id: string, s: Vst3ProcessSetup) => boolean)(instanceId, setup)
    )
  }
  activateInstance(instanceId: string, active: boolean): Promise<void> {
    ;(this.addon['activateInstance'] as (id: string, a: boolean) => void)(instanceId, active)
    return Promise.resolve()
  }
  processBlock(instanceId: string, inputs: Float32Array[][], outputs: Float32Array[][], events: Vst3Event[]): Promise<void> {
    // Flatten stereo: pass first channel of each bus
    const inFlat  = inputs.map(bus => bus[0] ?? new Float32Array(0))
    const outFlat = outputs.map(bus => bus[0] ?? new Float32Array(0))
    ;(this.addon['processBlock'] as (id: string, i: Float32Array[], o: Float32Array[], e: unknown[]) => void)(
      instanceId, inFlat, outFlat, events
    )
    return Promise.resolve()
  }
  getParameterCount(instanceId: string): Promise<number> {
    return Promise.resolve(
      (this.addon['getParameterCount'] as (id: string) => number)(instanceId)
    )
  }
  getParameterInfo(instanceId: string, paramIndex: number): Promise<Vst3ParamInfo> {
    return Promise.resolve(
      (this.addon['getParameterInfo'] as (id: string, i: number) => Vst3ParamInfo)(instanceId, paramIndex)
    )
  }
  getParameterValue(instanceId: string, paramId: number): Promise<number> {
    return Promise.resolve(
      (this.addon['getParameterValue'] as (id: string, p: number) => number)(instanceId, paramId)
    )
  }
  setParameterValue(instanceId: string, paramId: number, value: number): Promise<void> {
    ;(this.addon['setParameterValue'] as (id: string, p: number, v: number) => void)(instanceId, paramId, value)
    return Promise.resolve()
  }
  getParameterStringByValue(instanceId: string, paramId: number, value: number): Promise<string> {
    return Promise.resolve(
      (this.addon['getParameterStringByValue'] as (id: string, p: number, v: number) => string)(instanceId, paramId, value)
    )
  }
  getAllParameterValues(instanceId: string): Promise<Array<{ paramId: number; value: number; normalized: number; display: string }>> {
    return Promise.resolve(
      (this.addon['getAllParameterValues'] as (id: string) => Array<{ paramId: number; value: number; normalized: number; display: string }>)(instanceId)
    )
  }
  getState(instanceId: string): Promise<Buffer> {
    return Promise.resolve(
      (this.addon['getState'] as (id: string) => Buffer)(instanceId)
    )
  }
  setState(instanceId: string, state: Buffer): Promise<void> {
    ;(this.addon['setState'] as (id: string, s: Buffer) => void)(instanceId, state)
    return Promise.resolve()
  }
  attachEditor(instanceId: string, parentWindowHandle: Buffer): Promise<{ width: number; height: number }> {
    return Promise.resolve(
      (this.addon['attachEditor'] as (id: string, h: Buffer) => { width: number; height: number })(instanceId, parentWindowHandle)
    )
  }
  detachEditor(instanceId: string): Promise<void> {
    ;(this.addon['detachEditor'] as (id: string) => void)(instanceId)
    return Promise.resolve()
  }
  resizeEditor(instanceId: string, width: number, height: number): Promise<void> {
    ;(this.addon['resizeEditor'] as (id: string, w: number, h: number) => void)(instanceId, width, height)
    return Promise.resolve()
  }
  sendMidiEvent(instanceId: string, event: Vst3MidiEvent): Promise<void> {
    ;(this.addon['sendMidiEvent'] as (id: string, e: Vst3MidiEvent) => void)(instanceId, event)
    return Promise.resolve()
  }
  getPresetCount(instanceId: string): Promise<number> {
    return Promise.resolve(
      (this.addon['getPresetCount'] as (id: string) => number)(instanceId)
    )
  }
  getPresetName(instanceId: string, index: number): Promise<string> {
    return Promise.resolve(
      (this.addon['getPresetName'] as (id: string, i: number) => string)(instanceId, index)
    )
  }
  loadPreset(instanceId: string, presetPath: string): Promise<void> {
    ;(this.addon['loadPreset'] as (id: string, p: string) => void)(instanceId, presetPath)
    return Promise.resolve()
  }
  savePreset(instanceId: string, presetPath: string): Promise<void> {
    ;(this.addon['savePreset'] as (id: string, p: string) => void)(instanceId, presetPath)
    return Promise.resolve()
  }
}

// Adapter loader — tries to load the compiled native addon, falls back to NullVst3Adapter.
// The native addon is built with: cd desktop-app/native/vst3-node && npm install && npm run build
export function loadVst3Adapter(): IVst3Adapter {
  const candidatePaths = [
    // Compiled by node-gyp (development)
    '../../../native/vst3-node/build/Release/vst3-node.node',
    // Packaged in Electron app (production)
    '../../native/vst3-node/build/Release/vst3-node.node',
  ]

  for (const addonPath of candidatePaths) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const addon = require(addonPath) as AddonModule
      if (typeof addon['scanPlugin'] === 'function') {
        console.log('[vst3] Native addon loaded from:', addonPath)
        return new NativeVst3Adapter(addon)
      }
    } catch {
      // Not found at this path — try next
    }
  }

  console.warn('[vst3] Native addon not available — VST3 hosting disabled. Build with: cd desktop-app/native/vst3-node && npm install && npm run build')
  return new NullVst3Adapter()
}

export const vst3Adapter: IVst3Adapter = loadVst3Adapter()
