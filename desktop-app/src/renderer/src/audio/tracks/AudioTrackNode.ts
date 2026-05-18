/**
 * AudioTrackNode — single audio track DSP chain
 *
 * Signal chain:
 *   AudioBufferSource(s) ──→ preFaderGain ──→ gainNode (fader) ──→ panNode ──→ analyser ──→ master/bus
 *                                  ↓ (pre-fader sends)
 *                             BusRouter sends
 *
 * Supports clip playback, punch-in/out, and plugin chain insertion points.
 */

import { AudioEngine, dbToGain, gainToDb, clamp } from '../AudioEngine'
import type { ChannelLevel } from '../types'

export interface AudioClipSchedule {
  buffer:       AudioBuffer
  startContextTime: number  // AudioContext.currentTime to start playback
  offsetSec:    number      // offset into the buffer
  durationSec?: number      // optional clip length limit
}

export class AudioTrackNode {
  readonly id:             string
  readonly name:           string

  // Node graph
  readonly preFaderNode:   GainNode      // pre-fader tap (for sends)
  readonly gainNode:       GainNode      // fader
  readonly panNode:        StereoPannerNode
  readonly analyserNode:   AnalyserNode
  /** Connect sources (AudioBufferSources, plugin chains) here. */
  readonly input:          GainNode

  private readonly engine: AudioEngine
  private _gainDb          = 0
  private _pan             = 0
  private _muted           = false
  private _soloed          = false
  private _soloMuted       = false
  private _armed           = false

  private _activeSources:  Set<AudioBufferSourceNode> = new Set()
  private _analyserBuf:    Float32Array<ArrayBuffer>
  private _peakHold        = 0
  private _peakTime        = 0

  constructor(id: string, name: string, engine: AudioEngine, destination: AudioNode) {
    this.id      = id
    this.name    = name
    this.engine  = engine
    const ctx    = engine.ctx

    this.input        = ctx.createGain()
    this.preFaderNode = ctx.createGain()
    this.gainNode     = ctx.createGain()
    this.panNode      = ctx.createStereoPanner()
    this.analyserNode = ctx.createAnalyser()

    this.analyserNode.fftSize               = 256
    this.analyserNode.smoothingTimeConstant = 0

    // Chain
    this.input.connect(this.preFaderNode)    // tap pre-fader
    this.preFaderNode.connect(this.gainNode) // fader
    this.gainNode.connect(this.panNode)
    this.panNode.connect(this.analyserNode)
    this.analyserNode.connect(destination)

    this._analyserBuf = new Float32Array(this.analyserNode.fftSize) as Float32Array<ArrayBuffer>
  }

  // ── Fader / pan ───────────────────────────────────────────────────────────

  setGain(db: number): void {
    this._gainDb = clamp(db, -60, 12)
    this._applyGain()
  }

  setPan(pan: number): void {
    this._pan = clamp(pan, -1, 1)
    this.panNode.pan.setTargetAtTime(this._pan, this.engine.ctx.currentTime, 0.005)
  }

  setMuted(muted: boolean): void    { this._muted   = muted;      this._applyGain() }
  setSoloed(soloed: boolean): void  { this._soloed  = soloed }
  setSoloMuted(sm: boolean): void   { this._soloMuted = sm;       this._applyGain() }
  setArmed(armed: boolean): void    { this._armed   = armed }

  get gainDb():  number  { return this._gainDb }
  get pan():     number  { return this._pan }
  get muted():   boolean { return this._muted }
  get soloed():  boolean { return this._soloed }
  get armed():   boolean { return this._armed }

  // ── Clip scheduling ───────────────────────────────────────────────────────

  scheduleClip(sched: AudioClipSchedule): AudioBufferSourceNode {
    const src = this.engine.ctx.createBufferSource()
    src.buffer = sched.buffer
    src.connect(this.input)

    const startTime = Math.max(this.engine.ctx.currentTime, sched.startContextTime)
    src.start(startTime, sched.offsetSec, sched.durationSec)

    this._activeSources.add(src)
    src.onended = () => { src.disconnect(); this._activeSources.delete(src) }

    return src
  }

  stopAllClips(fadeMs = 10): void {
    const now        = this.engine.ctx.currentTime
    const fadeSec    = fadeMs / 1000
    for (const src of this._activeSources) {
      try { src.stop(now + fadeSec) } catch { /* already stopped */ }
    }
  }

  // ── Metering ─────────────────────────────────────────────────────────────

  getLevel(): ChannelLevel {
    this.analyserNode.getFloatTimeDomainData(this._analyserBuf)
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

  // ── Internal ──────────────────────────────────────────────────────────────

  private _applyGain(): void {
    const silent = this._muted || this._soloMuted
    const target = silent ? 0 : dbToGain(this._gainDb)
    this.gainNode.gain.setTargetAtTime(target, this.engine.ctx.currentTime, 0.005)
  }

  dispose(): void {
    this.stopAllClips(0)
    this.input.disconnect()
    this.preFaderNode.disconnect()
    this.gainNode.disconnect()
    this.panNode.disconnect()
    this.analyserNode.disconnect()
  }
}
