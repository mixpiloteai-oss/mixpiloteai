// ─── LimiterProcessor ─────────────────────────────────────────────────────────
// Lookahead brickwall limiter for Float32Array channel buffers.
// Operates in-place on multi-channel audio to prevent true-peak violations.

export interface LimiterOptions {
  thresholdDb: number  // default: -0.3
  attackMs:    number  // default: 0.1
  releaseMs:   number  // default: 100
  lookaheadMs: number  // default: 3
  sampleRate:  number  // default: 44100
}

const DEFAULTS: LimiterOptions = {
  thresholdDb: -0.3,
  attackMs:    0.1,
  releaseMs:   100,
  lookaheadMs: 3,
  sampleRate:  44100,
}

export class LimiterProcessor {
  private readonly threshold: number  // linear
  private readonly attackCoef: number
  private readonly releaseCoef: number
  private readonly lookaheadSamples: number
  private currentGain: number = 1.0

  constructor(options: Partial<LimiterOptions> = {}) {
    const opts: LimiterOptions = { ...DEFAULTS, ...options }
    this.threshold = Math.pow(10, opts.thresholdDb / 20)
    this.attackCoef = Math.exp(-1 / (opts.sampleRate * opts.attackMs / 1000))
    this.releaseCoef = Math.exp(-1 / (opts.sampleRate * opts.releaseMs / 1000))
    this.lookaheadSamples = Math.round(opts.sampleRate * opts.lookaheadMs / 1000)
    this.currentGain = 1.0
  }

  /**
   * Process multi-channel audio through the brickwall limiter.
   * Modifies channels in-place and returns the same arrays.
   */
  process(channels: Float32Array[]): Float32Array[] {
    if (channels.length === 0) return channels
    const length = channels[0]!.length

    for (let i = 0; i < length; i++) {
      // Find maximum absolute value across all channels at this sample position
      // with lookahead: look ahead by lookaheadSamples to compute target gain
      const lookaheadIdx = Math.min(i + this.lookaheadSamples, length - 1)
      let maxAbs = 0
      for (const ch of channels) {
        const v = Math.abs(ch[lookaheadIdx]!)
        if (v > maxAbs) maxAbs = v
      }

      // Compute target gain reduction
      const targetGain = maxAbs > this.threshold
        ? this.threshold / maxAbs
        : 1.0

      // Smooth gain with attack/release envelope
      if (targetGain < this.currentGain) {
        // Attack: fast gain reduction
        this.currentGain = targetGain * (1 - this.attackCoef) + this.currentGain * this.attackCoef
      } else {
        // Release: slow gain recovery
        this.currentGain = targetGain * (1 - this.releaseCoef) + this.currentGain * this.releaseCoef
      }

      // Clamp gain to [0, 1]
      const gain = Math.min(1, this.currentGain)

      // Apply gain to all channels at current position
      for (const ch of channels) {
        ch[i] = ch[i]! * gain
      }
    }

    return channels
  }

  /**
   * Reset the limiter envelope state to unity gain.
   */
  reset(): void {
    this.currentGain = 1.0
  }

  /**
   * Current gain in dB (for metering purposes).
   */
  get currentGainDb(): number {
    return this.currentGain > 0
      ? 20 * Math.log10(this.currentGain)
      : -Infinity
  }
}
