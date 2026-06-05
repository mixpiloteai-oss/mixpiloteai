/**
 * MonitorEngine — input monitoring and cue/headphone mix
 *
 * Captures the system microphone/line input via getUserMedia and routes
 * it through armed-track channel strips for zero-latency software monitoring.
 *
 * Additionally provides a separate cue bus for headphone mix (pre-master).
 *
 *   Microphone → MediaStreamSourceNode
 *     ↓
 *   MonitorGain (per-track) → TrackChannel (armed) → Master/Bus
 *     ↓
 *   CueBus → Cue Output (headphones)
 */

import { AudioEngine, dbToGain, gainToDb } from './AudioEngine'
import type { ChannelLevel } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonitorConfig {
  enabled:       boolean
  gainDb:        number
  directMonitor: boolean  // hardware monitoring (bypass software monitoring)
}

export interface CueConfig {
  enabled: boolean
  gainDb:  number
}

// ─── MonitorEngine ────────────────────────────────────────────────────────────

export class MonitorEngine {
  private readonly engine:     AudioEngine

  private _stream:             MediaStream | null            = null
  private _sourceNode:         MediaStreamAudioSourceNode | null = null
  private _monitorGain:        GainNode
  private _cueGain:            GainNode
  private _cueAnalyser:        AnalyserNode
  private _trackGains:         Map<string, GainNode>        = new Map()

  private _enabled             = false
  private _directMonitor       = false
  private _monitorGainDb       = 0
  private _cueEnabled          = false
  private _cueGainDb           = -6
  private _cueAnalyserBuf:     Float32Array<ArrayBuffer>

  private _peakHold            = 0
  private _peakTime            = 0

  constructor(engine: AudioEngine) {
    this.engine = engine

    this._monitorGain = engine.ctx.createGain()
    this._monitorGain.gain.value = 0  // silent until enabled

    this._cueGain    = engine.ctx.createGain()
    this._cueGain.gain.value = 0  // silent until cue enabled

    this._cueAnalyser = engine.ctx.createAnalyser()
    this._cueAnalyser.fftSize = 256
    this._cueAnalyser.smoothingTimeConstant = 0

    this._cueGain.connect(this._cueAnalyser)
    this._cueAnalyser.connect(engine.masterInput)  // cue feeds master in this impl

    this._cueAnalyserBuf = new Float32Array(this._cueAnalyser.fftSize) as Float32Array<ArrayBuffer>
  }

  // ── Activation ───────────────────────────────────────────────────────────

  async enable(config: MonitorConfig): Promise<void> {
    this._enabled       = config.enabled
    this._directMonitor = config.directMonitor
    this.setMonitorGain(config.gainDb)

    if (this._directMonitor || !config.enabled) {
      this._silenceMonitor()
      return
    }

    await this._acquireInputStream()
  }

  disable(): void {
    this._enabled = false
    this._silenceMonitor()
    this._releaseInputStream()
  }

  // ── Per-track routing ────────────────────────────────────────────────────

  /**
   * Wire monitoring input to a specific armed track's channel.
   * The channel gain node is the entry point of the track's signal chain.
   */
  routeToTrack(trackId: string, channelInput: AudioNode): void {
    if (this._trackGains.has(trackId)) this.unrouteTrack(trackId)
    const g = this.engine.ctx.createGain()
    g.gain.value = this._enabled && !this._directMonitor ? 1 : 0
    this._monitorGain.connect(g)
    g.connect(channelInput)
    this._trackGains.set(trackId, g)
  }

  unrouteTrack(trackId: string): void {
    const g = this._trackGains.get(trackId)
    if (g) { g.disconnect(); this._trackGains.delete(trackId) }
  }

  // ── Cue bus ──────────────────────────────────────────────────────────────

  enableCue(cfg: CueConfig): void {
    this._cueEnabled  = cfg.enabled
    this._cueGainDb   = cfg.gainDb
    this._cueGain.gain.setTargetAtTime(
      cfg.enabled ? dbToGain(cfg.gainDb) : 0,
      this.engine.ctx.currentTime, 0.005,
    )
  }

  setCueGain(db: number): void {
    this._cueGainDb = db
    if (this._cueEnabled) {
      this._cueGain.gain.setTargetAtTime(dbToGain(db), this.engine.ctx.currentTime, 0.005)
    }
  }

  /** Connect a source (e.g. a bus or track) to the cue bus. */
  connectToCue(source: AudioNode): void { source.connect(this._cueGain) }
  disconnectFromCue(source: AudioNode): void { try { source.disconnect(this._cueGain) } catch { /* already disconnected */ } }

  // ── Gain control ─────────────────────────────────────────────────────────

  setMonitorGain(db: number): void {
    this._monitorGainDb = db
    if (this._enabled && !this._directMonitor) {
      this._monitorGain.gain.setTargetAtTime(dbToGain(db), this.engine.ctx.currentTime, 0.005)
    }
  }

  // ── Metering ─────────────────────────────────────────────────────────────

  getCueLevel(): ChannelLevel {
    this._cueAnalyser.getFloatTimeDomainData(this._cueAnalyserBuf)
    let sumSq = 0, peak = 0
    for (let i = 0; i < this._cueAnalyserBuf.length; i++) {
      const v = Math.abs(this._cueAnalyserBuf[i])
      sumSq += v * v
      if (v > peak) peak = v
    }
    const rms = Math.sqrt(sumSq / this._cueAnalyserBuf.length)
    const now = performance.now()
    if (peak >= this._peakHold) { this._peakHold = peak; this._peakTime = now }
    else if (now - this._peakTime > 1500) { this._peakHold = Math.max(this._peakHold - 0.005, peak) }
    return { rms, peak: this._peakHold, dbfs: gainToDb(rms) }
  }

  // ── State ─────────────────────────────────────────────────────────────────

  get enabled(): boolean        { return this._enabled }
  get directMonitor(): boolean  { return this._directMonitor }
  get monitorGainDb(): number   { return this._monitorGainDb }
  get cueEnabled(): boolean     { return this._cueEnabled }
  get cueGainDb(): number       { return this._cueGainDb }
  get hasInputStream(): boolean { return this._stream !== null }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async _acquireInputStream(): Promise<void> {
    if (this._stream) return
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      this._sourceNode = this.engine.ctx.createMediaStreamSource(this._stream)
      this._sourceNode.connect(this._monitorGain)
      this._monitorGain.gain.setTargetAtTime(
        dbToGain(this._monitorGainDb), this.engine.ctx.currentTime, 0.005,
      )
      // Enable track gains
      for (const g of this._trackGains.values()) g.gain.value = 1
    } catch (err) {
      console.warn('[MonitorEngine] getUserMedia failed:', err)
    }
  }

  private _releaseInputStream(): void {
    if (this._sourceNode) { this._sourceNode.disconnect(); this._sourceNode = null }
    if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null }
  }

  private _silenceMonitor(): void {
    this._monitorGain.gain.setTargetAtTime(0, this.engine.ctx.currentTime, 0.005)
    for (const g of this._trackGains.values()) g.gain.value = 0
  }

  dispose(): void {
    this.disable()
    this._cueGain.disconnect()
    this._cueAnalyser.disconnect()
    for (const g of this._trackGains.values()) g.disconnect()
    this._trackGains.clear()
  }
}
