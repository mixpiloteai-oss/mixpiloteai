// ─── LoudnessMeter ────────────────────────────────────────────────────────────
// Real-time LUFS/loudness metering using ITU-R BS.1770.

import { DynamicsAnalyzer } from '../analysis/DynamicsAnalyzer'

export interface LoudnessMeasurement {
  momentary:  number   // 400ms RMS → LUFS
  shortTerm:  number   // 3s RMS → LUFS
  integrated: number   // gated LUFS
  range:      number   // LRA: 95th - 10th percentile of 3s blocks
  truePeak:   number   // dBFS with 4x oversampling
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rmsToLufs(buffer: Float32Array): number {
  if (buffer.length === 0) return -Infinity
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const s = buffer[i] ?? 0
    sum += s * s
  }
  const rms = Math.sqrt(sum / buffer.length)
  if (rms <= 0) return -Infinity
  // Approximate LUFS from RMS: LUFS ≈ 20*log10(rms) - 0.691
  return 20 * Math.log10(rms) - 0.691
}

/**
 * True peak with 4x linear interpolation oversampling.
 */
function truePeakDb(buffer: Float32Array): number {
  if (buffer.length === 0) return -Infinity
  let maxAbs = 0

  for (let i = 0; i < buffer.length - 1; i++) {
    const s0 = buffer[i] ?? 0
    const s1 = buffer[i + 1] ?? 0
    maxAbs = Math.max(maxAbs, Math.abs(s0))
    // 4x interpolation: insert 3 samples between each pair
    for (let j = 1; j <= 3; j++) {
      const t    = j / 4
      const interp = s0 + (s1 - s0) * t
      maxAbs = Math.max(maxAbs, Math.abs(interp))
    }
  }

  // Last sample
  const last = buffer[buffer.length - 1] ?? 0
  maxAbs = Math.max(maxAbs, Math.abs(last))

  return maxAbs > 0 ? 20 * Math.log10(maxAbs) : -Infinity
}

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return -Infinity
  const idx = Math.floor((pct / 100) * (sorted.length - 1))
  return sorted[Math.min(idx, sorted.length - 1)] ?? -Infinity
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class LoudnessMeter {
  private readonly dynAnalyzer = new DynamicsAnalyzer()

  // Buffer accumulation for realtime metering
  private accumulatedBuffer: Float32Array = new Float32Array(0)
  private readonly maxAccumulatedSeconds  = 4

  measure(buffer: Float32Array, sampleRate: number): LoudnessMeasurement {
    const sr = sampleRate

    // Momentary: 400ms
    const momentarySamples = Math.floor(sr * 0.4)
    const momentaryBuf = buffer.length >= momentarySamples
      ? buffer.subarray(buffer.length - momentarySamples)
      : buffer
    const momentary = rmsToLufs(momentaryBuf)

    // Short-term: 3s
    const shortTermSamples = Math.floor(sr * 3)
    const shortTermBuf = buffer.length >= shortTermSamples
      ? buffer.subarray(buffer.length - shortTermSamples)
      : buffer
    const shortTerm = rmsToLufs(shortTermBuf)

    // Integrated: gated LUFS
    const integrated = this.dynAnalyzer.computeLUFS(buffer, sr)

    // LRA: 95th - 10th percentile of 3s-block levels
    const blockSamples = Math.floor(sr * 3)
    const blockLevels: number[] = []

    if (blockSamples > 0) {
      for (let start = 0; start + blockSamples <= buffer.length; start += blockSamples) {
        const level = rmsToLufs(buffer.subarray(start, start + blockSamples))
        if (isFinite(level)) blockLevels.push(level)
      }
    }

    let range = 0
    if (blockLevels.length >= 2) {
      blockLevels.sort((a, b) => a - b)
      const p95 = percentile(blockLevels, 95)
      const p10 = percentile(blockLevels, 10)
      range = isFinite(p95) && isFinite(p10) ? p95 - p10 : 0
    }

    const tp = truePeakDb(buffer)

    return {
      momentary,
      shortTerm,
      integrated,
      range,
      truePeak: isFinite(tp) ? tp : -Infinity,
    }
  }

  /**
   * Start realtime metering. Returns a cleanup/stop function.
   * Uses setInterval (not requestAnimationFrame).
   */
  startRealtime(
    getBuffer: () => Float32Array,
    sampleRate: number,
    onMeasure: (m: LoudnessMeasurement) => void,
  ): () => void {
    const maxSamples = this.maxAccumulatedSeconds * sampleRate

    const id = setInterval(() => {
      const chunk = getBuffer()

      // Accumulate buffer (rolling window)
      if (this.accumulatedBuffer.length + chunk.length > maxSamples) {
        const keep = new Float32Array(
          Math.max(0, maxSamples - chunk.length),
        )
        const offset = Math.max(0, this.accumulatedBuffer.length - keep.length)
        keep.set(this.accumulatedBuffer.subarray(offset))
        this.accumulatedBuffer = keep
      }

      const merged = new Float32Array(this.accumulatedBuffer.length + chunk.length)
      merged.set(this.accumulatedBuffer)
      merged.set(chunk, this.accumulatedBuffer.length)
      this.accumulatedBuffer = merged

      const measurement = this.measure(this.accumulatedBuffer, sampleRate)
      onMeasure(measurement)
    }, 50)

    return () => {
      clearInterval(id)
      this.accumulatedBuffer = new Float32Array(0)
    }
  }
}

export const loudnessMeter = new LoudnessMeter()
