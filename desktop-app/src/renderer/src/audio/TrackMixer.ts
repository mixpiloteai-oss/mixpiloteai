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

  // Lazy AnalyserNode — only created when metering is enabled
  private _analyserNode: AnalyserNode | null = null
  private _analyserEnabled = false

  private readonly engine:    AudioEngine
  private _gainDb  = 0
  private _pan     = 0
  private _muted   = false
  private _soloed  = false
  private _soloMuted = false   // muted by mixer solo logic (not user mute)

  private _analyserBuf:  Float32Array<ArrayBuffer> | null = null
  private _peakHold    = 0
  private _peakTime    = 0

  constructor(id: string, engine: AudioEngine) {
    this.id     = id
    this.engine = engine

    this.gainNode = engine.ctx.createGain()
    this.panNode  = engine.ctx.createStereoPanner()

    // Chain: gain → pan → master bus (analyser inserted lazily on enableMetering)
    this.gainNode.connect(this.panNode)
    this.panNode.connect(engine.masterInput)
  }

  /** Enable per-track level metering (creates AnalyserNode on demand). */
  enableMetering(): void {
    if (this._analyserEnabled) return
    this._analyserEnabled = true
    const analyser = this.engine.ctx.createAnalyser()
    analyser.fftSize               = 128
    analyser.smoothingTimeConstant = 0.0
    this._analyserNode = analyser
    this._analyserBuf  = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
    // Re-wire: pan → analyser → master
    this.panNode.disconnect()
    this.panNode.connect(analyser)
    analyser.connect(this.engine.masterInput)
  }

  /** Disable per-track metering (disconnects AnalyserNode). */
  disableMetering(): void {
    if (!this._analyserEnabled || !this._analyserNode) return
    this._analyserEnabled = false
    const analyser = this._analyserNode
    this._analyserNode = null
    this._analyserBuf  = null
    // Re-wire: pan → master (bypass analyser)
    this.panNode.disconnect()
    analyser.disconnect()
    this.panNode.connect(this.engine.masterInput)
  }

  /** Backward-compat accessor (may be null when metering disabled). */
  get analyserNode(): AnalyserNode | null { return this._analyserNode }

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

  /** Call from rAF — not from Zustand/React render. Returns silence if metering is disabled. */
  getLevel(): ChannelLevel {
    if (!this._analyserEnabled || !this._analyserNode || !this._analyserBuf) {
      return { rms: 0, peak: 0, dbfs: -Infinity }
    }

    this._analyserNode.getFloatTimeDomainData(this._analyserBuf)

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
    this._analyserNode?.disconnect()
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
  private _soloSet:  Set<string> = new Set()   // cache for solo optimization

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
   * Uses _soloSet cache to skip full iteration when solo state is unchanged.
   */
  updateSolo(): void {
    // Build new solo set
    const newSoloSet = new Set<string>()
    for (const [id, ch] of this._channels) {
      if (ch['_soloed']) newSoloSet.add(id)
    }

    // Skip full update if the solo set is identical in size and membership
    if (newSoloSet.size === this._soloSet.size) {
      let same = true
      for (const id of newSoloSet) {
        if (!this._soloSet.has(id)) { same = false; break }
      }
      if (same) return
    }

    this._soloSet = newSoloSet
    const anySoloed = this._soloSet.size > 0
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
