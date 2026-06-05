/**
 * BusTrackNode — bus / return channel
 *
 * A bus aggregates multiple track sends and applies its own gain, pan,
 * and optional effects before routing to the master bus.
 *
 * Signal chain:
 *   [track sends] → input → gainNode → panNode → analyser → destination (master or another bus)
 */

import { AudioEngine, dbToGain, gainToDb, clamp } from '../AudioEngine'
import type { ChannelLevel } from '../types'

export type BusType = 'return' | 'group' | 'master'

export class BusTrackNode {
  readonly id:           string
  readonly name:         string
  readonly type:         BusType

  /** Connect send gain nodes here. */
  readonly input:        GainNode
  readonly gainNode:     GainNode
  readonly panNode:      StereoPannerNode
  readonly analyserNode: AnalyserNode

  private readonly engine: AudioEngine
  private _gainDb    = 0
  private _pan       = 0
  private _muted     = false

  private _analyserBuf: Float32Array<ArrayBuffer>
  private _peakHold    = 0
  private _peakTime    = 0

  constructor(
    id: string, name: string, type: BusType,
    engine: AudioEngine, destination: AudioNode,
  ) {
    this.id     = id
    this.name   = name
    this.type   = type
    this.engine = engine
    const ctx   = engine.ctx

    this.input        = ctx.createGain()
    this.gainNode     = ctx.createGain()
    this.panNode      = ctx.createStereoPanner()
    this.analyserNode = ctx.createAnalyser()

    this.analyserNode.fftSize               = 256
    this.analyserNode.smoothingTimeConstant = 0

    this.input.connect(this.gainNode)
    this.gainNode.connect(this.panNode)
    this.panNode.connect(this.analyserNode)
    this.analyserNode.connect(destination)

    this._analyserBuf = new Float32Array(this.analyserNode.fftSize) as Float32Array<ArrayBuffer>
  }

  setGain(db: number): void {
    this._gainDb = clamp(db, -60, 12)
    if (!this._muted) {
      this.gainNode.gain.setTargetAtTime(dbToGain(this._gainDb), this.engine.ctx.currentTime, 0.005)
    }
  }

  setPan(pan: number): void {
    this._pan = clamp(pan, -1, 1)
    this.panNode.pan.setTargetAtTime(this._pan, this.engine.ctx.currentTime, 0.005)
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    this.gainNode.gain.setTargetAtTime(
      muted ? 0 : dbToGain(this._gainDb),
      this.engine.ctx.currentTime, 0.005,
    )
  }

  get gainDb(): number  { return this._gainDb }
  get pan():    number  { return this._pan }
  get muted():  boolean { return this._muted }

  /** Connect a source to this bus (called from TrackManager when adding a send). */
  connectSource(source: AudioNode): void { source.connect(this.input) }
  disconnectSource(source: AudioNode): void {
    try { source.disconnect(this.input) } catch { /* not connected */ }
  }

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

  dispose(): void {
    this.input.disconnect()
    this.gainNode.disconnect()
    this.panNode.disconnect()
    this.analyserNode.disconnect()
  }
}
