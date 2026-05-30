// ─── WavWriter.test.ts ────────────────────────────────────────────────────────

import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { WavWriter } from '../../src/main/recording/WavWriter.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'

// Files to clean up after each test
const tempFiles: string[] = []

function uniquePath(suffix = '.wav'): string {
  return join(tmpdir(), `wavwriter-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${suffix}`)
}

/** Register a final path for cleanup; also registers its .tmp sibling */
function track(path: string): string {
  tempFiles.push(path)
  tempFiles.push(path + '.tmp')
  return path
}

afterEach(async () => {
  while (tempFiles.length > 0) {
    const p = tempFiles.pop()!
    await fs.unlink(p).catch(() => {})
  }
})

// ─── open() ───────────────────────────────────────────────────────────────────

describe('WavWriter / open()', () => {
  it('open() creates temp file', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 2, 16)
    await writer.open()
    const tmpPath = path + '.tmp'
    const stat = await fs.stat(tmpPath)
    assert.ok(stat.isFile(), '.tmp file should exist after open()')
    await writer.abort()
  })
})

// ─── finalize produces valid RIFF header ─────────────────────────────────────

describe('WavWriter / RIFF header', () => {
  it('finalize produces RIFF header — bytes 0-3 === "RIFF"', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 2, 16)
    await writer.open()
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF')
  })

  it('finalize produces RIFF header — bytes 8-11 === "WAVE"', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 2, 16)
    await writer.open()
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.subarray(8, 12).toString('ascii'), 'WAVE')
  })
})

// ─── fmt chunk ────────────────────────────────────────────────────────────────

describe('WavWriter / fmt chunk', () => {
  it('fmt chunk present — bytes 12-15 === "fmt "', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 1, 16)
    await writer.open()
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.subarray(12, 16).toString('ascii'), 'fmt ')
  })

  it('fmt chunk: sampleRate — UInt32LE at offset 24 === sampleRate param', async () => {
    const sampleRate = 48000
    const path = track(uniquePath())
    const writer = new WavWriter(path, sampleRate, 1, 16)
    await writer.open()
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.readUInt32LE(24), sampleRate)
  })

  it('fmt chunk: channelCount — UInt16LE at offset 22 === channelCount param', async () => {
    const channelCount = 1
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, channelCount, 16)
    await writer.open()
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.readUInt16LE(22), channelCount)
  })

  it('fmt chunk: bitsPerSample — UInt16LE at offset 34 === bitDepth param', async () => {
    const bitDepth = 24
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 1, bitDepth)
    await writer.open()
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.readUInt16LE(34), bitDepth)
  })
})

// ─── 16-bit PCM encoding ──────────────────────────────────────────────────────

describe('WavWriter / 16-bit PCM encoding', () => {
  it('Float32Array([1.0, -1.0, 0.5]) → Int16LE ≈ 32767, -32768, 16383 at offsets 44/46/48', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 1, 16)
    await writer.open()
    writer.writeChunk(new Float32Array([1.0, -1.0, 0.5]))
    await writer.finalize()

    const buf = await fs.readFile(path)
    const s0 = buf.readInt16LE(44)
    const s1 = buf.readInt16LE(46)
    const s2 = buf.readInt16LE(48)

    assert.equal(s0, 32767,  `1.0  → expected 32767, got ${s0}`)
    assert.equal(s1, -32768, `-1.0 → expected -32768, got ${s1}`)
    assert.equal(s2, 16383,  `0.5  → expected 16383, got ${s2}`)
  })
})

// ─── Size fields ──────────────────────────────────────────────────────────────

describe('WavWriter / finalize size patching', () => {
  it('finalize patches RIFF size — fileSize - 8 === UInt32LE at offset 4', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 1, 16)
    await writer.open()
    writer.writeChunk(new Float32Array([0.1, 0.2, 0.3, 0.4]))
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.readUInt32LE(4), buf.length - 8)
  })

  it('finalize patches data chunk size — samples * bytesPerSample === UInt32LE at offset 40', async () => {
    // 3 samples × 2 bytes (16-bit mono) = 6 bytes
    const samples = new Float32Array([1.0, -1.0, 0.5])
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 1, 16)
    await writer.open()
    writer.writeChunk(samples)
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.readUInt32LE(40), samples.length * 2)
  })
})

// ─── abort() ─────────────────────────────────────────────────────────────────

describe('WavWriter / abort()', () => {
  it('abort() deletes temp file', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 1, 16)
    await writer.open()
    const tmpPath = path + '.tmp'
    // Confirm file exists before abort
    await fs.stat(tmpPath)
    await writer.abort()
    await assert.rejects(
      () => fs.stat(tmpPath),
      (err: NodeJS.ErrnoException) => err.code === 'ENOENT',
    )
  })
})

// ─── empty WAV ────────────────────────────────────────────────────────────────

describe('WavWriter / empty WAV', () => {
  it('empty WAV (no chunks) still finalizes validly — RIFF header present', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 1, 16)
    await writer.open()
    // No writeChunk calls
    await writer.finalize()
    const buf = await fs.readFile(path)
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF')
    assert.equal(buf.subarray(8, 12).toString('ascii'), 'WAVE')
    assert.equal(buf.readUInt32LE(40), 0, 'data chunk size should be 0')
  })
})

// ─── 24-bit encoding ─────────────────────────────────────────────────────────

describe('WavWriter / 24-bit encoding', () => {
  it('24-bit: Float32Array([1.0]) → bytes at offset 44 = [0xFF, 0xFF, 0x7F]', async () => {
    const path = track(uniquePath())
    const writer = new WavWriter(path, 44100, 1, 24)
    await writer.open()
    writer.writeChunk(new Float32Array([1.0]))
    await writer.finalize()
    const buf = await fs.readFile(path)
    // Max positive 24-bit signed = 8388607 = 0x7FFFFF, stored little-endian
    assert.equal(buf[44], 0xFF, `byte 0 (LSB): expected 0xFF, got 0x${buf[44].toString(16)}`)
    assert.equal(buf[45], 0xFF, `byte 1: expected 0xFF, got 0x${buf[45].toString(16)}`)
    assert.equal(buf[46], 0x7F, `byte 2 (MSB): expected 0x7F, got 0x${buf[46].toString(16)}`)
  })
})
