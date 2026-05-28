/**
 * AudioTrackNode — single audio track DSP chain
 *
 * Signal chain:
 *   AudioBufferSource(s) ──→ input ──→ EqChain ──→ FxInsertChain ──→ preFaderGain ──→ gainNode (fader) ──→ panNode ──→ analyser ──→ master/bus
 *                                                                            ↓ (pre-fader sends)
 *                                                                       BusRouter sends
 *
 * Supports clip playback, punch-in/out, and plugin chain insertion points.
 */

import { AudioEngine, dbToGain, gainToDb, clamp } from '../AudioEngine'
import { EqChain }       from '../EqChain'
import { FxInsertChain } from '../FxInsertChain'
import { getWorkerPool } from '../WorkerPool'
import type { ChannelLevel } from '../types'
import type { EQBand }   from '../EqChain'

export interface AudioClipSchedule {
  buffer:       AudioBuffer
  startContextTime: number  // AudioContext.currentTime to start playback
  offsetSec:    number      // offset into the buffer
  durationSec?: number      // optional clip length limit
}

// Default flat EQ bands (all gain=0, disabled)
function defaultEqBands(): EQBand[] {
  return [
    { id: 'eq0', type: 'highpass',  freq: 80,   gain: 0, q: 0.7, enabled: false },
    { id: 'eq1', type: 'lowshelf',  freq: 200,  gain: 0, q: 1.0, enabled: false },
    { id: 'eq2', type: 'peaking',   freq: 1000, gain: 0, q: 1.0, enabled: false },
    { id: 'eq3', type: 'peaking',   freq: 4000, gain: 0, q: 1.0, enabled: false },
    { id: 'eq4', type: 'highshelf', freq: 8000, gain: 0, q: 0.7, enabled: false },
  ]
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

  // DSP insert chains
  readonly eq:  EqChain
  readonly fx:  FxInsertChain

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

    // Create EQ and FX insert chains
    this.eq = new EqChain(ctx, defaultEqBands())
    this.fx = new FxInsertChain(ctx)

    // Chain: input → EQ → FX → preFaderNode → gainNode → panNode → analyser → destination
    this.input.connect(this.eq.input)
    this.eq.output.connect(this.fx.input)
    this.fx.output.connect(this.preFaderNode)
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

  async scheduleClip(sched: AudioClipSchedule): Promise<AudioBufferSourceNode> {
    const ctx = this.engine.ctx
    let buffer = sched.buffer

    // Resample if the buffer's sample rate doesn't match the AudioContext rate
    if (buffer.sampleRate !== ctx.sampleRate) {
      const numChannels = buffer.numberOfChannels
      const targetLen   = Math.round(buffer.length * ctx.sampleRate / buffer.sampleRate)
      const pool        = getWorkerPool()

      const channelPromises = Array.from({ length: numChannels }, (_, ch) => {
        const samples = buffer.getChannelData(ch)
        // Copy to transfer without detaching original (slice makes a new ArrayBuffer)
        const copy = samples.slice(0)
        return pool.dispatch(
          { id: `resample-${this.id}-${ch}-${Date.now()}`, type: 'resample', payload: { samples: copy, targetLen } },
          [copy.buffer],
        )
      })

      const results = await Promise.all(channelPromises)
      const resampled = ctx.createBuffer(numChannels, targetLen, ctx.sampleRate)
      for (let ch = 0; ch < numChannels; ch++) {
        const r = results[ch]!
        if (r.type === 'resample') {
          resampled.copyToChannel(r.samples, ch)
        }
      }
      buffer = resampled
    }

    const src       = ctx.createBufferSource()
    src.buffer      = buffer
    const startTime = Math.max(ctx.currentTime, sched.startContextTime)

    // Anti-crackle ramp gain node
    const rampGain  = ctx.createGain()
    rampGain.gain.setValueAtTime(0, startTime)
    rampGain.gain.linearRampToValueAtTime(1, startTime + 0.002)

    if (sched.durationSec !== undefined) {
      const endTime = startTime + sched.durationSec
      rampGain.gain.setValueAtTime(1, endTime - 0.002)
      rampGain.gain.linearRampToValueAtTime(0, endTime)
    }

    src.connect(rampGain)
    rampGain.connect(this.input)

    src.start(startTime, sched.offsetSec, sched.durationSec)

    this._activeSources.add(src)
    src.onended = () => {
      src.disconnect()
      rampGain.disconnect()
      this._activeSources.delete(src)
    }

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
    this.eq.dispose()
    this.fx.dispose()
    this.preFaderNode.disconnect()
    this.gainNode.disconnect()
    this.panNode.disconnect()
    this.analyserNode.disconnect()
  }
}
