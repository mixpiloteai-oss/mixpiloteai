/**
 * LatencyMeasurement — reads real audio latency from the Web Audio API.
 *
 * AudioContext exposes two latency properties (Chrome 58+, Electron 3+):
 *   baseLatency    — the latency due to the AudioContext's own processing
 *   outputLatency  — hardware output latency (device buffer)
 *
 * Round-trip latency ≈ baseLatency + outputLatency.
 * Buffer size can be back-calculated: bufferFrames = baseLatency × sampleRate.
 *
 * Usage:
 *   const lm = new LatencyMeasurement(audioCtx)
 *   const r  = lm.measure()
 *   console.log(r.totalMs)       // e.g. 23.2
 *   console.log(r.bufferFrames)  // e.g. 512
 */

export interface LatencyResult {
  baseLatencyMs:   number    // AudioContext.baseLatency × 1000
  outputLatencyMs: number    // AudioContext.outputLatency × 1000
  totalMs:         number    // sum of both
  bufferFrames:    number    // back-calculated from baseLatency × sampleRate
  sampleRate:      number    // AudioContext.sampleRate
}

export class LatencyMeasurement {
  private readonly _ctx: AudioContext

  constructor(ctx: AudioContext) {
    this._ctx = ctx
  }

  /**
   * Read current latency values from the AudioContext.
   * Values update dynamically when the audio device changes.
   */
  measure(): LatencyResult {
    const ctx    = this._ctx
    const sr     = ctx.sampleRate

    // baseLatency and outputLatency are standard since Chrome 58 / Electron 3
    const baseSec   = (ctx as AudioContext & { baseLatency?: number }).baseLatency   ?? 0
    const outputSec = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0

    const baseMs   = baseSec   * 1000
    const outputMs = outputSec * 1000
    const totalMs  = baseMs + outputMs

    // Buffer size estimate: baseLatency = bufferFrames / sampleRate
    const bufferFrames = Math.round(baseSec * sr)

    return { baseLatencyMs: baseMs, outputLatencyMs: outputMs, totalMs, bufferFrames, sampleRate: sr }
  }

  /**
   * Get buffer size in milliseconds for a given frame count and sample rate.
   * Useful for displaying latency for manually selected buffer sizes.
   */
  static bufferSizeMs(frames: number, sampleRate: number): number {
    return (frames / sampleRate) * 1000
  }

  /**
   * Get estimated round-trip latency for a given buffer/rate combo.
   * Estimate: 2× buffer size (input + output) + typical OS overhead (5ms).
   */
  static estimatedRoundTripMs(frames: number, sampleRate: number): number {
    return LatencyMeasurement.bufferSizeMs(frames * 2, sampleRate) + 5
  }
}
