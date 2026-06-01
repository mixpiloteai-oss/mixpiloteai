// ─── StereoAnalyzer ───────────────────────────────────────────────────────────
// Stereo correlation, width, phase issues, and goniometer data.

export interface StereoResult {
  correlation:       number   // Pearson -1 to +1
  midEnergy:         number
  sideEnergy:        number
  stereoWidth:       number   // sideEnergy / (midEnergy + sideEnergy)
  balance:           number   // (rmsR - rmsL) / (rmsR + rmsL)
  monoCompatibility: number   // (1 + correlation) / 2
}

export interface PhaseIssue {
  startSample: number
  endSample:   number
  correlation: number
  severity:    'warning' | 'critical'
}

export interface GoniometerData {
  mid:  Float32Array  // (L+R)*0.707
  side: Float32Array  // (L-R)*0.707
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rms(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const s = buf[i] ?? 0
    sum += s * s
  }
  return Math.sqrt(sum / buf.length)
}

function pearsonCorrelation(left: Float32Array, right: Float32Array): number {
  const N = Math.min(left.length, right.length)
  if (N === 0) return 0

  let sumLR = 0
  let sumL2 = 0
  let sumR2 = 0

  for (let i = 0; i < N; i++) {
    const l = left[i] ?? 0
    const r = right[i] ?? 0
    sumLR += l * r
    sumL2 += l * l
    sumR2 += r * r
  }

  const denom = Math.sqrt(sumL2 * sumR2)
  if (denom === 0) return 0
  return sumLR / denom
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class StereoAnalyzer {
  analyzeStereo(left: Float32Array, right: Float32Array): StereoResult {
    const N = Math.min(left.length, right.length)

    const correlation = pearsonCorrelation(left, right)

    // Mid/Side energy
    let sumMid2 = 0
    let sumSide2 = 0
    for (let i = 0; i < N; i++) {
      const l = left[i] ?? 0
      const r = right[i] ?? 0
      const mid  = (l + r) * 0.707
      const side = (l - r) * 0.707
      sumMid2  += mid * mid
      sumSide2 += side * side
    }

    const midEnergy  = N > 0 ? sumMid2 / N : 0
    const sideEnergy = N > 0 ? sumSide2 / N : 0
    const total      = midEnergy + sideEnergy

    const stereoWidth = total > 0 ? sideEnergy / total : 0

    const rmsLeft  = rms(left.subarray(0, N))
    const rmsRight = rms(right.subarray(0, N))
    const rmsSum   = rmsLeft + rmsRight
    const balance  = rmsSum > 0 ? (rmsRight - rmsLeft) / rmsSum : 0

    const monoCompatibility = (1 + correlation) / 2

    return { correlation, midEnergy, sideEnergy, stereoWidth, balance, monoCompatibility }
  }

  /**
   * Scan 100ms windows for phase issues.
   * correlation < -0.3 → 'warning', < -0.6 → 'critical'
   */
  detectPhaseIssues(left: Float32Array, right: Float32Array, sampleRate = 44100): PhaseIssue[] {
    const windowSamples = Math.floor(sampleRate * 0.1)
    const N = Math.min(left.length, right.length)
    const issues: PhaseIssue[] = []

    for (let start = 0; start + windowSamples <= N; start += windowSamples) {
      const lWin = left.subarray(start, start + windowSamples)
      const rWin = right.subarray(start, start + windowSamples)
      const corr = pearsonCorrelation(lWin, rWin)

      if (corr < -0.3) {
        issues.push({
          startSample: start,
          endSample:   start + windowSamples,
          correlation: corr,
          severity:    corr < -0.6 ? 'critical' : 'warning',
        })
      }
    }

    return issues
  }

  /**
   * Compute goniometer (Lissajous) data for visualization.
   * Optionally downsample by factor for rendering efficiency.
   */
  computeGoniometer(
    left: Float32Array,
    right: Float32Array,
    downsample = 4,
  ): GoniometerData {
    const N    = Math.min(left.length, right.length)
    const size = Math.floor(N / downsample)
    const mid  = new Float32Array(size)
    const side = new Float32Array(size)

    for (let i = 0; i < size; i++) {
      const idx = i * downsample
      const l = left[idx] ?? 0
      const r = right[idx] ?? 0
      mid[i]  = (l + r) * 0.707
      side[i] = (l - r) * 0.707
    }

    return { mid, side }
  }
}

export const stereoAnalyzer = new StereoAnalyzer()
