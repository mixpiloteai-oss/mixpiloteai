// ─── DynamicsAnalyzer ─────────────────────────────────────────────────────────
// Real dynamics analysis: peak, RMS, LUFS, crest factor, dynamic range.

export interface DynamicsResult {
  peakDb:       number
  rmsDb:        number
  crestFactor:  number   // peakDb - rmsDb
  dynamicRange: number   // 95th percentile level - 5th percentile level
}

export interface ClippingResult {
  clippingEvents:     number
  clippingPercentage: number
  maxSample:          number
  isClipping:         boolean
}

// ─── K-weighting biquad coefficients (ITU-R BS.1770) ─────────────────────────
// Pre-filter: high-shelf boost ~+4 dB at 1500 Hz
const PRE_B0 =  1.53512485958697
const PRE_B1 = -2.69169618940638
const PRE_B2 =  1.19839281085285
const PRE_A1 = -1.69065929318241
const PRE_A2 =  0.73248077421585

// RLB (revised low-frequency B-weighting): high-pass at ~80 Hz
const RLB_B0 =  1.0
const RLB_B1 = -2.0
const RLB_B2 =  1.0
const RLB_A1 = -1.99004745483398
const RLB_A2 =  0.99007225036198

// ─── Biquad filter ────────────────────────────────────────────────────────────

function applyBiquad(
  input: Float32Array,
  b0: number, b1: number, b2: number,
  a1: number, a2: number,
): Float32Array {
  const output = new Float32Array(input.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i] ?? 0
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    output[i] = y0
    x2 = x1; x1 = x0
    y2 = y1; y1 = y0
  }
  return output
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return -Infinity
  const idx = Math.floor((pct / 100) * (sorted.length - 1))
  return sorted[Math.min(idx, sorted.length - 1)] ?? -Infinity
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class DynamicsAnalyzer {
  analyzeDynamics(buffer: Float32Array, sampleRate: number): DynamicsResult {
    if (buffer.length === 0) {
      return { peakDb: -Infinity, rmsDb: -Infinity, crestFactor: 0, dynamicRange: 0 }
    }

    // Segment into 100ms windows for percentile-based dynamic range
    const windowSamples = Math.floor(sampleRate * 0.1)
    const windowLevels: number[] = []

    let sumSq  = 0
    let maxAbs = 0

    for (let i = 0; i < buffer.length; i++) {
      const s = Math.abs(buffer[i] ?? 0)
      sumSq  += s * s
      if (s > maxAbs) maxAbs = s
    }

    // Per-window RMS levels for dynamic range
    for (let start = 0; start + windowSamples <= buffer.length; start += windowSamples) {
      let wSum = 0
      for (let i = start; i < start + windowSamples; i++) {
        const s = buffer[i] ?? 0
        wSum += s * s
      }
      const wRms = Math.sqrt(wSum / windowSamples)
      if (wRms > 0) {
        windowLevels.push(20 * Math.log10(wRms))
      }
    }

    const peakDb = maxAbs > 0 ? 20 * Math.log10(maxAbs) : -Infinity
    const rmsVal = Math.sqrt(sumSq / buffer.length)
    const rmsDb  = rmsVal > 0 ? 20 * Math.log10(rmsVal) : -Infinity

    const crestFactor = isFinite(peakDb) && isFinite(rmsDb) ? peakDb - rmsDb : 0

    let dynamicRange = 0
    if (windowLevels.length >= 2) {
      windowLevels.sort((a, b) => a - b)
      const p95 = percentile(windowLevels, 95)
      const p5  = percentile(windowLevels, 5)
      dynamicRange = isFinite(p95) && isFinite(p5) ? p95 - p5 : 0
    }

    return { peakDb, rmsDb, crestFactor, dynamicRange }
  }

  detectClipping(buffer: Float32Array, threshold = 0.9999): ClippingResult {
    let clippingEvents  = 0
    let maxSample       = 0

    for (let i = 0; i < buffer.length; i++) {
      const s = Math.abs(buffer[i] ?? 0)
      if (s > maxSample) maxSample = s
      if (s >= threshold) clippingEvents++
    }

    const clippingPercentage = buffer.length > 0
      ? (clippingEvents / buffer.length) * 100
      : 0

    return {
      clippingEvents,
      clippingPercentage,
      maxSample,
      isClipping: clippingEvents > 0,
    }
  }

  /**
   * Compute integrated loudness (LUFS) using ITU-R BS.1770-4.
   * K-weighting: pre-filter (high-shelf) → RLB (high-pass) → mean-square gating.
   */
  computeLUFS(buffer: Float32Array, sampleRate: number): number {
    if (buffer.length === 0) return -Infinity

    // Apply K-weighting filters
    const preFiltered = applyBiquad(buffer, PRE_B0, PRE_B1, PRE_B2, PRE_A1, PRE_A2)
    const rlbFiltered = applyBiquad(preFiltered, RLB_B0, RLB_B1, RLB_B2, RLB_A1, RLB_A2)

    // 400ms blocks
    const blockSamples = Math.floor(sampleRate * 0.4)
    if (blockSamples === 0) return -Infinity

    const blocks: number[] = []

    for (let start = 0; start + blockSamples <= rlbFiltered.length; start += blockSamples) {
      let sum = 0
      for (let i = start; i < start + blockSamples; i++) {
        const s = rlbFiltered[i] ?? 0
        sum += s * s
      }
      blocks.push(sum / blockSamples)
    }

    if (blocks.length === 0) return -Infinity

    // Absolute gate: -70 LUFS → linear threshold
    const absoluteThresholdPower = Math.pow(10, (-70 - 0.691) / 10)
    const gated1 = blocks.filter((b) => b > absoluteThresholdPower)
    if (gated1.length === 0) return -Infinity

    // Relative gate: -10 LU below average of first-gated blocks
    const avg1 = gated1.reduce((s, v) => s + v, 0) / gated1.length
    const relativeThreshold = avg1 * Math.pow(10, -10 / 10)
    const gated2 = gated1.filter((b) => b > relativeThreshold)

    if (gated2.length === 0) return -Infinity

    const meanPower = gated2.reduce((s, v) => s + v, 0) / gated2.length
    if (meanPower <= 0) return -Infinity

    return 10 * Math.log10(meanPower) - 0.691
  }
}

export const dynamicsAnalyzer = new DynamicsAnalyzer()
