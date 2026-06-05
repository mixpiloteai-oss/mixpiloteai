// ─── LoudnessMeter ────────────────────────────────────────────────────────────
// Loudness analysis for rendered Float32Array buffers.
// Measures RMS, peak, true peak (4x oversampled), approximate LUFS, dynamic range.

export interface LoudnessMeasurement {
  rmsDb:        number  // RMS level in dB
  peakDb:       number  // Peak absolute value in dB
  truePeakDb:   number  // 4x oversampled true peak in dB
  lufsApprox:   number  // Approximate LUFS (simplified K-weighted)
  dynamicRange: number  // peakDb - rmsDb
  crestFactor:  number  // truePeakDb - rmsDb
}

export class LoudnessMeter {
  /**
   * Measure RMS level of a single channel in dB.
   * Returns -Infinity for silence.
   */
  measureRms(channel: Float32Array): number {
    if (channel.length === 0) return -Infinity
    let sumSq = 0
    for (let i = 0; i < channel.length; i++) {
      sumSq += channel[i]! * channel[i]!
    }
    const rms = Math.sqrt(sumSq / channel.length)
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity
  }

  /**
   * Measure peak absolute value of a single channel in dB.
   * Returns -Infinity for silence.
   */
  measurePeak(channel: Float32Array): number {
    let peak = 0
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i]!)
      if (abs > peak) peak = abs
    }
    return peak > 0 ? 20 * Math.log10(peak) : -Infinity
  }

  /**
   * Compute 4x oversampled true peak of a buffer.
   * Uses linear interpolation between adjacent samples to find inter-sample peaks.
   */
  private computeTruePeak(channel: Float32Array): number {
    let maxAbs = 0
    const length = channel.length

    for (let i = 0; i < length - 1; i++) {
      const s0 = channel[i]!
      const s1 = channel[i + 1]!
      // Check 4 sub-samples via linear interpolation
      for (let k = 0; k < 4; k++) {
        const frac = k / 4
        const interp = s0 + (s1 - s0) * frac
        const abs = Math.abs(interp)
        if (abs > maxAbs) maxAbs = abs
      }
    }

    // Also check the last sample
    if (length > 0) {
      const lastAbs = Math.abs(channel[length - 1]!)
      if (lastAbs > maxAbs) maxAbs = lastAbs
    }

    return maxAbs
  }

  /**
   * Measure integrated loudness and produce a complete loudness measurement.
   *
   * @param channels    - Multi-channel audio buffers
   * @param sampleRate  - Sample rate in Hz (used for K-weighting approximation)
   * @returns LoudnessMeasurement with all loudness metrics
   */
  measureIntegratedLoudness(channels: Float32Array[], sampleRate: number): LoudnessMeasurement {
    if (channels.length === 0 || channels[0]!.length === 0) {
      return {
        rmsDb: -Infinity,
        peakDb: -Infinity,
        truePeakDb: -Infinity,
        lufsApprox: -Infinity,
        dynamicRange: 0,
        crestFactor: 0,
      }
    }

    // Compute per-channel RMS and peak
    let totalRmsSq = 0
    let peakLinear = 0
    let truePeakLinear = 0

    for (const ch of channels) {
      // RMS
      let sumSq = 0
      for (let i = 0; i < ch.length; i++) sumSq += ch[i]! * ch[i]!
      totalRmsSq += sumSq / ch.length

      // Peak
      for (let i = 0; i < ch.length; i++) {
        const abs = Math.abs(ch[i]!)
        if (abs > peakLinear) peakLinear = abs
      }

      // True peak
      const tp = this.computeTruePeak(ch)
      if (tp > truePeakLinear) truePeakLinear = tp
    }

    const rmsLinear = Math.sqrt(totalRmsSq / channels.length)
    const rmsDb = rmsLinear > 0 ? 20 * Math.log10(rmsLinear) : -Infinity
    const peakDb = peakLinear > 0 ? 20 * Math.log10(peakLinear) : -Infinity
    const truePeakDb = truePeakLinear > 0 ? 20 * Math.log10(truePeakLinear) : -Infinity

    // Approximate LUFS using simplified K-weighting
    // K-weighting approximation: apply single-pole highpass at 60 Hz, then measure mean power
    const hpCoef = 1 - Math.exp(-2 * Math.PI * 60 / sampleRate)
    let kWeightedPower = 0
    let kWeightedCount = 0

    for (const ch of channels) {
      let prevFiltered = 0
      let sumPower = 0
      for (let i = 0; i < ch.length; i++) {
        // Simple first-order highpass: y[n] = x[n] - (1-hpCoef)*x[n-1] + (1-hpCoef)*y[n-1]
        const filtered = ch[i]! - (1 - hpCoef) * (ch[i > 0 ? i - 1 : 0] ?? 0) + (1 - hpCoef) * prevFiltered
        prevFiltered = filtered
        sumPower += filtered * filtered
      }
      kWeightedPower += sumPower / ch.length
      kWeightedCount++
    }

    const meanPower = kWeightedCount > 0 ? kWeightedPower / kWeightedCount : 0
    const lufsApprox = meanPower > 0 ? -0.691 + 10 * Math.log10(meanPower) : -Infinity

    const dynamicRange = isFinite(peakDb) && isFinite(rmsDb) ? peakDb - rmsDb : 0
    const crestFactor = isFinite(truePeakDb) && isFinite(rmsDb) ? truePeakDb - rmsDb : 0

    return { rmsDb, peakDb, truePeakDb, lufsApprox, dynamicRange, crestFactor }
  }
}

/** Singleton instance for convenience. */
export const loudnessMeter = new LoudnessMeter()
