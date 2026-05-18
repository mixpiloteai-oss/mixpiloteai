/**
 * BusRouter — send/return bus routing
 *
 * Signal flow per track:
 *   TrackChannel → [pre-fader sends] → track fader → [post-fader sends] → bus/master
 *
 * Each bus aggregates its senders, applies its own gain/pan/FX,
 * then routes to the master or another bus.
 */

import { AudioEngine, dbToGain, gainToDb, clamp } from './AudioEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusConfig {
  id:      string
  name:    string
  gainDb:  number
  pan:     number   // -1 to +1
  color?:  string
}

export interface SendConfig {
  fromId:    string
  toId:      string
  gainDb:    number
  preFader:  boolean
  enabled:   boolean
}

export interface BusLevel {
  rms:   number
  peak:  number
  dbfs:  number
}

// ─── BusChannel ───────────────────────────────────────────────────────────────

export class BusChannel {
  readonly id:           string
  readonly name:         string
  readonly input:        GainNode      // connect sources here
  readonly gainNode:     GainNode
  readonly panNode:      StereoPannerNode
  readonly analyser:     AnalyserNode

  private _gainDb      = 0
  private _pan         = 0
  private _muted       = false
  private _analyserBuf: Float32Array<ArrayBuffer>
  private _peakHold    = 0
  private _peakTime    = 0

  constructor(id: string, name: string, engine: AudioEngine, destination: AudioNode) {
    this.id   = id
    this.name = name
    const ctx = engine.ctx

    this.input    = ctx.createGain()
    this.gainNode = ctx.createGain()
    this.panNode  = ctx.createStereoPanner()
    this.analyser = ctx.createAnalyser()

    this.analyser.fftSize               = 256
    this.analyser.smoothingTimeConstant = 0

    // Chain: input → gain → pan → analyser → destination
    this.input.connect(this.gainNode)
    this.gainNode.connect(this.panNode)
    this.panNode.connect(this.analyser)
    this.analyser.connect(destination)

    this._analyserBuf = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>
  }

  setGain(db: number): void {
    this._gainDb = clamp(db, -60, 12)
    if (!this._muted) {
      this.gainNode.gain.setTargetAtTime(dbToGain(this._gainDb), this.gainNode.context.currentTime, 0.005)
    }
  }

  setPan(pan: number): void {
    this._pan = clamp(pan, -1, 1)
    this.panNode.pan.setTargetAtTime(this._pan, this.panNode.context.currentTime, 0.005)
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    this.gainNode.gain.setTargetAtTime(
      muted ? 0 : dbToGain(this._gainDb),
      this.gainNode.context.currentTime, 0.005,
    )
  }

  getLevel(): BusLevel {
    this.analyser.getFloatTimeDomainData(this._analyserBuf)
    let sumSq = 0, peak = 0
    for (let i = 0; i < this._analyserBuf.length; i++) {
      const v = Math.abs(this._analyserBuf[i])
      sumSq += v * v
      if (v > peak) peak = v
    }
    const rms = Math.sqrt(sumSq / this._analyserBuf.length)
    const now = performance.now()
    if (peak >= this._peakHold) { this._peakHold = peak; this._peakTime = now }
    else if (now - this._peakTime > 1500) { this._peakHold = Math.max(this._peakHold - 0.005, peak) }
    return { rms, peak: this._peakHold, dbfs: gainToDb(rms) }
  }

  dispose(): void {
    this.input.disconnect()
    this.gainNode.disconnect()
    this.panNode.disconnect()
    this.analyser.disconnect()
  }
}

// ─── Send ─────────────────────────────────────────────────────────────────────

class Send {
  readonly id:        string
  readonly gainNode:  GainNode
  readonly preFader:  boolean
  enabled:            boolean

  constructor(id: string, ctx: AudioContext, preFader: boolean, gainDb: number, enabled: boolean) {
    this.id       = id
    this.preFader = preFader
    this.enabled  = enabled
    this.gainNode = ctx.createGain()
    this.gainNode.gain.value = enabled ? dbToGain(gainDb) : 0
  }

