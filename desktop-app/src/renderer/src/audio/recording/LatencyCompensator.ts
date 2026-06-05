// ─── LatencyCompensator ───────────────────────────────────────────────────────
// Pure latency compensation math — no AudioContext dependency.

export class LatencyCompensator {
  // Shift buffer by removing latency samples from the start (pre-roll trimming).
  // If latencyMs * sampleRate / 1000 >= buffer.length, return all zeros (silence).
  compensate(samples: Float32Array, latencyMs: number, sampleRate: number): Float32Array {
    const delaySamples = Math.round(latencyMs * sampleRate / 1000)
    if (delaySamples <= 0) return samples.slice()
    if (delaySamples >= samples.length) return new Float32Array(samples.length)

    const out = new Float32Array(samples.length)
    // Copy samples[delaySamples..] to out[0..], zero-fill the tail automatically
    out.set(samples.subarray(delaySamples))
    return out
  }

  // Compute latency in samples from milliseconds.
  msToSamples(latencyMs: number, sampleRate: number): number {
    return Math.round(latencyMs * sampleRate / 1000)
  }

  // Round-trip latency estimate: input + output + processing (buffer size).
  estimateRoundTripMs(
    inputLatencyMs:    number,
    outputLatencyMs:   number,
    bufferSizeFrames:  number,
    sampleRate:        number,
  ): number {
    const bufferMs = (bufferSizeFrames / sampleRate) * 1000
    return inputLatencyMs + outputLatencyMs + bufferMs
  }
}
