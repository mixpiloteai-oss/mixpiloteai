/**
 * TrackMixer
 *
 * Manages one TrackChannel per project track.
 * Each TrackChannel is a Web Audio signal chain:
 *
 *   source nodes → gainNode → panNode → analyserNode → masterInput
 *
 * Solo is handled at the mixer level: when any track is soloed, every
 * non-soloed track's gain node is set to 0 (not muted, so the gain is
 * restored exactly when solo is lifted).
 */

import type { TrackChannelConfig, ChannelLevel } from './types'
import { AudioEngine, dbToGain, gainToDb, clamp } from './AudioEngine'

// ─── TrackChannel ────────────────────────────────────────────────────────────

export class TrackChannel {
  readonly id:           string
  readonly gainNode:     GainNode
  readonly panNode:      StereoPannerNode
  readonly analyserNode: AnalyserNode

  private readonly engine:    AudioEngine
  private _gainDb  = 0
  private _pan     = 0
  private _muted   = false
  private _soloed  = false
  private _soloMuted = false   // muted by mixer solo logic (not user mute)

  private _analyserBuf:  Float32Array<ArrayBuffer>
  private _peakHold    = 0
  private _peakTime    = 0

  constructor(id: string, engine: AudioEngine) {
    this.id     = id
    this.engine = engine

    this.gainNode     = engine.ctx.createGain()
    this.panNode      = engine.ctx.createStereoPanner()
    this.analyserNode = engine.ctx.createAnalyser()

    this.analyserNode.fftSize               = 256
    this.analyserNode.smoothingTimeConstant = 0.0

    // Chain: gain → pan → analyser → master bus
    this.gainNode.connect(this.panNode)
    this.panNode.connect(this.analyserNode)
    this.analyserNode.connect(engine.masterInput)

    this._analyserBuf = new Float32Array(this.analyserNode.fftSize) as Float32Array<ArrayBuffer>
  }

  /** The entry point — connect source nodes here. */
  get input(): AudioNode { return this.gainNode }

  // ── Channel strip setters ───────────────────────────────────────────────

  setGain(db: number): void {
    this._gainDb = clamp(db, -60, 12)
    this._applyGain()
  }

  setPan(pan: number): void {
    this._pan = clamp(pan, -1, 1)
    this.panNode.pan.setTargetAtTime(this._pan, this.engine.ctx.currentTime, 0.005)
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    this._applyGain()
  }

  setSoloed(soloed: boolean): void {
    this._soloed = soloed
  }

  /** Called by TrackMixer when global solo state changes. */
  setSoloMuted(muted: boolean): void {
    this._soloMuted = muted
    this._applyGain()
  }

  apply(cfg: TrackChannelConfig): void {
    this.setGain(cfg.gainDb)
    this.setPan(cfg.pan)
    this.setMuted(cfg.muted)
    this.setSoloed(cfg.soloed)
  }

  // ── Metering ────────────────────────────────────────────────────────────

  /** Call from rAF — not from Zustand/React render. */
  getLevel(): ChannelLevel {
    this.analyserNode.getFloatTimeDomainData(this._analyserBuf)

    let sumSq = 0
    let peak  = 0
    for (let i = 0; i < this._analyserBuf.length; i++) {
      const v = Math.abs(this._analyserBuf[i])
      sumSq  += v * v
      if (v > peak) peak = v
    }

    const rms = Math.sqrt(sumSq / this._analyserBuf.length)
    const now = performance.now()

    if (peak >= this._peakHold) {
      this._peakHold = peak
      this._peakTime = now
    } else if (now - this._peakTime > 1500) {
      this._peakHold = Math.max(this._peakHold - 0.005, peak)
    }

    return { rms, peak: this._peakHold, dbfs: gainToDb(rms) }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.gainNode.disconnect()
    this.panNode.disconnect()
    this.analyserNode.disconnect()
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private _applyGain(): void {
    const silent = this._muted || this._soloMuted
    const target = silent ? 0 : dbToGain(this._gainDb)
    this.gainNode.gain.setTargetAtTime(target, this.engine.ctx.currentTime, 0.005)
  }
}

// ─── TrackMixer ──────────────────────────────────────────────────────────────

export class TrackMixer {
  private readonly engine:   AudioEngine
  private _channels: Map<string, TrackChannel> = new Map()

  constructor(engine: AudioEngine) {
    this.engine = engine
  }

  // ── Channel management ──────────────────────────────────────────────────

  addChannel(id: string): TrackChannel {
    if (this._channels.has(id)) return this._channels.get(id)!
    const ch = new TrackChannel(id, this.engine)
    this._channels.set(id, ch)
    return ch
  }

  removeChannel(id: string): void {
    const ch = this._channels.get(id)
    if (ch) { ch.dispose(); this._channels.delete(id) }
  }

  getChannel(id: string): TrackChannel | undefined {
    return this._channels.get(id)
  }

  getOrCreate(id: string): TrackChannel {
    return this._channels.get(id) ?? this.addChannel(id)
  }

  get channelIds(): string[] { return [...this._channels.keys()] }

  // ── Solo logic ──────────────────────────────────────────────────────────

  /**
   * Call after any mute/solo state change.
   * If any track is soloed, all non-soloed tracks are "solo-muted".
   */
  updateSolo(): void {
    const anySoloed = [...this._channels.values()].some(ch => ch['_soloed'])
    for (const ch of this._channels.values()) {
      ch.setSoloMuted(anySoloed && !ch['_soloed'])
    }
  }

  // ── Bulk apply ──────────────────────────────────────────────────────────

  applyAll(configs: { id: string; cfg: TrackChannelConfig }[]): void {
    for (const { id, cfg } of configs) {
      this.getOrCreate(id).apply(cfg)
    }
    this.updateSolo()
  }

  // ── Metering ────────────────────────────────────────────────────────────

  getAllLevels(): Record<string, ChannelLevel> {
    const out: Record<string, ChannelLevel> = {}
    for (const [id, ch] of this._channels) out[id] = ch.getLevel()
    return out
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  dispose(): void {
    for (const ch of this._channels.values()) ch.dispose()
    this._channels.clear()
  }
}