  setGain(db: number): void {
    if (this.enabled) {
      this.gainNode.gain.setTargetAtTime(dbToGain(db), this.gainNode.context.currentTime, 0.005)
    }
  }

  setEnabled(enabled: boolean, gainDb: number): void {
    this.enabled = enabled
    this.gainNode.gain.setTargetAtTime(
      enabled ? dbToGain(gainDb) : 0,
      this.gainNode.context.currentTime, 0.005,
    )
  }

  dispose(): void { this.gainNode.disconnect() }
}

// ─── BusRouter ────────────────────────────────────────────────────────────────

export class BusRouter {
  private readonly engine: AudioEngine
  private buses:  Map<string, BusChannel>                    = new Map()
  private sends:  Map<string, Map<string, { send: Send; gainDb: number }>> = new Map()

  constructor(engine: AudioEngine) {
    this.engine = engine
  }

  // ── Bus management ───────────────────────────────────────────────────────

  addBus(cfg: BusConfig): BusChannel {
    if (this.buses.has(cfg.id)) return this.buses.get(cfg.id)!
    const bus = new BusChannel(cfg.id, cfg.name, this.engine, this.engine.masterInput)
    bus.setGain(cfg.gainDb)
    bus.setPan(cfg.pan)
    this.buses.set(cfg.id, bus)
    return bus
  }

  removeBus(id: string): void {
    const bus = this.buses.get(id)
    if (!bus) return
    bus.dispose()
    this.buses.delete(id)
    // Remove all sends TO this bus
    for (const [, sendsMap] of this.sends) {
      const s = sendsMap.get(id)
      if (s) { s.send.dispose(); sendsMap.delete(id) }
    }
  }

  getBus(id: string): BusChannel | undefined { return this.buses.get(id) }
  getBusIds(): string[] { return [...this.buses.keys()] }

  // ── Send management ──────────────────────────────────────────────────────

  addSend(cfg: SendConfig, preFaderSourceNode: AudioNode, postFaderSourceNode: AudioNode): void {
    const bus = this.buses.get(cfg.toId)
    if (!bus) { console.warn(`[BusRouter] bus "${cfg.toId}" not found`); return }

    if (!this.sends.has(cfg.fromId)) this.sends.set(cfg.fromId, new Map())
    const fromSends = this.sends.get(cfg.fromId)!

    if (fromSends.has(cfg.toId)) {
      fromSends.get(cfg.toId)!.send.dispose()
    }

    const send = new Send(`${cfg.fromId}→${cfg.toId}`, this.engine.ctx, cfg.preFader, cfg.gainDb, cfg.enabled)
    const sourceNode = cfg.preFader ? preFaderSourceNode : postFaderSourceNode
    sourceNode.connect(send.gainNode)
    send.gainNode.connect(bus.input)

    fromSends.set(cfg.toId, { send, gainDb: cfg.gainDb })
  }

  removeSend(fromId: string, toId: string): void {
    const s = this.sends.get(fromId)?.get(toId)
    if (s) { s.send.dispose(); this.sends.get(fromId)!.delete(toId) }
  }

  setSendGain(fromId: string, toId: string, db: number): void {
    const entry = this.sends.get(fromId)?.get(toId)
    if (entry) { entry.gainDb = db; entry.send.setGain(db) }
  }

  setSendEnabled(fromId: string, toId: string, enabled: boolean): void {
    const entry = this.sends.get(fromId)?.get(toId)
    if (entry) entry.send.setEnabled(enabled, entry.gainDb)
  }

  // ── Metering ─────────────────────────────────────────────────────────────

  getAllBusLevels(): Record<string, BusLevel> {
    const out: Record<string, BusLevel> = {}
    for (const [id, bus] of this.buses) out[id] = bus.getLevel()
    return out
  }

  dispose(): void {
    for (const [, sendsMap] of this.sends) {
      for (const [, { send }] of sendsMap) send.dispose()
    }
    for (const bus of this.buses.values()) bus.dispose()
    this.buses.clear()
    this.sends.clear()
  }
}
