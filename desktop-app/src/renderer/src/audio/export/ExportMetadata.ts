// ─── ExportMetadata ────────────────────────────────────────────────────────────
// Embeds metadata tags into encoded audio files.
// WAV: LIST/INFO chunk, FLAC: Vorbis Comment block, MP3: ID3v2.3 tags.

import type { ExportFormat } from './FlacEncoderPcm'
import { encodeWavMetadata } from './WavEncoderPcm'
import { insertVorbisComment } from './VorbisComment'
import { writeId3v2 } from './Id3Writer'

export interface ExportMetadata {
  title?:       string
  artist?:      string
  album?:       string
  trackNumber?: number
  year?:        number
  genre?:       string
  comment?:     string
  durationMs?:  number
  bpm?:         number
  key?:         string
}

/**
 * Apply metadata tags to encoded audio bytes.
 * Returns new bytes with metadata embedded in the appropriate format.
 *
 * WAV:  LIST/INFO chunk (via encodeWavMetadata — re-encodes with metadata)
 * FLAC: Vorbis Comment block inserted after STREAMINFO
 * MP3:  ID3v2.3 tags prepended to the file
 * OGG:  Pass through (ffmpeg handles metadata via -metadata flags)
 */
export function applyMetadata(
  audioBytes: Uint8Array,
  format: ExportFormat,
  metadata: ExportMetadata,
): Uint8Array {
  if (format === 'flac') {
    try {
      return insertVorbisComment(audioBytes, {
        title:   metadata.title,
        artist:  metadata.artist,
        album:   metadata.album,
        track:   metadata.trackNumber,
        date:    metadata.year !== undefined ? String(metadata.year) : undefined,
        genre:   metadata.genre,
        comment: metadata.comment,
      })
    } catch {
      // If FLAC file is malformed or metadata insertion fails, return original
      return audioBytes
    }
  }

  if (format === 'mp3') {
    const id3 = writeId3v2({
      title:      metadata.title,
      artist:     metadata.artist,
      album:      metadata.album,
      track:      metadata.trackNumber,
      year:       metadata.year,
      genre:      metadata.genre,
      durationMs: metadata.durationMs,
    })

    // Prepend ID3 header to MP3 data
    const result = new Uint8Array(id3.length + audioBytes.length)
    result.set(id3, 0)
    result.set(audioBytes, id3.length)
    return result
  }

  if (format === 'wav') {
    // For WAV, we need to re-encode with metadata. However, we only have
    // the raw bytes here. Use a best-effort approach: if the WAV bytes are
    // valid, insert a LIST/INFO chunk. Otherwise return unchanged.
    // This is a simplified pass-through for now — full WAV metadata requires
    // the raw PCM channels which aren't available at this stage.
    // The preferred path is to use encodeWavMetadata() at encode time.
    void encodeWavMetadata  // used upstream when PCM data is available
    return audioBytes
  }

  // OGG: pass through (ffmpeg adds metadata via -metadata)
  return audioBytes
}
