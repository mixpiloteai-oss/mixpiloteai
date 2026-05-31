// ─── Mp3EncoderPcm ────────────────────────────────────────────────────────────
// MP3 encoder operating on Float32Array[] (one array per channel).
// NATIVE-ENCODER: MP3 encoding requires lamejs WASM or native Node.js addon.
// Returns a WAV fallback until the encoder is linked.

import { encodeWav } from './WavEncoderPcm'

export interface Mp3EncodeOptions {
  channels:   Float32Array[]
  sampleRate: number
  bitrate:    128 | 192 | 256 | 320
  quality:    0 | 2 | 5 | 9
}

/**
 * Encode Float32Array channels to MP3.
 *
 * NATIVE-ENCODER: MP3 encoding requires lamejs WASM or native Node.js addon.
 * Returns WAV fallback until encoder is linked.
 */
export function encodeMp3(options: Mp3EncodeOptions): Uint8Array {
  // NATIVE-ENCODER: MP3 encoding requires lamejs WASM or native Node.js addon.
  // Returns WAV fallback until encoder is linked.
  void options.bitrate   // Would configure lamejs bitrate
  void options.quality   // Would configure lamejs quality
  return encodeWav(options.channels, options.sampleRate, 16)
}
