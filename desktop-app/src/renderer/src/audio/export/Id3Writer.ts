// ─── Id3Writer ─────────────────────────────────────────────────────────────────
// Write ID3v2.3 tags for MP3 files.
// Supports TIT2, TPE1, TALB, TRCK, TYER, TCON, TLEN frames.

export interface Id3Tags {
  title?:      string
  artist?:     string
  album?:      string
  track?:      number
  year?:       number
  genre?:      string
  durationMs?: number
}

// ─── Syncsafe integer encoding ────────────────────────────────────────────────

function encodeSyncsafe(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  bytes[3] = value & 0x7f
  bytes[2] = (value >> 7) & 0x7f
  bytes[1] = (value >> 14) & 0x7f
  bytes[0] = (value >> 21) & 0x7f
  return bytes
}

// ─── Frame builder ────────────────────────────────────────────────────────────

function buildFrame(id: string, text: string): Uint8Array {
  // encoding byte: 0 = latin-1/ISO-8859-1
  const encoded = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    encoded[i] = text.charCodeAt(i) & 0xff
  }
  const dataLen  = 1 + encoded.length  // 1 byte encoding flag + text bytes
  // frame layout: 4(id) + 4(size) + 2(flags) + 1(encoding) + text = 11 + encoded.length
  const frame    = new Uint8Array(11 + encoded.length)
  const view     = new DataView(frame.buffer)

  // Frame id (4 chars, ASCII)
  for (let i = 0; i < 4; i++) frame[i] = id.charCodeAt(i)

  // Size: big-endian 32-bit (NOT syncsafe in ID3v2.3)
  view.setUint32(4, dataLen, false)

  // Flags: 2 bytes, all zero
  frame[8] = 0
  frame[9] = 0

  // Encoding byte (0 = latin-1)
  frame[10] = 0

  // Text data
  frame.set(encoded, 11)

  return frame
}

// ─── ID3v2.3 writer ───────────────────────────────────────────────────────────

/**
 * Build an ID3v2.3 header block for the given tags.
 * Returns just the ID3 header bytes (prepend to MP3 data).
 */
export function writeId3v2(tags: Id3Tags): Uint8Array {
  const frames: Uint8Array[] = []

  if (tags.title)                frames.push(buildFrame('TIT2', tags.title))
  if (tags.artist)               frames.push(buildFrame('TPE1', tags.artist))
  if (tags.album)                frames.push(buildFrame('TALB', tags.album))
  if (tags.track !== undefined)  frames.push(buildFrame('TRCK', String(tags.track)))
  if (tags.year !== undefined)   frames.push(buildFrame('TYER', String(tags.year)))
  if (tags.genre)                frames.push(buildFrame('TCON', tags.genre))
  if (tags.durationMs !== undefined) frames.push(buildFrame('TLEN', String(Math.round(tags.durationMs))))

  const framesLen = frames.reduce((acc, f) => acc + f.length, 0)

  // ID3v2 header: 10 bytes
  //   "ID3" + version(2 bytes: 3,0) + flags(1 byte: 0) + syncsafe size(4 bytes)
  const header = new Uint8Array(10)
  header[0] = 0x49  // 'I'
  header[1] = 0x44  // 'D'
  header[2] = 0x33  // '3'
  header[3] = 3     // version: ID3v2.3
  header[4] = 0     // revision: 0
  header[5] = 0     // flags: none

  const sizeBytes = encodeSyncsafe(framesLen)
  header[6] = sizeBytes[0]!
  header[7] = sizeBytes[1]!
  header[8] = sizeBytes[2]!
  header[9] = sizeBytes[3]!

  // Concatenate header + frames
  const result = new Uint8Array(10 + framesLen)
  result.set(header, 0)
  let pos = 10
  for (const frame of frames) {
    result.set(frame, pos)
    pos += frame.length
  }

  return result
}
