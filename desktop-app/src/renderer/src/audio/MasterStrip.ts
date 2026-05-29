// ─── MasterStrip.ts ───────────────────────────────────────────────────────────
// Browser-only: requires Web Audio API.
// Final master output strip with limiter and metering.

import { dBToLinear } from './mixerMath.ts'
import type { ChannelLevel } from './ChannelStrip.ts'

export class MasterStrip {
  readonly gainNode: GainNode
  readonly limiter:  DynamicsCompressorNode
  readonly analyser: AnalyserNode
  private _gainDb    = 0
  private _buf:      Float32Array

  constructor(ctx: AudioContext) {
    this.gainNode = ctx.createGain()
    this.limiter  = ctx.createDynamicsCompressor()
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 256
    this._buf = new Float32Array(this.analyser.fftSize)

    // Default limiter settings
    this.limiter.threshold.value = -1
    this.limiter.knee.value      = 0
    this.limiter.ratio.value     = 20
    this.limiter.attack.value    = 0.001
    this.limiter.release.value   = 0.05

    // Routing: gainNode → limiter → analyser → destination
    this.gainNode.connect(this.limiter)
    this.limiter.connect(this.analyser)
    this.analyser.connect(ctx.destination)
  }

  setMasterGainDb(db: number): void {
    this._gainDb = db
    this.gainNode.gain.setTargetAtTime(dBToLinear(db), this.gainNode.context.currentTime, 0.005)
  }

  enableLimiter(enabled: boolean): void {
    // When disabled: bypass limiter by setting ratio to 1 (no compression)
    this.limiter.ratio.value = enabled ? 20 : 1
  }

  setLimiterThreshold(db: number): void {
    this.limiter.threshold.value = db
  }

  getLevel(): ChannelLevel {
    this.analyser.getFloatTimeDomainData(this._buf)
    let peak = 0, rms = 0
    for (let i = 0; i < this._buf.length; i++) {
      const abs = Math.abs(this._buf[i])
      if (abs > peak) peak = abs
      rms += this._buf[i] * this._buf[i]
    }
    rms = Math.sqrt(rms / this._buf.length)
    return { peakL: peak, peakR: peak, rmsL: rms, rmsR: rms }
  }

  dispose(): void {
    this.gainNode.disconnect()
    this.limiter.disconnect()
    this.analyser.disconnect()
  }
}
