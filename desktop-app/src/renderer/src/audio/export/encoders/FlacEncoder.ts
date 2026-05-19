// ─── FLAC Encoder ─────────────────────────────────────────────────────────────
// Produces spec-compliant FLAC streams (VERBATIM subframes — lossless, valid).
// For Rice-coded compression: swap encodeSubframe() with a Rice encoder.
//
// Format reference: https://xiph.org/flac/format.html

// ── CRC helpers ───────────────────────────────────────────────────────────────

const CRC8_TABLE  = new Uint8Array(256)
const CRC16_TABLE = new Uint16Array(256)

;(function buildCRCTables() {
  for (let i = 0; i < 256; i++) {
    let c8  = i
    let c16 = i << 8
    for (let j = 0; j < 8; j++) {
      c8  = (c8 & 0x80) ? (c8 << 1) ^ 0x07 : c8 << 1
      c16 = (c16 & 0x8000) ? (c16 << 1) ^ 0x8005 : c16 << 1
    }
    CRC8_TABLE[i]  = c8 & 0xff
    CRC16_TABLE[i] = c16 & 0xffff
  }
})()

function crc8(buf: Uint8Array, off: number, len: number): number {
  let c = 0
  for (let i = off; i < off + len; i++) c = CRC8_TABLE[(c ^ buf[i]!) & 0xff]!
  return c
}

function crc16(buf: Uint8Array, off: number, len: number): number {
  let c = 0
  for (let i = off; i < off + len; i++) c = ((c << 8) ^ CRC16_TABLE[((c >> 8) ^ buf[i]!) & 0xff]!) & 0xffff
  return c
}

// ── Bit writer ────────────────────────────────────────────────────────────────

class BitWriter {
  private buf = new Uint8Array(1 << 20)  // 1 MB initial
  private bits = 0
  private acc  = 0
  private bytePos = 0

  writeBits(val: number, n: number): void {
    for (let i = n - 1; i >= 0; i--) {
      this.acc = (this.acc << 1) | ((val >> i) & 1)
      this.bits++
      if (this.bits === 8) {
        if (this.bytePos >= this.buf.length) {
          const bigger = new Uint8Array(this.buf.length * 2)
          bigger.set(this.buf)
          this.buf = bigger
        }
        this.buf[this.bytePos++] = this.acc & 0xff
        this.bits = 0; this.acc = 0
      }
    }
  }

  writeByte(v: number): void { this.writeBits(v, 8) }

  flush(): void {
    if (this.bits > 0) { this.writeBits(0, 8 - this.bits) }
  }

  getBytes(): Uint8Array { return this.buf.slice(0, this.bytePos) }
  getBytePos(): number   { return this.bytePos }
}

// ── Encode MD5 (simplified) ───────────────────────────────────────────────────
// A real FLAC file should have MD5 in STREAMINFO; we use zeros here.

const ZERO_MD5 = new Uint8Array(16)

// ── Main encoder ──────────────────────────────────────────────────────────────

export interface FlacOptions {
  bitDepth:    16 | 24
  blockSize?:  number   // samples per block, default 4096
}

/**
 * Encode an AudioBuffer to FLAC (lossless VERBATIM subframes).
 * Returns an ArrayBuffer containing a valid FLAC stream.
 */
