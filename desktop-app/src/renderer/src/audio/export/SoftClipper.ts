// ─── SoftClipper ──────────────────────────────────────────────────────────────
// Soft-knee saturation / soft-clipping for Float32Array channel buffers.
// Provides gentle compression beyond the threshold while preventing hard clips.

/**
 * Apply soft-knee clipping to a single sample.
 *
 * Linear zone: abs(x) <= threshold → return x unchanged
 * Soft zone:   abs(x) > threshold  → smooth tanh-based compression
 *
 * @param x         - Input sample value
 * @param threshold - Knee threshold in normalized [0, 1] range (default 0.95)
 * @returns Soft-clipped sample value
 */
export function softClip(x: number, threshold: number = 0.95): number {
  const abs = Math.abs(x)
  if (abs <= threshold) return x

  const sign = x < 0 ? -1 : 1
  const knee = abs - threshold
  const range = 1 - threshold
  // tanh-based soft compression in the knee region
  return sign * (threshold + range * Math.tanh(knee / range))
}

/**
 * Apply soft clipping to every sample in a channel buffer.
 *
 * @param buffer    - Input Float32Array (not modified)
 * @param threshold - Soft-clip knee threshold in [0, 1]
 * @returns New Float32Array with soft clipping applied
 */
export function processChannel(buffer: Float32Array, threshold: number = 0.95): Float32Array {
  const output = new Float32Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    output[i] = softClip(buffer[i]!, threshold)
  }
  return output
}

/**
 * Apply soft clipping to all channels in a multi-channel buffer.
 *
 * @param channels  - Array of per-channel Float32Arrays
 * @param threshold - Soft-clip knee threshold in [0, 1]
 * @returns Array of new Float32Arrays with soft clipping applied
 */
export function processBuffer(channels: Float32Array[], threshold: number = 0.95): Float32Array[] {
  return channels.map(ch => processChannel(ch, threshold))
}
