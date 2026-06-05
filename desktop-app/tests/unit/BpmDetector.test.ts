// ─── BpmDetector.test.ts ─────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectBpm } from '../../src/renderer/src/audio/editor/BpmDetector.ts'

const SR = 44100

function makeBeatTrack(bpm: number, numBeats: number, sr: number): Float32Array {
  const beatSamples = Math.round(sr * 60 / bpm)
  const totalLen    = beatSamples * numBeats + 1024
  const buf         = new Float32Array(totalLen)
  for (let b = 0; b < numBeats; b++) {
    const pos  = b * beatSamples
    const half = Math.min(64, beatSamples / 4)
    for (let i = 0; i < half; i++) {
      const v  = Math.sin(i / half * Math.PI)
      if (pos + i < buf.length) buf[pos + i] += v
    }
  }
  return buf
}

describe('BpmDetector / click track', () => {
  it('detects 120 BPM within ±2 tolerance', () => {
    const buf    = makeBeatTrack(120, 16, SR)
    const result = detectBpm(buf, SR)
    assert.ok(Math.abs(result.bpm - 120) <= 2, `Expected ~120 BPM, got ${result.bpm}`)
    assert.ok(result.confidence > 0.3, `Expected confidence > 0.3, got ${result.confidence}`)
  })

  it('detects 90 BPM within ±2 tolerance', () => {
    const buf    = makeBeatTrack(90, 12, SR)
    const result = detectBpm(buf, SR)
    assert.ok(Math.abs(result.bpm - 90) <= 2, `Expected ~90 BPM, got ${result.bpm}`)
  })

  it('returns beat positions array', () => {
    const buf    = makeBeatTrack(120, 8, SR)
    const result = detectBpm(buf, SR)
    assert.ok(result.beatPositions.length > 0)
  })
})

describe('BpmDetector / short buffer', () => {
  it('very short buffer returns confidence = 0', () => {
    const buf    = new Float32Array(512 * 4)
    const result = detectBpm(buf, SR)
    assert.equal(result.confidence, 0)
    assert.equal(result.bpm, 0)
  })
})

describe('BpmDetector / silence', () => {
  it('silence returns 0 confidence', () => {
    const buf    = new Float32Array(SR * 4)
    const result = detectBpm(buf, SR)
    assert.equal(result.confidence, 0)
  })
})
