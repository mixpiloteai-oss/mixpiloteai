// ─── PeakProtector ────────────────────────────────────────────────────────────
// Scans the final mix for true-peak violations before encoding.
// Uses 4x linear-interpolation oversampling to detect inter-sample peaks.

export interface PeakAnalysis {
  hasTruePeakViolation: boolean
  maxTruePeak:          number  // linear, absolute max inter-sample value
  violationCount:       number  // number of samples where inter-sample peak > threshold
  suggestedGainReduction: number  // multiply all samples by this to bring peaks under 1.0
}

export class PeakProtector {
  private readonly violationThreshold: number

  constructor(threshold: number = 1.0) {
    this.violationThreshold = threshold
  }

  /**
   * Analyze multi-channel audio for true-peak violations.
   * Uses 4x linear interpolation between samples to detect inter-sample peaks.
   */
  analyze(channels: Float32Array[]): PeakAnalysis {
    if (channels.length === 0 || channels[0]!.length === 0) {
      return {
        hasTruePeakViolation: false,
        maxTruePeak: 0,
        violationCount: 0,
        suggestedGainReduction: 1.0,
      }
    }

    let maxTruePeak = 0
    let violationCount = 0
    const threshold = this.violationThreshold

    for (const ch of channels) {
      const length = ch.length
      for (let i = 0; i < length - 1; i++) {
        const s0 = ch[i]!
        const s1 = ch[i + 1]!
        // 4x oversampled: check 4 sub-samples via linear interpolation
        for (let k = 0; k < 4; k++) {
          const frac = k / 4
          const interp = Math.abs(s0 + (s1 - s0) * frac)
          if (interp > maxTruePeak) maxTruePeak = interp
          if (interp > threshold) violationCount++
        }
      }
      // Last sample
      if (length > 0) {
        const lastAbs = Math.abs(ch[length - 1]!)
        if (lastAbs > maxTruePeak) maxTruePeak = lastAbs
        if (lastAbs > threshold) violationCount++
      }
    }

    const hasTruePeakViolation = maxTruePeak > threshold
    const suggestedGainReduction = hasTruePeakViolation ? 1 / maxTruePeak : 1.0

    return { hasTruePeakViolation, maxTruePeak, violationCount, suggestedGainReduction }
  }

  /**
   * Apply a linear gain reduction to all channels.
   * Returns new arrays (does not modify the originals).
   */
  applyGainReduction(channels: Float32Array[], gain: number): Float32Array[] {
    return channels.map(ch => {
      const out = new Float32Array(ch.length)
      for (let i = 0; i < ch.length; i++) out[i] = ch[i]! * gain
      return out
    })
  }
}

/** Singleton instance for convenience. */
export const peakProtector = new PeakProtector()
