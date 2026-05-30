// ─── TransientDetector.test.ts ────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectTransients } from '../../src/renderer/src/audio/editor/TransientDetector.ts'

const SR = 44100

describe('TransientDetector / silence', () => {
  it('returns no transients for silence', () => {
    const buf    = new Float32Array(44100)
    const result = detectTransients(buf, SR)
    assert.equal(result.length, 0)
  })

  it('returns no transients for very short buffer', () => {
    const buf    = new Float32Array(256)
    const result = detectTransients(buf, SR)
    assert.equal(result.length, 0)
  })
})

describe('TransientDetector / impulse detection', () => {
  it('detects a single impulse at a known position', () => {
    const buf     = new Float32Array(44100)
    const impulse = 10000  // sample 10000
    buf[impulse]  = 1.0
    const result  = detectTransients(buf, SR, { windowSize: 512, threshold: 0.5, minGapSamples: 512 })
    assert.ok(result.length >= 1)
    const hit = result.find(pos => Math.abs(pos - impulse) < 1024)
    assert.ok(hit !== undefined, `Expected transient near ${impulse}, got [${result}]`)
  })

  it('detects multiple impulses separated enough', () => {
    const buf = new Float32Array(44100)
    buf[5000]  = 1.0
    buf[20000] = 1.0
    const result = detectTransients(buf, SR, { windowSize: 512, threshold: 0.5, minGapSamples: 2048 })
    assert.ok(result.length >= 2)
  })
})

describe('TransientDetector / minGapSamples', () => {
  it('minGapSamples prevents duplicate detections', () => {
    const buf = new Float32Array(44100)
    // Two very close impulses
    buf[5000] = 1.0
    buf[5100] = 1.0
    const result = detectTransients(buf, SR, { windowSize: 256, threshold: 0.5, minGapSamples: 4096 })
    assert.ok(result.length <= 1)
  })
})
