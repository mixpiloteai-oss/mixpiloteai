// ─── FlacEncoderPcm ───────────────────────────────────────────────────────────
// FLAC encoder operating on Float32Array[] (one array per channel).
// NATIVE-ENCODER: FLAC encoding requires libFLAC WASM or native Node.js addon.
// This returns a WAV fallback until the native encoder is linked.

import { applyDither } from './DitherEngine'
import { encodeWav } from './WavEncoderPcm'

export type ExportFormat = 'wav' | 'flac' | 'mp3'

export interface FlacEncodeOptions {
  channels:         Float32Array[]
  sampleRate:       number
  bitDepth:         16 | 24
  compressionLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
}

/**
 * Encode Float32Array channels to FLAC.
 *
 * NATIVE-ENCODER: FLAC encoding requires libFLAC WASM or native Node.js addon.
 * This returns a WAV fallback until the native encoder is linked.
 */
export function encodeFlac(options: FlacEncodeOptions): Uint8Array {
  // Apply TPDF dither to first channel for bit depth reduction (fallback only)
  const _dithered = applyDither(options.channels[0] ?? new Float32Array(0), options.bitDepth, 'tpdf')
  void _dithered  // Would be used in actual FLAC encoder
  return encodeWav(options.channels, options.sampleRate, options.bitDepth as 16 | 24 | 32)
}