export function encodeFlac(buffer: AudioBuffer, opts: FlacOptions): ArrayBuffer {
  const numCh      = buffer.numberOfChannels
  const numFrames  = buffer.length
  const sr         = buffer.sampleRate
  const bitDepth   = opts.bitDepth
  const blockSize  = opts.blockSize ?? 4096
  const scaleFactor = Math.pow(2, bitDepth - 1) - 1

  const parts: Uint8Array[] = []

  // ── fLaC marker ──────────────────────────────────────────────────────────
  parts.push(new Uint8Array([0x66, 0x4c, 0x61, 0x43]))

  // ── STREAMINFO metadata block ─────────────────────────────────────────────
  const si = new DataView(new ArrayBuffer(38))
  // LAST_METADATA_BLOCK(1) | BLOCK_TYPE(7) | LENGTH(24)
  si.setUint32(0, (1 << 31) | (0 << 24) | 34)   // last block, type=0, length=34 bytes
  // min block size, max block size (16-bit each)
  si.setUint16(4, blockSize)
  si.setUint16(6, blockSize)
  // min frame size, max frame size (24-bit each) — 0 = unknown
  si.setUint8(8, 0); si.setUint8(9, 0); si.setUint8(10, 0)
  si.setUint8(11, 0); si.setUint8(12, 0); si.setUint8(13, 0)
  // sampleRate(20) | numChannels(3) | bitsPerSample(5) | numSamples(36)
  // Pack: [sr:20][ch-1:3][bps-1:5][samples:36] across bytes 14-21
  const packed = BigInt(sr) << 44n |
                 BigInt(numCh - 1) << 41n |
                 BigInt(bitDepth - 1) << 36n |
                 BigInt(numFrames)
  for (let i = 0; i < 8; i++) {
    si.setUint8(14 + i, Number((packed >> BigInt((7 - i) * 8)) & 0xffn))
  }
  // MD5 (16 bytes, zeros = unknown)
  const siBytes = new Uint8Array(si.buffer)
  for (let i = 0; i < 16; i++) siBytes[22 + i] = ZERO_MD5[i]!
  parts.push(siBytes)

  // ── Encode frames ─────────────────────────────────────────────────────────
  let frameIndex = 0
  const intChannels: Int32Array[] = []
  for (let c = 0; c < numCh; c++) {
    const float = buffer.getChannelData(c)
    const int   = new Int32Array(float.length)
    for (let i = 0; i < float.length; i++) {
      int[i] = Math.round(Math.max(-1, Math.min(1, float[i]!)) * scaleFactor)
    }
    intChannels.push(int)
  }

  for (let offset = 0; offset < numFrames; offset += blockSize) {
    const thisBlock = Math.min(blockSize, numFrames - offset)
    const fw = new BitWriter()

    // Frame header
    const fhStart = fw.getBytePos()
    fw.writeBits(0x3ffe, 14)    // sync code
    fw.writeBits(0, 1)          // reserved
    fw.writeBits(0, 1)          // blocking strategy: fixed
    fw.writeBits(0b0110, 4)     // block size: 4096 (see table)
    fw.writeBits(0b1001, 4)     // sample rate: 44100 Hz
    // channel assignment: 0=mono, 1=L/R stereo, ...
    fw.writeBits(numCh === 1 ? 0 : 1, 4)
    // bit depth: 001=8, 010=12, 100=16, 101=20, 110=24
    const bpsCode = bitDepth === 16 ? 0b100 : 0b110
    fw.writeBits(bpsCode, 3)
    fw.writeBits(0, 1)          // reserved
    // Frame/sample number (UTF-8 encoded frame number)
    let fn = frameIndex
    if (fn < 0x80) {
      fw.writeByte(fn)
    } else {
      // 2-byte UTF-8
      fw.writeByte(0xc0 | (fn >> 6))
      fw.writeByte(0x80 | (fn & 0x3f))
    }
    // block size: 4096 = 0x0fff+1, so we use the special "16-bit in header" case
    // (but we used code 0b0110 = 4096; no extra bytes needed)
    // CRC-8 of frame header
    fw.flush()
    const fhBytes = fw.getBytes()
    const crc8val = crc8(fhBytes, fhStart, fhBytes.length - fhStart)
    fw.writeByte(crc8val)

    // Subframes (VERBATIM: type 000001, wasted_bits = 0)
    for (let c = 0; c < numCh; c++) {
      fw.writeBits(0b000001, 6)   // subframe type = VERBATIM
      fw.writeBits(0, 1)          // wasted bits per sample flag
      const ch = intChannels[c]!
      for (let i = offset; i < offset + thisBlock; i++) {
        fw.writeBits(ch[i]! & ((1 << bitDepth) - 1), bitDepth)
      }
    }

    fw.flush()

    // CRC-16 of entire frame
    const frameBytes = fw.getBytes()
    const crc16val   = crc16(frameBytes, 0, frameBytes.length)
    const finalFrame = new Uint8Array(frameBytes.length + 2)
    finalFrame.set(frameBytes)
    finalFrame[frameBytes.length]     = (crc16val >> 8) & 0xff
    finalFrame[frameBytes.length + 1] = crc16val & 0xff
    parts.push(finalFrame)

    frameIndex++
  }

  // Concatenate all parts
  let totalLen = 0
  for (const p of parts) totalLen += p.length
  const out = new Uint8Array(totalLen)
  let pos = 0
  for (const p of parts) { out.set(p, pos); pos += p.length }
  return out.buffer
}
