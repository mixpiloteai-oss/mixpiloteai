// ─── OggEncoder ────────────────────────────────────────────────────────────────
// OGG Vorbis encoding via two strategies:
//   1. If ffmpeg available: signal main process to transcode via ffmpeg
//   2. Fallback: FLAC lossless encoding (better than fake OGG)

import { encodeFlacReal } from './FlacEncoderReal'
import { encodeWav } from './WavEncoderPcm'

export interface OggEncodeOptions {
  channels:   Float32Array[]
  sampleRate: number
  quality:    number  // 0.0-1.0 (Vorbis quality scale)
}

export type OggEncodeResult =
  | { format: 'ogg';            data: Uint8Array }
  | { format: 'flac-fallback';  data: Uint8Array; reason: string }

/**
 * Encode audio as OGG Vorbis (via ffmpeg) or FLAC lossless (fallback).
 *
 * If ffmpegAvailable is true: returns the audio as WAV bytes with format='ogg'
 * signal — the main process will re-encode via ffmpeg.
 *
 * If not available: encodes as FLAC (lossless is better than a fake OGG).
 */
export async function encodeOgg(
  options: OggEncodeOptions,
  ffmpegAvailable: boolean,
): Promise<OggEncodeResult> {
  const { channels, sampleRate } = options

  if (ffmpegAvailable) {
    // Write as WAV; the main process will call ffmpeg to convert to OGG Vorbis
    const wavBytes = encodeWav(channels, sampleRate, 24)
    return { format: 'ogg', data: wavBytes }
  }

  // Fallback: FLAC lossless
  const bitDepth: 16 | 24 = 24
  const flacBytes = encodeFlacReal({
    channels,
    sampleRate,
    bitDepth,
    compressionLevel: 5,
  })

  return {
    format: 'flac-fallback',
    data:   flacBytes,
    reason: 'ffmpeg not available — exported as lossless FLAC instead of OGG Vorbis',
  }
}
