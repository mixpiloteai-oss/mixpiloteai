// ─── MeterWorker.ts ───────────────────────────────────────────────────────────
// Pure math metering utilities — no AudioContext, fully testable in Node.

import { linearToDb } from './mixerMath.ts'

/** Peak level: maximum absolute sample value in [0, 1]. */
export function computePeak(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > peak) peak = abs
  }
  return peak
}

/** RMS level: sqrt(mean of squares). */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/**
 * Short-term LUFS approximation.
 * Accepts an array of pre-computed per-channel RMS values collected over a
 * short window (~400 ms). Returns an approximate integrated LUFS value.
 *
 * @approximate — production LUFS uses ITU-R BS.1770-4 compliant K-weighting
 * and momentary/short-term/integrated gating. This is a simplified RMS-mean
 * estimate suitable for visual metering only.
 */
export function computeShortTermLufs(rmsValues: Float32Array): number {
  if (rmsValues.length === 0) return -Infinity
  let sumSq = 0
  for (let i = 0; i < rmsValues.length; i++) sumSq += rmsValues[i] * rmsValues[i]
  const meanSquare = sumSq / rmsValues.length
  if (meanSquare <= 0) return -Infinity
  // LUFS ≈ -0.691 + 10 * log10(mean_square) — simplified K-weighted approximation
  return -0.691 + 10 * Math.log10(meanSquare)
}

/** Returns true when the linear peak level is at or above full scale (clipping). */
export function isClipping(peakLinear: number): boolean {
  return peakLinear >= 1.0
}

/** Convert peak linear [0,1] to dBFS (negative values below 0 dBFS). */
export function peakToDbfs(peakLinear: number): number {
  return linearToDb(peakLinear)
}
