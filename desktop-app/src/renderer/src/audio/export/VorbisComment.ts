// ─── VorbisComment ─────────────────────────────────────────────────────────────
// Builds and inserts Vorbis Comment metadata blocks into FLAC files.
// FLAC metadata block type 4 = VORBIS_COMMENT.

export interface VorbisCommentTags {
  title?:   string
  artist?:  string
  album?:   string
  track?:   number
  date?:    string
  genre?:   string
  comment?: string
}

const VENDOR_STRING = 'Neurotek Studio v1.0'

// ─── UTF-8 string encoder ─────────────────────────────────────────────────────

function encodeUtf8(str: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return new Uint8Array(bytes)
}

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true)
}

// ─── Vorbis Comment block body (without the FLAC block header) ────────────────

/**
 * Build the raw Vorbis Comment block content (without the 4-byte FLAC block header).
 * Format (all integers little-endian):
 *   vendor_length(4) + vendor_string(UTF-8)
 *   comment_count(4)
 *   for each comment: length(4) + "KEY=VALUE"(UTF-8)
 */
export function buildVorbisCommentBlock(tags: VorbisCommentTags): Uint8Array {
  const comments: Uint8Array[] = []

  const addTag = (key: string, val: string | number | undefined): void => {
    if (val === undefined || val === null) return
    const entry = encodeUtf8(`${key}=${String(val)}`)
    comments.push(entry)
  }

  addTag('TITLE',       tags.title)
  addTag('ARTIST',      tags.artist)
  addTag('ALBUM',       tags.album)
  addTag('TRACKNUMBER', tags.track)
  addTag('DATE',        tags.date)
  addTag('GENRE',       tags.genre)
  addTag('COMMENT',     tags.comment)

  const vendorBytes = encodeUtf8(VENDOR_STRING)

  // Calculate total size
  let totalLen = 4 + vendorBytes.length  // vendor_length + vendor_string
  totalLen += 4                           // comment_count
  for (const c of comments) {
    totalLen += 4 + c.length             // length + entry
  }

  const block  = new Uint8Array(totalLen)
  const view   = new DataView(block.buffer)
  let pos      = 0

  // Vendor string
  writeUint32LE(view, pos, vendorBytes.length); pos += 4
  block.set(vendorBytes, pos); pos += vendorBytes.length

  // Comment count
  writeUint32LE(view, pos, comments.length); pos += 4

  // Comments
  for (const c of comments) {
    writeUint32LE(view, pos, c.length); pos += 4
    block.set(c, pos); pos += c.length
  }

  return block
}

// ─── Insert into FLAC file ────────────────────────────────────────────────────

/**
 * Insert a Vorbis Comment metadata block into a FLAC file after the STREAMINFO block.
 * Adjusts the last_metadata_flag bits accordingly.
 *
 * @param flacBytes - Existing FLAC file bytes (must start with "fLaC")
 * @param tags      - Tags to embed
 * @returns New FLAC bytes with Vorbis Comment block inserted
 */
export function insertVorbisComment(flacBytes: Uint8Array, tags: VorbisCommentTags): Uint8Array {
  // Validate fLaC marker
  if (flacBytes[0] !== 0x66 || flacBytes[1] !== 0x4c ||
      flacBytes[2] !== 0x61 || flacBytes[3] !== 0x43) {
    throw new Error('Not a FLAC file: missing fLaC marker')
  }

  // The first metadata block (STREAMINFO) starts at byte 4
  // Its header byte: bit7 = last_metadata_flag, bits6-0 = block_type
  const streaminfoHeaderByte = flacBytes[4]!
  const streaminfoIsLast     = (streaminfoHeaderByte & 0x80) !== 0
  const streaminfoType       = streaminfoHeaderByte & 0x7f
  // block_length is 3 bytes big-endian at bytes 5-7
  const streaminfoLen =
    ((flacBytes[5]! << 16) | (flacBytes[6]! << 8) | flacBytes[7]!)
  const streaminfoEnd = 4 + 4 + streaminfoLen  // skip marker + header + body

  // Build Vorbis Comment block body
  const commentBody   = buildVorbisCommentBlock(tags)
  const commentLen    = commentBody.length

  // Build 4-byte block header for Vorbis Comment block (type = 4)
  // If STREAMINFO was the last block, the new Vorbis Comment block becomes last instead
  const vcLastFlag    = streaminfoIsLast ? 0x80 : 0x00
  const vcHeader      = new Uint8Array(4)
  vcHeader[0] = vcLastFlag | 4  // block type 4 = VORBIS_COMMENT
  vcHeader[1] = (commentLen >> 16) & 0xff
  vcHeader[2] = (commentLen >> 8) & 0xff
  vcHeader[3] = commentLen & 0xff

  // Update STREAMINFO header: clear last_metadata_flag (since Vorbis Comment comes after)
  // We need to rewrite STREAMINFO header byte
  const newStreaminfoHeaderByte = streaminfoType  // bit 7 = 0 (not last)

  // Build output: fLaC + updated STREAMINFO + Vorbis Comment block + rest of file
  const restStart  = streaminfoEnd
  const restLen    = flacBytes.length - restStart

  const outputLen  = 4                // "fLaC"
                   + 4                // STREAMINFO header (updated)
                   + streaminfoLen    // STREAMINFO body
                   + 4 + commentLen   // Vorbis Comment header + body
                   + restLen          // rest of original file

  const output = new Uint8Array(outputLen)
  let pos = 0

  // "fLaC" marker
  output.set(flacBytes.subarray(0, 4), pos); pos += 4

  // Updated STREAMINFO header byte
  output[pos] = newStreaminfoHeaderByte; pos++
  // STREAMINFO length (3 bytes)
  output[pos] = flacBytes[5]!; pos++
  output[pos] = flacBytes[6]!; pos++
  output[pos] = flacBytes[7]!; pos++

  // STREAMINFO body
  output.set(flacBytes.subarray(8, streaminfoEnd), pos); pos += streaminfoLen

  // Vorbis Comment block header + body
  output.set(vcHeader, pos); pos += 4
  output.set(commentBody, pos); pos += commentLen

  // Rest of file (audio frames)
  output.set(flacBytes.subarray(restStart), pos)

  return output
}
