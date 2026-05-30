// WavWriter — streaming WAV writer with atomic tmp→final rename
// Writes a 44-byte placeholder RIFF header on open(), streams PCM chunks,
// patches the RIFF and data size fields on finalize().
import { createWriteStream, WriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

export class WavWriter {
  private _stream: WriteStream | null = null
  private _filePath: string
  private _tmpPath: string
  private _sampleRate: number
  private _channelCount: number
  private _bitDepth: 16 | 24 | 32
  private _bytesPerSample: number
  private _dataByteCount: number = 0
  private _headerWritten: boolean = false
  private _finalized: boolean = false

  constructor(
    filePath: string,
    sampleRate: number,
    channelCount: number,
    bitDepth: 16 | 24 | 32,
  ) {
    this._filePath = filePath
    this._tmpPath = filePath + '.tmp'
    this._sampleRate = sampleRate
    this._channelCount = channelCount
    this._bitDepth = bitDepth
    this._bytesPerSample = bitDepth === 24 ? 3 : bitDepth / 8
  }

  // Open stream and write the 44-byte placeholder RIFF header
  async open(): Promise<void> {
    if (this._headerWritten) throw new Error('WavWriter already opened')
    await fs.mkdir(dirname(this._tmpPath), { recursive: true })

    await new Promise<void>((resolve, reject) => {
      this._stream = createWriteStream(this._tmpPath)
      this._stream.once('open', () => resolve())
      this._stream.once('error', reject)
    })

    this._writePlaceholderHeader()
    this._headerWritten = true
  }

  // Write interleaved PCM samples (Float32 input, converted per bitDepth)
  writeChunk(interleavedFloat32: Float32Array): void {
    if (!this._stream || this._finalized) return

    const sampleCount = interleavedFloat32.length
    const buf = Buffer.allocUnsafe(sampleCount * this._bytesPerSample)
    let offset = 0

    if (this._bitDepth === 16) {
      for (let i = 0; i < sampleCount; i++) {
        const clamped = Math.max(-1, Math.min(1, interleavedFloat32[i]))
        const val = Math.round(clamped * 32767)
        buf.writeInt16LE(val, offset)
        offset += 2
      }
    } else if (this._bitDepth === 24) {
      for (let i = 0; i < sampleCount; i++) {
        const clamped = Math.max(-1, Math.min(1, interleavedFloat32[i]))
        let val = Math.round(clamped * 8388607)
        // Write 3 bytes little-endian
        buf[offset]     = val & 0xff
        buf[offset + 1] = (val >> 8) & 0xff
        buf[offset + 2] = (val >> 16) & 0xff
        // Handle negative (two's complement already handled by bit ops on int32)
        if (val < 0) {
          // Force sign extension — buf already has correct two's complement bytes
          // from the bitwise ops above (JS bitwise works on 32-bit signed int)
          void val
        }
        offset += 3
      }
    } else {
      // 32-bit: write raw float32 bytes (IEEE 754), format code 3 (IEEE_FLOAT)
      for (let i = 0; i < sampleCount; i++) {
        buf.writeFloatLE(interleavedFloat32[i], offset)
        offset += 4
      }
    }

    this._stream.write(buf)
    this._dataByteCount += buf.length
  }

  // Patch RIFF/data size fields and atomically rename tmp → final path
  async finalize(): Promise<{ totalSamples: number; fileSizeBytes: number }> {
    if (this._finalized) throw new Error('WavWriter already finalized')
    this._finalized = true

    await this._closeStream()
    await this._patchSizeFields()

    await fs.rename(this._tmpPath, this._filePath)

    const fileSizeBytes = 44 + this._dataByteCount
    const totalSamples = this._dataByteCount / (this._bytesPerSample * this._channelCount)

    return { totalSamples, fileSizeBytes }
  }

  // Close and delete the temp file without producing a final recording
  async abort(): Promise<void> {
    this._finalized = true
    await this._closeStream()
    try {
      await fs.unlink(this._tmpPath)
    } catch {
      // already gone — that's fine
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _writePlaceholderHeader(): void {
    const header = Buffer.alloc(44, 0)
    const formatCode = this._bitDepth === 32 ? 3 : 1  // 3 = IEEE_FLOAT, 1 = PCM
    const blockAlign = this._channelCount * this._bytesPerSample
    const byteRate = this._sampleRate * blockAlign

    // RIFF chunk
    header.write('RIFF', 0, 'ascii')
    header.writeUInt32LE(0, 4)          // placeholder: total file size - 8
    header.write('WAVE', 8, 'ascii')

    // fmt  sub-chunk
    header.write('fmt ', 12, 'ascii')
    header.writeUInt32LE(16, 16)        // sub-chunk size
    header.writeUInt16LE(formatCode, 20)
    header.writeUInt16LE(this._channelCount, 22)
    header.writeUInt32LE(this._sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(this._bitDepth, 34)

    // data sub-chunk
    header.write('data', 36, 'ascii')
    header.writeUInt32LE(0, 40)         // placeholder: data byte count

    this._stream!.write(header)
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

  private async _patchSizeFields(): Promise<void> {
    const riffChunkSize = 36 + this._dataByteCount  // file size - 8
    const dataChunkSize = this._dataByteCount

    const fd = await fs.open(this._tmpPath, 'r+')
    try {
      const riffBuf = Buffer.alloc(4)
      riffBuf.writeUInt32LE(riffChunkSize, 0)
      await fd.write(riffBuf, 0, 4, 4)

      const dataBuf = Buffer.alloc(4)
      dataBuf.writeUInt32LE(dataChunkSize, 0)
      await fd.write(dataBuf, 0, 4, 40)
    } finally {
      await fd.close()
    }
  }
}
