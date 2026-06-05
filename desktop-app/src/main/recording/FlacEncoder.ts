// FlacEncoder — minimal valid FLAC encoder using VERBATIM subframes
// Pure Node.js Buffer manipulation; no npm packages, no native binaries.
// Uses BLOCK_SIZE=4096, VERBATIM subframes (uncompressed), valid CRC-8/CRC-16.
import { createWriteStream, WriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

const BLOCK_SIZE = 4096

export class FlacEncoder {
  private _stream: WriteStream | null = null
  private _filePath: string
  private _tmpPath: string
  private _sampleRate: number
  private _channelCount: number
  private _bitDepth: 16 | 24
  private _sampleBuffer: Float32Array
  private _bufferFill: number = 0
  private _frameNumber: number = 0
  private _totalSamples: number = 0
  private _opened: boolean = false
  private _finalized: boolean = false

  constructor(
    filePath: string,
    sampleRate: number,
    channelCount: number,
    bitDepth: 16 | 24,
  ) {
    this._filePath = filePath
    this._tmpPath = filePath + '.tmp'
    this._sampleRate = sampleRate
    this._channelCount = channelCount
    this._bitDepth = bitDepth
    // Buffer holds interleaved samples for up to BLOCK_SIZE frames
    this._sampleBuffer = new Float32Array(BLOCK_SIZE * channelCount)
  }

  async open(): Promise<void> {
    if (this._opened) throw new Error('FlacEncoder already opened')
    this._opened = true
    await fs.mkdir(dirname(this._tmpPath), { recursive: true })

    await new Promise<void>((resolve, reject) => {
      this._stream = createWriteStream(this._tmpPath)
      this._stream.once('open', () => resolve())
      this._stream.once('error', reject)
    })

    this._writeStreamHeader()
  }

  writeChunk(interleavedFloat32: Float32Array): void {
    if (!this._stream || this._finalized) return

    let inputOffset = 0
    while (inputOffset < interleavedFloat32.length) {
      // How many interleaved samples fit before the buffer is full?
      const remaining = (BLOCK_SIZE - this._bufferFill) * this._channelCount
      const toCopy = Math.min(remaining, interleavedFloat32.length - inputOffset)
      this._sampleBuffer.set(
        interleavedFloat32.subarray(inputOffset, inputOffset + toCopy),
        this._bufferFill * this._channelCount,
      )
      this._bufferFill += toCopy / this._channelCount
      inputOffset += toCopy

      if (this._bufferFill === BLOCK_SIZE) {
        this._encodeFrame(BLOCK_SIZE)
        this._bufferFill = 0
      }
    }
  }

  async finalize(): Promise<{ totalSamples: number; fileSizeBytes: number }> {
    if (this._finalized) throw new Error('FlacEncoder already finalized')
    this._finalized = true

    // Flush any remaining buffered samples
    if (this._bufferFill > 0) {
      this._encodeFrame(this._bufferFill)
      this._bufferFill = 0
    }

    await this._closeStream()
    await this._patchStreamInfo()
    await fs.rename(this._tmpPath, this._filePath)

    const stat = await fs.stat(this._filePath)
    return { totalSamples: this._totalSamples, fileSizeBytes: stat.size }
  }

  async abort(): Promise<void> {
    this._finalized = true
    await this._closeStream()
    try {
      await fs.unlink(this._tmpPath)
    } catch {
      // already gone
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _writeStreamHeader(): void {
    // fLaC marker
    const marker = Buffer.from([0x66, 0x4c, 0x61, 0x43])
    this._stream!.write(marker)

    // STREAMINFO metadata block
    // Metadata block header: last-metadata-block=1 (bit7), type=0 (bits6-0), length=34 (24 bits)
    const metaHeader = Buffer.alloc(4)
    metaHeader[0] = 0x80  // LAST=1, type=0 (STREAMINFO)
    metaHeader[1] = 0x00
    metaHeader[2] = 0x00
    metaHeader[3] = 34    // 34-byte STREAMINFO block
    this._stream!.write(metaHeader)

    this._stream!.write(this._buildStreamInfoBlock())
  }

  private _buildStreamInfoBlock(): Buffer {
    // STREAMINFO is 34 bytes:
    // [0-1]   min block size (16 bits)
    // [2-3]   max block size (16 bits)
    // [4-6]   min frame size (24 bits, 0 = unknown)
    // [7-9]   max frame size (24 bits, 0 = unknown)
    // [10-13] sample rate (20 bits) | channels-1 (3 bits) | bitDepth-1 (5 bits)
    // [14-17] total samples (36 bits, high 4 bits in byte 14) | start of MD5 (remaining)
    // [18-33] MD5 signature (128 bits = 16 bytes; we use zeros)
    const buf = Buffer.alloc(34, 0)

    buf.writeUInt16BE(BLOCK_SIZE, 0)   // min block size
    buf.writeUInt16BE(BLOCK_SIZE, 2)   // max block size
    // min/max frame size: 0 = unknown
    buf.writeUIntBE(0, 4, 3)
    buf.writeUIntBE(0, 7, 3)

    // Pack: sampleRate(20) | channels-1(3) | bitDepth-1(5) | totalSamples-hi4(4) = 32 bits
    // Then totalSamples-lo32(32 bits) and MD5
    const sr = this._sampleRate & 0xfffff
    const ch = (this._channelCount - 1) & 0x7
    const bd = (this._bitDepth - 1) & 0x1f
    // total samples = 0 for now (patched on finalize)
    // Byte 10: sr[19:12]
    buf[10] = (sr >> 12) & 0xff
    // Byte 11: sr[11:4]
    buf[11] = (sr >> 4) & 0xff
    // Byte 12: sr[3:0] | ch[2:0] | bd[4]
    buf[12] = ((sr & 0xf) << 4) | (ch << 1) | ((bd >> 4) & 1)
    // Byte 13: bd[3:0] | totalSamples[35:32] = 0
    buf[13] = (bd & 0xf) << 4
    // Bytes 14-17: totalSamples[31:0] = 0 (patched later)
    // Bytes 18-33: MD5 = all zeros

    return buf
  }

  private _encodeFrame(blockSize: number): void {
    // Deinterleave
    const channels: Int32Array[] = []
    for (let c = 0; c < this._channelCount; c++) {
      const ch = new Int32Array(blockSize)
      for (let i = 0; i < blockSize; i++) {
        const f = this._sampleBuffer[i * this._channelCount + c]
        const clamped = Math.max(-1, Math.min(1, f))
        if (this._bitDepth === 16) {
          ch[i] = Math.round(clamped * 32767)
        } else {
          ch[i] = Math.round(clamped * 8388607)
        }
      }
      channels.push(ch)
    }

    const header = encodeFrameHeader(
      this._frameNumber,
      blockSize,
      this._sampleRate,
      this._channelCount,
      this._bitDepth,
    )

    const subframes: Buffer[] = channels.map(ch =>
      encodeVerbatimSubframe(ch, this._bitDepth),
    )

    // Assemble frame body (header + subframes), then append CRC-16
    const frameBody = Buffer.concat([header, ...subframes])
    const crc = crc16(frameBody)
    const crcBuf = Buffer.alloc(2)
    crcBuf.writeUInt16BE(crc, 0)

    this._stream!.write(frameBody)
    this._stream!.write(crcBuf)

    this._totalSamples += blockSize
    this._frameNumber++
  }

  private async _closeStream(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this._stream) { resolve(); return }
      this._stream.end((err?: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  private async _patchStreamInfo(): Promise<void> {
    // STREAMINFO starts at offset: 4 (marker) + 4 (meta header) = 8
    // totalSamples occupies 36 bits starting at bit 4 of byte 13 (relative to STREAMINFO start)
    // Absolute offsets in file:
    //   byte 8+13 = 21: high 4 bits = bd[3:0], low 4 bits = totalSamples[35:32]
    //   bytes 8+14 .. 8+17 = 22..25: totalSamples[31:0]
    const fd = await fs.open(this._tmpPath, 'r+')
    try {
      // Read byte 21 to preserve the bitDepth bits
      const readBuf = Buffer.alloc(1)
      await fd.read(readBuf, 0, 1, 21)
      const existingByte = readBuf[0]

      const ts = this._totalSamples

      // totalSamples is at most 2^36-1; for reasonable audio lengths fits in 32 bits
      // high 4 bits of totalSamples go into low nibble of byte 21
      const tsHigh4 = (ts / 0x100000000) >>> 0  // bits 35:32 (will be 0 for <4B samples)
      const tsLow32 = ts >>> 0

      const patchBuf = Buffer.alloc(5)
      patchBuf[0] = (existingByte & 0xf0) | (tsHigh4 & 0x0f)
      patchBuf.writeUInt32BE(tsLow32, 1)

      await fd.write(patchBuf, 0, 5, 21)
    } finally {
      await fd.close()
    }
  }
}

// ── Exported helpers (also used in tests) ────────────────────────────────────

export function encodeUtf8Number(n: number): Buffer {
  // FLAC "UTF-8 coded integer" — same encoding as UTF-8 but for arbitrary integers
  if (n < 0x80) {
    return Buffer.from([n])
  } else if (n < 0x800) {
    return Buffer.from([0xc0 | (n >> 6), 0x80 | (n & 0x3f)])
  } else if (n < 0x10000) {
    return Buffer.from([0xe0 | (n >> 12), 0x80 | ((n >> 6) & 0x3f), 0x80 | (n & 0x3f)])
  } else if (n < 0x200000) {
    return Buffer.from([
      0xf0 | (n >> 18),
      0x80 | ((n >> 12) & 0x3f),
      0x80 | ((n >> 6) & 0x3f),
      0x80 | (n & 0x3f),
    ])
  } else if (n < 0x4000000) {
    return Buffer.from([
      0xf8 | (n >> 24),
      0x80 | ((n >> 18) & 0x3f),
      0x80 | ((n >> 12) & 0x3f),
      0x80 | ((n >> 6) & 0x3f),
      0x80 | (n & 0x3f),
    ])
  } else {
    return Buffer.from([
      0xfc | (n >> 30),
      0x80 | ((n >> 24) & 0x3f),
      0x80 | ((n >> 18) & 0x3f),
      0x80 | ((n >> 12) & 0x3f),
      0x80 | ((n >> 6) & 0x3f),
      0x80 | (n & 0x3f),
    ])
  }
}

export function crc8(data: Buffer): number {
  let crc = 0
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let b = 0; b < 8; b++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0x07) & 0xff
      } else {
        crc = (crc << 1) & 0xff
      }
    }
  }
  return crc
}

export function crc16(data: Buffer): number {
  let crc = 0
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8
    for (let b = 0; b < 8; b++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x8005) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc
}

export function encodeVerbatimSubframe(samples: Int32Array, bitsPerSample: number): Buffer {
  // Subframe header: 0b000001_0_0 = type VERBATIM (0b000001), wasted_bits_flag=0
  // = 0x02
  const subframeHeader = 0x02

  // Pack samples as bitsPerSample-wide values, MSB first, into a bit stream
  const totalBits = 8 + samples.length * bitsPerSample  // 8 for header byte
  const totalBytes = Math.ceil(totalBits / 8)
  const buf = Buffer.alloc(totalBytes, 0)

  buf[0] = subframeHeader

  let bitOffset = 8  // start after the header byte
  for (let i = 0; i < samples.length; i++) {
    let sample = samples[i]
    // Write bitsPerSample bits MSB-first
    for (let b = bitsPerSample - 1; b >= 0; b--) {
      const bit = (sample >> b) & 1
      const byteIdx = bitOffset >> 3
      const bitIdx = 7 - (bitOffset & 7)
      buf[byteIdx] |= bit << bitIdx
      bitOffset++
    }
  }

  return buf
}

export function encodeFrameHeader(
  frameNumber: number,
  blockSize: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Buffer {
  // Frame sync code: 11111111111110 (14 bits) + reserved(0) + blockingStrategy(0=fixed)
  // = 0xFF 0xF8
  const parts: number[] = [0xff, 0xf8]

  // Block size code (4 bits) — we use 0b0111 for 4096, or 0b0110 for explicit 16-bit at end
  let blockSizeCode: number
  let extraBlockSize: number | null = null
  if (blockSize === 192) {
    blockSizeCode = 0b0001
  } else if (blockSize === 576) {
    blockSizeCode = 0b0010
  } else if (blockSize === 1152) {
    blockSizeCode = 0b0011
  } else if (blockSize === 2304) {
    blockSizeCode = 0b0100
  } else if (blockSize === 4608) {
    blockSizeCode = 0b0101
  } else if (blockSize === 256) {
    blockSizeCode = 0b1000
  } else if (blockSize === 512) {
    blockSizeCode = 0b1001
  } else if (blockSize === 1024) {
    blockSizeCode = 0b1010
  } else if (blockSize === 2048) {
    blockSizeCode = 0b1011
  } else if (blockSize === 4096) {
    blockSizeCode = 0b1100
  } else if (blockSize === 8192) {
    blockSizeCode = 0b1101
  } else if (blockSize === 16384) {
    blockSizeCode = 0b1110
  } else if (blockSize === 32768) {
    blockSizeCode = 0b1111
  } else if (blockSize <= 256) {
    blockSizeCode = 0b0110  // 8-bit (blockSize-1) follows
    extraBlockSize = blockSize - 1
  } else {
    blockSizeCode = 0b0111  // 16-bit (blockSize-1) follows
    extraBlockSize = blockSize - 1
  }

  // Sample rate code (4 bits)
  let sampleRateCode: number
  let extraSampleRate: number | null = null
  switch (sampleRate) {
    case 88200:  sampleRateCode = 0b0001; break
    case 176400: sampleRateCode = 0b0010; break
    case 192000: sampleRateCode = 0b0011; break
    case 8000:   sampleRateCode = 0b0100; break
    case 16000:  sampleRateCode = 0b0101; break
    case 22050:  sampleRateCode = 0b0110; break
    case 24000:  sampleRateCode = 0b0111; break
    case 32000:  sampleRateCode = 0b1000; break
    case 44100:  sampleRateCode = 0b1001; break
    case 48000:  sampleRateCode = 0b1010; break
    case 96000:  sampleRateCode = 0b1011; break
    default:
      // Use explicit Hz in 16-bit field
      sampleRateCode = 0b1110
      extraSampleRate = sampleRate
      break
  }

  // Channel assignment (4 bits)
  // 0b0000..0b0111 = independent channels (value = count-1)
  // 0b1000 = left/side stereo, 0b1001 = right/side, 0b1010 = mid/side
  // For simplicity use independent assignment
  const channelCode = channels - 1  // 0b0000 = mono, 0b0001 = stereo, etc.

  // Bit depth code (3 bits)
  let bitDepthCode: number
  switch (bitsPerSample) {
    case 8:  bitDepthCode = 0b001; break
    case 12: bitDepthCode = 0b010; break
    case 16: bitDepthCode = 0b100; break
    case 20: bitDepthCode = 0b101; break
    case 24: bitDepthCode = 0b110; break
    default: bitDepthCode = 0b000; break  // get from STREAMINFO
  }

  // Byte 2: blockSizeCode(4) | sampleRateCode(4)
  parts.push((blockSizeCode << 4) | sampleRateCode)
  // Byte 3: channelCode(4) | bitDepthCode(3) | reserved(1)=0
  parts.push((channelCode << 4) | (bitDepthCode << 1) | 0)

  // Frame number (UTF-8 coded)
  const frameNumBytes = encodeUtf8Number(frameNumber)

  // Build header up to CRC (excluding CRC-8 byte itself)
  const prelude = Buffer.from(parts)
  const headerNoCrc = Buffer.concat([prelude, frameNumBytes])

  // Optional extra block size bytes
  let extrasArr: number[] = []
  if (extraBlockSize !== null) {
    if (blockSizeCode === 0b0110) {
      extrasArr.push(extraBlockSize & 0xff)
    } else {
      extrasArr.push((extraBlockSize >> 8) & 0xff, extraBlockSize & 0xff)
    }
  }
  if (extraSampleRate !== null) {
    extrasArr.push((extraSampleRate >> 8) & 0xff, extraSampleRate & 0xff)
  }

  const extrasAndCrcInput = Buffer.concat([
    headerNoCrc,
    Buffer.from(extrasArr),
  ])

  const checksum = crc8(extrasAndCrcInput)
  return Buffer.concat([extrasAndCrcInput, Buffer.from([checksum])])
}
