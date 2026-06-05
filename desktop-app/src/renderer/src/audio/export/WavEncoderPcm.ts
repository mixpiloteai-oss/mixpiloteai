// ─── WavEncoderPcm ────────────────────────────────────────────────────────────
// Encodes Float32Array[] (one array per channel) to a RIFF WAV Uint8Array.
// Supports 16-bit (int), 24-bit (int), and 32-bit (IEEE float) output.
//
// This is distinct from encoders/WavEncoder.ts which operates on AudioBuffer.
// Use this module when you have raw Float32Array PCM buffers.

export interface WavMetadata {
  title?:  string
  artist?: string
}

function writeStr(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

function clamp(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v
}

/**
 * Encode interleaved PCM from Float32Array channels into a RIFF WAV Uint8Array.
 *
 * @param channels   - Array of per-channel Float32Arrays (all same length)
 * @param sampleRate - Sample rate in Hz (e.g. 44100)
 * @param bitDepth   - Bit depth: 16 (int) | 24 (int) | 32 (IEEE float)
 */
export function encodeWav(
  channels:   Float32Array[],
  sampleRate: number,
  bitDepth:   16 | 24 | 32,
): Uint8Array {
  const numCh      = channels.length
  const numFrames  = channels[0]?.length ?? 0
  const bytesPerSample = bitDepth / 8
  const dataLen    = numFrames * numCh * bytesPerSample

  // RIFF header (12) + fmt chunk (8 + 16) + data chunk (8) = 44 bytes
  const totalSize = 44 + dataLen
  const buffer    = new ArrayBuffer(totalSize)
  const view      = new DataView(buffer)
  const bytes     = new Uint8Array(buffer)

  // RIFF chunk descriptor
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLen, true)   // file size - 8
  writeStr(view, 8, 'WAVE')

  // fmt sub-chunk
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)                               // chunk size
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true)         // format: 3=IEEE float, 1=PCM
  view.setUint16(22, numCh, true)                            // num channels
  view.setUint32(24, sampleRate, true)                       // sample rate
  view.setUint32(28, sampleRate * numCh * bytesPerSample, true) // byte rate
  view.setUint16(32, numCh * bytesPerSample, true)           // block align
  view.setUint16(34, bitDepth, true)                         // bits per sample

  // data sub-chunk header
  writeStr(view, 36, 'data')
  view.setUint32(40, dataLen, true)

  // Write interleaved samples
  let pos = 44
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = clamp(channels[c]![i] ?? 0)
      if (bitDepth === 32) {
        view.setFloat32(pos, s, true)
        pos += 4
      } else if (bitDepth === 24) {
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
        bytes[pos]     = v & 0xff
        bytes[pos + 1] = (v >> 8) & 0xff
        bytes[pos + 2] = (v >> 16) & 0xff
        pos += 3
      } else {
        // 16-bit
        view.setInt16(pos, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true)
        pos += 2
      }
    }
  }

  return bytes
}

/**
 * Encode WAV with LIST/INFO metadata chunk (INAM title, IART artist).
 * The LIST chunk is inserted before the data chunk.
 */
export function encodeWavMetadata(
  channels:   Float32Array[],
  sampleRate: number,
  bitDepth:   16 | 24 | 32,
  metadata:   WavMetadata,
): Uint8Array {
  const numCh      = channels.length
  const numFrames  = channels[0]?.length ?? 0
  const bytesPerSample = bitDepth / 8
  const dataLen    = numFrames * numCh * bytesPerSample

  // Build LIST/INFO chunk
  const fields: Array<{ id: string; val: string }> = []
  if (metadata.title)  fields.push({ id: 'INAM', val: metadata.title })
  if (metadata.artist) fields.push({ id: 'IART', val: metadata.artist })

  let listDataLen = 4  // 'INFO'
  for (const f of fields) listDataLen += 4 + 4 + f.val.length + (f.val.length & 1)
  const listChunkSize = 8 + listDataLen

  const totalSize = 44 + listChunkSize + dataLen
  const buf       = new ArrayBuffer(totalSize)
  const view      = new DataView(buf)
  const bytes     = new Uint8Array(buf)

  // RIFF header
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + listChunkSize + dataLen, true)
  writeStr(view, 8, 'WAVE')

  // fmt chunk
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true)
  view.setUint16(22, numCh, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numCh * bytesPerSample, true)
  view.setUint16(32, numCh * bytesPerSample, true)
  view.setUint16(34, bitDepth, true)

  // LIST/INFO chunk
  let p = 36
  writeStr(view, p, 'LIST'); p += 4
  view.setUint32(p, listDataLen, true); p += 4
  writeStr(view, p, 'INFO'); p += 4
  for (const f of fields) {
    writeStr(view, p, f.id); p += 4
    view.setUint32(p, f.val.length, true); p += 4
    for (let i = 0; i < f.val.length; i++) view.setUint8(p + i, f.val.charCodeAt(i))
    p += f.val.length
    if (f.val.length & 1) { view.setUint8(p, 0); p++ }
  }

  // data chunk
  writeStr(view, p, 'data'); p += 4
  view.setUint32(p, dataLen, true); p += 4

  // Interleaved samples
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = clamp(channels[c]![i] ?? 0)
      if (bitDepth === 32) {
        view.setFloat32(p, s, true); p += 4
      } else if (bitDepth === 24) {
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
        bytes[p]     = v & 0xff
        bytes[p + 1] = (v >> 8) & 0xff
        bytes[p + 2] = (v >> 16) & 0xff
        p += 3
      } else {
        view.setInt16(p, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true)
        p += 2
      }
    }
  }

  return bytes
}
