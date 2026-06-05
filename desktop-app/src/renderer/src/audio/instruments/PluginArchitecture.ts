/**
 * PluginArchitecture — Extension interfaces for external plugin formats
 *
 * Current DAW plugin system:
 *   Main process: pluginHost.ts (child process per plugin) + pluginIPC.ts + pluginScanner.ts
 *   Renderer: PluginBridge.ts (typed IPC wrapper)
 *   Audio: FxInsertChain.ts (builtin DSP: gain/compressor/delay)
 *
 * Future extension points — implement these interfaces to add new formats:
 */

// ── VST3 ──────────────────────────────────────────────────────────────────────

/**
 * VST3Plugin: to be implemented when VST3 SDK is available.
 * The host (pluginHost.ts child process) will load the VST3 binary and
 * implement this interface via the plugin-host/index.ts bridge.
 */
export interface IVST3Plugin {
  readonly format: 'VST3'
  readonly uid:    string   // VST3 class ID (128-bit GUID as hex)

  // Parameter info (from IEditController::getParameterInfo)
  getParameterCount(): number
  getParameterInfo(index: number): VST3ParameterInfo
  getParameterValue(id: number): number
  setParameterValue(id: number, value: number): void

  // Bus info (from IComponent::getBusInfo)
  getAudioBusCount(dir: 'input'|'output'): number
  getMidiBusCount(dir: 'input'|'output'): number

  // Processing
  process(inputs: Float32Array[][], outputs: Float32Array[][], midiIn: MidiBuffer): void

  // Editor (native GUI)
  createEditor(): IPluginEditor | null
}

export interface VST3ParameterInfo {
  id:         number
  title:      string      // parameter name
  shortTitle: string
  units:      string
  stepCount:  number      // 0 = continuous
  defaultValue: number    // normalized 0.0–1.0
  flags:      number      // VST3 ParameterInfo::ParameterFlags
}

// ── Audio Unit (AU) ───────────────────────────────────────────────────────────

/** AU: macOS only. Loaded via AudioUnitGraph on macOS child process. */
export interface IAudioUnitPlugin {
  readonly format: 'AU'
  readonly componentType: string   // e.g. 'aumu' (instrument), 'aufx' (effect)
  readonly subtype:       string   // 4-char code
  readonly manufacturer:  string   // 4-char code

  getParameterList(): AUParameterInfo[]
  getParameterValue(id: number): number
  setParameterValue(id: number, value: number): void
  process(inputs: Float32Array[][], outputs: Float32Array[][]): void
}

export interface AUParameterInfo {
  id:    number
  name:  string
  min:   number
  max:   number
  defaultValue: number
  unit:  string
}

// ── CLAP ──────────────────────────────────────────────────────────────────────

/** CLAP: open format. Implement via N-API addon or child-process binary. */
export interface ICLAPPlugin {
  readonly format: 'CLAP'
  readonly id:     string   // reverse domain notation e.g. 'com.vendor.name'
  readonly version: string

  getExtension(id: string): unknown   // CLAP extension objects
  process(steadyTime: bigint, framesCount: number): void
}

// ── Plugin Editor (generic native GUI wrapper) ────────────────────────────────

export interface IPluginEditor {
  open(parentWindow: unknown): boolean   // attach native view to parent
  close(): void
  getSize(): { width: number; height: number }
  resize(width: number, height: number): boolean
}

// ── MIDI buffer (for VST3 event list) ────────────────────────────────────────

export interface MidiBuffer {
  events: Array<{ type: 'noteOn'|'noteOff'|'cc'; pitch?: number; value?: number; cc?: number; velocity?: number; time: number }>
}

// ── Plugin format union — used by pluginHost.ts to dispatch ───────────────────

export type AnyPlugin = IVST3Plugin | IAudioUnitPlugin | ICLAPPlugin

// ── Internal instruments — already implement a compatible interface ─────────────

/**
 * Internal instruments (SubtractiveSynth, SamplerEngine) implement a simpler
 * interface compatible with MidiTrackNode.synthInput:
 *   - noteOn(pitch, velocity): void
 *   - noteOff(pitch): void
 *   - allNotesOff(): void
 *   - output: GainNode (connect to synthInput)
 *   - dispose(): void
 *
 * They do NOT go through pluginHost.ts (no child process, no IPC) — they run
 * directly in the renderer AudioWorklet thread.
 *
 * Future AudioWorklet integration: each instrument could also be wrapped as
 * an AudioWorkletProcessor for better real-time performance.
 */
export interface IInternalInstrument {
  readonly output: GainNode
  noteOn(pitch: number, velocity: number): void
  noteOff(pitch: number): void
  allNotesOff(): void
  dispose(): void
}
