// ─── ChannelStrip.ts ──────────────────────────────────────────────────────────
// Browser-only: requires Web Audio API. Not testable in Node.
// Provides a typed audio-graph channel strip used by MixerEngine.

import { dBToLinear } from './mixerMath.ts'

export interface ChannelLevel {
  peakL: number
  peakR: number
  rmsL:  number
  rmsR:  number
}

export class ChannelStrip {
  readonly id:        string
  readonly input:     GainNode
  readonly gainNode:  GainNode
  readonly panNode:   StereoPannerNode
  readonly analyserL: AnalyserNode
  readonly analyserR: AnalyserNode
  private _gainDb     = 0
  private _pan        = 0
  private _muted      = false
  private _phaseGain: GainNode
  private _bufL:      Float32Array
  private _bufR:      Float32Array

  constructor(id: string, ctx: AudioContext, destination: AudioNode) {
    this.id         = id
    this.input      = ctx.createGain()
    this.gainNode   = ctx.createGain()
    this.panNode    = ctx.createStereoPanner()
    this._phaseGain = ctx.createGain()
    this.analyserL  = ctx.createAnalyser()
    this.analyserR  = ctx.createAnalyser()
    this.analyserL.fftSize = 256
    this.analyserR.fftSize = 256
    this._bufL = new Float32Array(this.analyserL.fftSize)
    this._bufR = new Float32Array(this.analyserR.fftSize)

    // Routing: input → gain → pan → phaseGain → analyserL → destination
    this.input.connect(this.gainNode)
    this.gainNode.connect(this.panNode)
    this.panNode.connect(this._phaseGain)
    this._phaseGain.connect(this.analyserL)
    this.analyserL.connect(destination)
  }

  setGainDb(db: number): void {
    this._gainDb = db
    const linear = this._muted ? 0 : dBToLinear(db)
    this.gainNode.gain.setTargetAtTime(linear, this.gainNode.context.currentTime, 0.005)
  }

  setPan(pan: number): void {
    this._pan = Math.max(-1, Math.min(1, pan))
    this.panNode.pan.setTargetAtTime(this._pan, this.panNode.context.currentTime, 0.005)
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    const linear = muted ? 0 : dBToLinear(this._gainDb)
    this.gainNode.gain.setTargetAtTime(linear, this.gainNode.context.currentTime, 0.005)
  }

  setPhaseInvert(invert: boolean): void {
    this._phaseGain.gain.value = invert ? -1 : 1
  }

  getLevel(): ChannelLevel {
    this.analyserL.getFloatTimeDomainData(this._bufL)
    let peakL = 0, rmsL = 0
    for (let i = 0; i < this._bufL.length; i++) {
      const abs = Math.abs(this._bufL[i])
      if (abs > peakL) peakL = abs
      rmsL += this._bufL[i] * this._bufL[i]
    }
    rmsL = Math.sqrt(rmsL / this._bufL.length)
    return { peakL, peakR: peakL, rmsL, rmsR: rmsL }
  }

  dispose(): void {
    this.input.disconnect()
    this.gainNode.disconnect()
    this.panNode.disconnect()
    this._phaseGain.disconnect()
    this.analyserL.disconnect()
  }
}
