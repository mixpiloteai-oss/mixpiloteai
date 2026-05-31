// ─── SampleRateConverter ──────────────────────────────────────────────────────
// Linear interpolation resampling for Float32Array buffers.
// Used before encoding when the project sample rate differs from the export rate.

/**
 * Convert a single-channel Float32Array from one sample rate to another
 * using linear interpolation.
 *
 * @param buffer   - Input PCM samples
 * @param fromRate - Source sample rate in Hz
 * @param toRate   - Target sample rate in Hz
 * @returns Resampled Float32Array
 */
export function convertSampleRate(
  buffer: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return buffer

  const ratio = fromRate / toRate
  const outputLength = Math.round(buffer.length * toRate / fromRate)
  const output = new Float32Array(outputLength)

  for (let i = 0; i < outputLength; i++) {
    const srcPos = i * ratio
    const floor = Math.floor(srcPos)
    const ceil = Math.min(floor + 1, buffer.length - 1)
    const frac = srcPos - floor

    const s0 = buffer[floor] ?? 0
    const s1 = buffer[ceil] ?? 0
    // Linear interpolation between neighboring samples
    output[i] = s0 + (s1 - s0) * frac
  }

  return output
}

/**
 * Convert all channels of a multi-channel buffer from one sample rate to another.
 *
 * @param channels - Array of per-channel Float32Arrays
 * @param fromRate - Source sample rate in Hz
 * @param toRate   - Target sample rate in Hz
 * @returns Array of resampled per-channel Float32Arrays
 */
export function convertBuffer(
  channels: Float32Array[],
  fromRate: number,
  toRate: number,
): Float32Array[] {
  return channels.map(ch => convertSampleRate(ch, fromRate, toRate))
}
