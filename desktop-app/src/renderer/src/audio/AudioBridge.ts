/**
 * AudioBridge — native engine abstraction layer
 *
 * Purpose: decouple the DAW UI from the specific audio backend.
 *
 * Today:   WebAudioBridge   — pure Web Audio API in renderer process
 * Future:  NativeAudioBridge — delegates to Rust/C++ via Electron IPC
 *
 * Migration path:
 *   1. Build NativeAudioBridge implementing IAudioBridge
 *   2. In audio/index.ts, swap `new WebAudioBridge()` for
 *      `new NativeAudioBridge(window.electronAPI)`
 *   3. The rest of the codebase never changes.
 *
 * The IPC contract with the native engine (for NativeAudioBridge) would
 * use the handlers already registered in main/modules/audio.ts:
 *   - 'get-audio-devices'
 *   - 'get-audio-settings'
 *   - 'set-audio-settings'
 *   - 'audio-cache-fetch' / 'audio-cache-store'
 *
 * The native transport IPC handlers would be added to those modules when
 * the Rust engine is integrated.
 */

import type {
  IAudioBridge,
  BeatCallback, BarCallback, StateCallback,
  ChannelLevel,
  Unsubscribe,
} from './types'
import { AudioEngine } from './AudioEngine'
import { Transport } from './Transport'
import { WaveformLoader } from './WaveformLoader'

// ─── WebAudioBridge ─────────────────────────────────────────────────────────

export class WebAudioBridge implements IAudioBridge {
  private readonly _engine:    AudioEngine
  private readonly _transport: Transport
  private readonly _loader:    WaveformLoader

  constructor(engine: AudioEngine, transport: Transport, loader: WaveformLoader) {
    this._engine    = engine
    this._transport = transport
    this._loader    = loader
  }

  // ── Context ──────────────────────────────────────────────────────────────

  get isReady():     boolean        { return this._engine.state === 'running' }
  get sampleRate():  number         { return this._engine.sampleRate }
  get currentTime(): number         { return this._engine.currentTime }
  get ctx():         AudioContext   { return this._engine.ctx }
  get masterInput(): AudioNode      { return this._engine.masterInput }

  async resume(): Promise<void>     { return this._engine.resume() }

  // ── Transport ────────────────────────────────────────────────────────────

  play(fromBeat = 0):  void { void fromBeat; this._transport.play() }
  stop():              void { this._transport.stop() }
  pause():             void { this._transport.pause() }
  setBpm(bpm: number): void { this._transport.bpm = bpm }

  setTimeSignature(top: number, bottom: number): void {
    this._transport.setTimeSignature(top, bottom)
  }

  setLoop(enabled: boolean, startBar: number, endBar: number): void {
    if (enabled) this._transport.toggleLoop()  // setLoopRegion handles the values
    this._transport.setLoopRegion(startBar, endBar)
  }

  seekToBar(bar: number): void {
    this._transport.clock.seekToBar(bar)
  }

  // ── Buffers ──────────────────────────────────────────────────────────────

  loadBuffer(url: string): Promise<AudioBuffer | null> {
    return this._loader.load(url)
  }

  releaseBuffer(url: string): void {
    this._loader.evict(url)
  }

  clearBufferCache(): void {
    this._loader.clearCache()
  }

  // ── Scheduling ───────────────────────────────────────────────────────────

  scheduleBuffer(
    buffer:           AudioBuffer,
    destination:      AudioNode,
    startContextTime: number,
    offsetSec  = 0,
    durationSec?: number,
  ): AudioBufferSourceNode {
    const src = this._engine.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(destination)
    if (durationSec !== undefined) {
      src.start(startContextTime, offsetSec, durationSec)
    } else {
      src.start(startContextTime, offsetSec)
    }
    return src
  }

  // ── Metering ─────────────────────────────────────────────────────────────

  getMasterLevel(): ChannelLevel {
    return this._engine.getMasterLevel()
  }

  // ── Events ───────────────────────────────────────────────────────────────

  onBeat(cb: BeatCallback):       Unsubscribe { return this._transport.onBeat(cb) }
  onBar(cb: BarCallback):         Unsubscribe { return this._transport.onBar(cb) }
  onStateChange(cb: StateCallback): Unsubscribe { return this._transport.onStateChange(cb) }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  dispose(): void {
    this._transport.dispose()
    this._engine.dispose()
  }
}

// ─── Stub: NativeAudioBridge skeleton ───────────────────────────────────────
//
// This class shows the IPC pattern for the future Rust integration.
// Uncomment and implement when native engine is ready.
//
// export class NativeAudioBridge implements IAudioBridge {
//   constructor(private readonly ipc: Window['electronAPI']) {}
//
//   get sampleRate()  { return 48000 /* from IPC init handshake */ }
//   get currentTime() { return performance.now() / 1000 /* or IPC query */ }
//
//   async resume() { await this.ipc.setAudioSettings({ running: true }) }
//
//   play(fromBeat = 0) { this.ipc.audioTransportPlay({ fromBeat }) }
//   stop()             { this.ipc.audioTransportStop() }
//   ...
// }
