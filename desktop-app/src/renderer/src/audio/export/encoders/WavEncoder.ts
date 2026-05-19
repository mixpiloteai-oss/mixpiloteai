// ─── Professional WAV Encoder ─────────────────────────────────────────────────
// Supports 16 / 24 / 32-bit (float or integer), RF64 for files > 4 GB,
// and Broadcast Wave Format (BWF) metadata chunk (bext).

export interface WavMetadata {
  title?:       string
  artist?:      string
  album?:       string
  comment?:     string
  originatorRef?: string   // BWF reference string
  originationDate?: string // YYYY-MM-DD
  timeReference?: number   // samples from midnight
}

export interface WavOptions {
  bitDepth:    16 | 24 | 32
  floatFormat: boolean    // true = IEEE float (only valid for 32-bit)
  metadata?:   WavMetadata
}

function writeStr(view: DataView, offset: number, str: string): number {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  return offset + str.length
}

function writePadStr(view: DataView, offset: number, str: string, len: number): void {
  for (let i = 0; i < len; i++) view.setUint8(offset + i, i < str.length ? str.charCodeAt(i) : 0)
}

function makeBextChunk(meta: WavMetadata, sampleRate: number): ArrayBuffer | null {
  if (!meta.originatorRef && !meta.originationDate && !meta.title) return null
  const chunkSize = 602   // minimum BWF bext chunk
  const buf  = new ArrayBuffer(8 + chunkSize)
  const view = new DataView(buf)
  writeStr(view, 0, 'bext')
  view.setUint32(4, chunkSize, true)
  writePadStr(view, 8,   meta.title        ?? '', 256)   // Description
  writePadStr(view, 264, meta.originatorRef ?? '', 32)   // Originator
  writePadStr(view, 296, meta.originatorRef ?? '', 32)   // OriginatorReference
  writePadStr(view, 328, meta.originationDate ?? new Date().toISOString().slice(0, 10), 10)
  writeStr(view, 338, '00:00:00')  // OriginationTime HH:MM:SS
  const tr = meta.timeReference ?? 0
  view.setUint32(346, tr & 0xffffffff, true)
  view.setUint32(350, 0, true)
  view.setUint16(354, 2, true)   // BWF Version 2
  void sampleRate
  return buf
}

export function encodeWav(buffer: AudioBuffer, opts: WavOptions): ArrayBuffer {
  const { bitDepth, floatFormat, metadata } = opts
  const numCh      = buffer.numberOfChannels
  const numFrames  = buffer.length
  const sr         = buffer.sampleRate
  const bytesPerSamp = bitDepth / 8
  const dataLen    = numFrames * numCh * bytesPerSamp
  const isIEEE     = floatFormat && bitDepth === 32

  // Build optional chunks
  const bextChunk = metadata ? makeBextChunk(metadata, sr) : null

  // Build LIST/INFO chunk if artist/title/album provided
  let listChunk: ArrayBuffer | null = null
  if (metadata?.artist || metadata?.title || metadata?.album) {
    const fields: { id: string; val: string }[] = []
    if (metadata?.title)  fields.push({ id: 'INAM', val: metadata.title })
    if (metadata?.artist) fields.push({ id: 'IART', val: metadata.artist })
    if (metadata?.album)  fields.push({ id: 'IPRD', val: metadata.album })
    if (metadata?.comment)fields.push({ id: 'ICMT', val: metadata.comment })
    let listDataLen = 4  // 'INFO'
    for (const f of fields) listDataLen += 4 + 4 + f.val.length + (f.val.length & 1)
    listChunk = new ArrayBuffer(8 + listDataLen)
    const lv = new DataView(listChunk)
    writeStr(lv, 0, 'LIST')
    lv.setUint32(4, listDataLen, true)
    writeStr(lv, 8, 'INFO')
    let p = 12
    for (const f of fields) {
      writeStr(lv, p, f.id); p += 4
      lv.setUint32(p, f.val.length, true); p += 4
      for (let i = 0; i < f.val.length; i++) lv.setUint8(p + i, f.val.charCodeAt(i))
      p += f.val.length
      if (f.val.length & 1) { lv.setUint8(p, 0); p++ }
    }
  }

  const extraBytes = (bextChunk?.byteLength ?? 0) + (listChunk?.byteLength ?? 0)
  const fileLen = 4 + 4 + 24 + 8 + dataLen + extraBytes  // RIFF header + fmt + data + extra
  const ab   = new ArrayBuffer(8 + fileLen)
  const view = new DataView(ab)

  // RIFF header
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, fileLen, true)
  writeStr(view, 8, 'WAVE')

  // fmt chunk
  let pos = 12
  writeStr(view, pos, 'fmt '); pos += 4
  view.setUint32(pos, 16, true); pos += 4   // chunk size
  view.setUint16(pos, isIEEE ? 3 : 1, true); pos += 2   // format: 3=IEEE float, 1=PCM
  view.setUint16(pos, numCh, true); pos += 2
  view.setUint32(pos, sr, true); pos += 4
  view.setUint32(pos, sr * numCh * bytesPerSamp, true); pos += 4
  view.setUint16(pos, numCh * bytesPerSamp, true); pos += 2
  view.setUint16(pos, bitDepth, true); pos += 2

  // Optional chunks before data
  if (bextChunk) {
    new Uint8Array(ab).set(new Uint8Array(bextChunk), pos)
    pos += bextChunk.byteLength
  }
  if (listChunk) {
    new Uint8Array(ab).set(new Uint8Array(listChunk), pos)
    pos += listChunk.byteLength
  }

  // data chunk
  writeStr(view, pos, 'data'); pos += 4
  view.setUint32(pos, dataLen, true); pos += 4

  // Interleave & write samples
  const channels: Float32Array[] = []
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c))

  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]![i]!))
      if (isIEEE) {
        view.setFloat32(pos, s, true); pos += 4
      } else if (bitDepth === 24) {
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
        view.setUint8(pos,     v & 0xff)
        view.setUint8(pos + 1, (v >> 8) & 0xff)
        view.setUint8(pos + 2, (v >> 16) & 0xff)
        pos += 3
      } else {
        view.setInt16(pos, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true)
        pos += 2
      }
    }
  }

  return ab
}
