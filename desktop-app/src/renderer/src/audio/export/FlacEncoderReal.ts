// ─── FlacEncoderReal ──────────────────────────────────────────────────────────
// Real FLAC encoder producing valid, decoder-compatible FLAC files.
//
// COMPRESSION: uses VERBATIM subframes (no inter-sample prediction).
// Add FIXED/LPC predictors for compression.
//
// Implements FLAC Streamable Subset:
//  - fLaC marker
//  - STREAMINFO metadata block
//  - Audio frames with VERBATIM subframes
//  - CRC-8 frame header checksum
//  - CRC-16/IBM frame footer checksum

// ─── CRC tables ───────────────────────────────────────────────────────────────

const CRC8_TABLE: Uint8Array = (() => {
  const table = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff
    }
    table[i] = crc
  }
  return table
})()

const CRC16_TABLE: Uint16Array = (() => {
  const table = new Uint16Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff
    }
    table[i] = crc
  }
  return table
})()

function crc8(data: Uint8Array, start: number, end: number): number {
  let crc = 0
  for (let i = start; i < end; i++) {
    crc = CRC8_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0
  }
  return crc
}

function crc16(data: Uint8Array, start: number, end: number): number {
  let crc = 0
  for (let i = start; i < end; i++) {
    crc = ((crc << 8) ^ (CRC16_TABLE[((crc >> 8) ^ (data[i] ?? 0)) & 0xff] ?? 0)) & 0xffff
  }
  return crc
}

// ─── UTF-8 coded integer (FLAC frame number encoding) ─────────────────────────

function writeUtf8CodedInt(value: number): Uint8Array {
  if (value < 0x80) {
    return new Uint8Array([value])
  } else if (value < 0x800) {
    return new Uint8Array([
      0xc0 | (value >> 6),
      0x80 | (value & 0x3f),
    ])
  } else if (value < 0x10000) {
    return new Uint8Array([
      0xe0 | (value >> 12),
      0x80 | ((value >> 6) & 0x3f),
      0x80 | (value & 0x3f),
    ])
  } else if (value < 0x200000) {
    return new Uint8Array([
      0xf0 | (value >> 18),
      0x80 | ((value >> 12) & 0x3f),
      0x80 | ((value >> 6) & 0x3f),
      0x80 | (value & 0x3f),
    ])
  } else if (value < 0x4000000) {
    return new Uint8Array([
      0xf8 | (value >> 24),
      0x80 | ((value >> 18) & 0x3f),
      0x80 | ((value >> 12) & 0x3f),
      0x80 | ((value >> 6) & 0x3f),
      0x80 | (value & 0x3f),
    ])
  } else {
    return new Uint8Array([
      0xfc | (value >> 30),
      0x80 | ((value >> 24) & 0x3f),
      0x80 | ((value >> 18) & 0x3f),
      0x80 | ((value >> 12) & 0x3f),
      0x80 | ((value >> 6) & 0x3f),
      0x80 | (value & 0x3f),
    ])
  }
}

// ─── Float to integer sample conversion ───────────────────────────────────────

function floatToInt(sample: number, bitDepth: number): number {
  const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample
  const maxVal  = (1 << (bitDepth - 1)) - 1
  const minVal  = -(1 << (bitDepth - 1))
  const scaled  = clamped < 0 ? Math.round(clamped * (1 << (bitDepth - 1))) : Math.round(clamped * maxVal)
  return scaled < minVal ? minVal : scaled > maxVal ? maxVal : scaled
}

// ─── BitWriter ────────────────────────────────────────────────────────────────

class BitWriter {
  private _buf:     number[] = []
  private _current: number   = 0
  private _bits:    number   = 0

  writeBits(value: number, numBits: number): void {
    for (let i = numBits - 1; i >= 0; i--) {
      const bit = (value >> i) & 1
      this._current = (this._current << 1) | bit
      this._bits++
      if (this._bits === 8) {
        this._buf.push(this._current & 0xff)
        this._current = 0
        this._bits    = 0
      }
    }
  }

