// ─── DitherEngine ─────────────────────────────────────────────────────────────
// Pure-function dithering for Float32Array buffers.
// Applied before bit-depth reduction (16 or 24-bit).
//
// Algorithms:
//   tpdf        — Triangular Probability Density Function (two random values)
//   rectangular — Single uniform random value (RPDF)
//   none        — Pass through unchanged

export type DitherType = 'none' | 'tpdf' | 'rectangular'

function clamp(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v
}

/**
 * Apply dithering noise to a Float32Array buffer before bit-depth reduction.
 *
 * @param buffer   - Input PCM samples (not modified)
 * @param bitDepth - Target bit depth (determines noise amplitude)
 * @param type     - Dither algorithm to use
 * @returns New Float32Array with dither applied, clamped to [-1, 1]
 */
export function applyDither(
  buffer: Float32Array,
  bitDepth: number,
  type: DitherType,
): Float32Array {
  if (type === 'none') return buffer

  const output = new Float32Array(buffer.length)

  if (type === 'tpdf') {
    // Triangular PDF: two uniform random values summed
    // Amplitude = 1 LSB at target bit depth
    const amplitude = 1 / Math.pow(2, bitDepth)
    for (let i = 0; i < buffer.length; i++) {
      // Two independent uniform random values in [-0.5, 0.5] summed = triangle distribution
      const dither = (Math.random() - Math.random()) * amplitude
      output[i] = clamp(buffer[i]! + dither)
    }
  } else {
    // Rectangular: single uniform random, amplitude = 0.5 LSB
    const amplitude = 0.5 / Math.pow(2, bitDepth)
    for (let i = 0; i < buffer.length; i++) {
      const dither = (Math.random() - 0.5) * 2 * amplitude
      output[i] = clamp(buffer[i]! + dither)
    }
  }

  return output
}
