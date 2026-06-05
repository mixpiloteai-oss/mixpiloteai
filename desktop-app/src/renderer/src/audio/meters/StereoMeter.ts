// ─── StereoMeter ──────────────────────────────────────────────────────────────
// Real-time stereo VU and correlation metering.

export interface VuMeterData {
  leftDb:       number
  rightDb:      number
  leftPeakDb:   number
  rightPeakDb:  number
  correlation:  number
  phaseAngle:   number  // degrees
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rmsDb(buf: Float32Array): number {
  if (buf.length === 0) return -Infinity
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const s = buf[i] ?? 0
    sum += s * s
  }
  const rms = Math.sqrt(sum / buf.length)
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity
}

function peakDb(buf: Float32Array): number {
  if (buf.length === 0) return -Infinity
  let maxAbs = 0
  for (let i = 0; i < buf.length; i++) {
    const s = Math.abs(buf[i] ?? 0)
    if (s > maxAbs) maxAbs = s
  }
  return maxAbs > 0 ? 20 * Math.log10(maxAbs) : -Infinity
}

function pearsonCorr(left: Float32Array, right: Float32Array): number {
  const N = Math.min(left.length, right.length)
  if (N === 0) return 0
  let sumLR = 0, sumL2 = 0, sumR2 = 0
  for (let i = 0; i < N; i++) {
    const l = left[i] ?? 0
    const r = right[i] ?? 0
    sumLR += l * r
    sumL2 += l * l
    sumR2 += r * r
  }
  const denom = Math.sqrt(sumL2 * sumR2)
  return denom === 0 ? 0 : sumLR / denom
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class StereoMeter {
  computeVuMeters(left: Float32Array, right: Float32Array): VuMeterData {
    const leftDb      = rmsDb(left)
    const rightDb     = rmsDb(right)
    const leftPeakDb  = peakDb(left)
    const rightPeakDb = peakDb(right)
    const correlation = pearsonCorr(left, right)
    // Phase angle: correlation maps to 0–90°
    const phaseAngle  = Math.acos(Math.max(-1, Math.min(1, correlation))) * (180 / Math.PI)

    return { leftDb, rightDb, leftPeakDb, rightPeakDb, correlation, phaseAngle }
  }

  /**
   * Start realtime VU metering. Returns stop function.
   * Uses setInterval (not requestAnimationFrame).
   */
  start(
    getBuffers: () => { left: Float32Array; right: Float32Array },
    onMeter: (data: VuMeterData) => void,
  ): () => void {
    const id = setInterval(() => {
      const { left, right } = getBuffers()
      onMeter(this.computeVuMeters(left, right))
    }, 50)

    return () => clearInterval(id)
  }
}

export const stereoMeter = new StereoMeter()