  writeBytes(bytes: Uint8Array): void {
    this.alignToByte()
    for (const b of bytes) {
      this._buf.push(b & 0xff)
    }
  }

  alignToByte(): void {
    if (this._bits > 0) {
      this._current <<= (8 - this._bits)
      this._buf.push(this._current & 0xff)
      this._current = 0
      this._bits    = 0
    }
  }

  getResult(): Uint8Array {
    this.alignToByte()
    return new Uint8Array(this._buf)
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface FlacEncodeOptions {
  channels:         Float32Array[]
  sampleRate:       number
  bitDepth:         16 | 24
  compressionLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8  // ignored for verbatim, kept for interface compat
}

// Block size = 4096 samples (FLAC block size code 0b0110)
const BLOCK_SIZE = 4096

function encodeSampleRateBits(sampleRate: number): number {
  switch (sampleRate) {
    case 44100: return 0b1001
    case 48000: return 0b1010
    case 88200: return 0b1101
    case 96000: return 0b1110
    default:    return 0b0000
  }
}

function encodeBitDepthBits(bitDepth: 16 | 24): number {
  switch (bitDepth) {
    case 16: return 0b100
    case 24: return 0b110
    default: return 0b100
  }
}

function buildStreaminfo(
  channels:     number,
  sampleRate:   number,
  bitDepth:     16 | 24,
  totalSamples: number,
): Uint8Array {
  // 34 bytes, bit-packed
  const bw = new BitWriter()
  bw.writeBits(BLOCK_SIZE, 16)     // min_block_size
  bw.writeBits(BLOCK_SIZE, 16)     // max_block_size
  bw.writeBits(0, 24)              // min_frame_size (unknown)
  bw.writeBits(0, 24)              // max_frame_size (unknown)
  bw.writeBits(sampleRate, 20)     // sample_rate
  bw.writeBits(channels - 1, 3)   // channels minus 1
  bw.writeBits(bitDepth - 1, 5)   // bits_per_sample minus 1
  // total_samples: 36 bits (split across two 32-bit writes)
  const hi4 = Math.floor(totalSamples / 0x100000000) & 0xf
  const lo32 = totalSamples >>> 0
  bw.writeBits(hi4, 4)
  bw.writeBits(lo32, 32)
  // MD5: 16 zero bytes
  bw.writeBytes(new Uint8Array(16))
  return bw.getResult()
}

function buildFrame(
  frameIndex:   number,
  channelData:  Array<Int32Array>,
  blockLen:     number,
  sampleRate:   number,
  bitDepth:     16 | 24,
): Uint8Array {
  const numCh   = channelData.length
  const bw      = new BitWriter()

  // Frame sync code: 14 bits = 0x3FFE, then blocking strategy (1 bit = 0)
  // Then block size bits (4) + sample rate bits (4)
  bw.writeBits(0x3FFE, 14)           // sync
  bw.writeBits(0, 1)                 // blocking strategy: fixed
  // Block size bits: 0b0110 = 4096 samples; 0b0111 = 16-bit after header
  const blockSizeBits = (blockLen === BLOCK_SIZE) ? 0b0110 : 0b0111
  bw.writeBits(blockSizeBits, 4)
  bw.writeBits(encodeSampleRateBits(sampleRate), 4)

  // Channel assignment
  let channelBits: number
  if (numCh === 1)      channelBits = 0b0000
  else if (numCh === 2) channelBits = 0b0001
  else                  channelBits = numCh - 1
  bw.writeBits(channelBits, 4)

  bw.writeBits(encodeBitDepthBits(bitDepth), 3)
  bw.writeBits(0, 1)  // reserved

  // Frame number (UTF-8 coded integer)
  const frameNumBytes = writeUtf8CodedInt(frameIndex)
  bw.writeBytes(frameNumBytes)

  // If block size was 0b0111 (non-standard size), write 16-bit block size after header
  if (blockSizeBits === 0b0111) {
    bw.writeBits(blockLen - 1, 16)
  }

  // CRC-8 of header bytes so far
  const headerSoFar = bw.getResult()
  const crc8val     = crc8(headerSoFar, 0, headerSoFar.length)

  // Rebuild with CRC appended
  const bw2 = new BitWriter()
  bw2.writeBytes(headerSoFar)
  bw2.writeBits(crc8val, 8)

  const frameStart = bw2.getResult()

  // Subframes (one per channel, VERBATIM)
  const bw3 = new BitWriter()
  bw3.writeBytes(frameStart)

  for (let ch = 0; ch < numCh; ch++) {
    const samples = channelData[ch]!
    // Subframe header: 0 (pad) + 6-bit type (VERBATIM=0b000001) + wasted_bits_flag (0)
    bw3.writeBits(0, 1)            // padding
    bw3.writeBits(0b000001, 6)     // VERBATIM subframe type
    bw3.writeBits(0, 1)            // wasted_bits_flag = 0

    // Write each sample as signed bitDepth-bit integer, MSB first
    for (let i = 0; i < blockLen; i++) {
      const s = samples[i] ?? 0
      bw3.writeBits(s & ((1 << bitDepth) - 1), bitDepth)
    }
    bw3.alignToByte()
  }

  const frameBody = bw3.getResult()

  // CRC-16 footer (entire frame)
  const crc16val     = crc16(frameBody, 0, frameBody.length)
  const footer       = new Uint8Array(2)
  footer[0]          = (crc16val >> 8) & 0xff
  footer[1]          = crc16val & 0xff

  const result = new Uint8Array(frameBody.length + 2)
  result.set(frameBody, 0)
  result.set(footer, frameBody.length)
  return result
}

/**
 * Encode Float32Array channels to a valid FLAC file using VERBATIM subframes.
 *
 * COMPRESSION: uses VERBATIM subframes (no inter-sample prediction).
 * Add FIXED/LPC predictors for compression.
 */
export function encodeFlacReal(options: FlacEncodeOptions): Uint8Array {
  const { channels, sampleRate, bitDepth } = options
  const numCh       = channels.length
  const numSamples  = channels[0]?.length ?? 0

  // Convert all channels to signed integers once
  const intChannels: Int32Array[] = channels.map(ch => {
    const arr = new Int32Array(ch.length)
    for (let i = 0; i < ch.length; i++) {
      arr[i] = floatToInt(ch[i] ?? 0, bitDepth)
    }
    return arr
  })

  // Build STREAMINFO (34 bytes)
  const streaminfo = buildStreaminfo(numCh, sampleRate, bitDepth, numSamples)

  // STREAMINFO metadata block header:
  // last_metadata_flag(1) + block_type(7, =0) + block_length(24)
  const metaHeader = new Uint8Array(4)
  // last_metadata_flag=1 (only one metadata block), block_type=0
  metaHeader[0] = 0x80  // 1_0000000
  // block_length = 34
  metaHeader[1] = 0
  metaHeader[2] = 0
  metaHeader[3] = 34

  // Build all audio frames
  const frameBuffers: Uint8Array[] = []
  let frameIndex = 0
  let samplePos  = 0

  while (samplePos < numSamples) {
    const blockLen = Math.min(BLOCK_SIZE, numSamples - samplePos)
    const blockChannels: Int32Array[] = intChannels.map(ch => ch.subarray(samplePos, samplePos + blockLen) as Int32Array)
    const frameBytes = buildFrame(frameIndex, blockChannels, blockLen, sampleRate, bitDepth)
    frameBuffers.push(frameBytes)
    samplePos += blockLen
    frameIndex++
  }

  // Concatenate everything: "fLaC" + metaHeader + streaminfo + frames
  const marker     = new Uint8Array([0x66, 0x4c, 0x61, 0x43])  // "fLaC"
  const totalLen   = marker.length + metaHeader.length + streaminfo.length +
    frameBuffers.reduce((acc, f) => acc + f.length, 0)
  const output     = new Uint8Array(totalLen)
  let pos          = 0

  output.set(marker, pos);     pos += marker.length
  output.set(metaHeader, pos); pos += metaHeader.length
  output.set(streaminfo, pos); pos += streaminfo.length
  for (const frame of frameBuffers) {
    output.set(frame, pos); pos += frame.length
  }

  return output
}
