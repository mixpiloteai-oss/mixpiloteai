// ─── WaveformGenerator.test.ts ────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { WaveformGenerator } from '../../src/renderer/src/audio/recording/WaveformGenerator.ts'

const gen = new WaveformGenerator()

describe('WaveformGenerator / silence', () => {
  it('silence (all zeros) produces min=0, max=0, rms=0', () => {
    const silence = new Float32Array(1000)
    const peaks = gen.generateLive([silence], 100)
    for (let i = 0; i < peaks.min.length; i++) {
      assert.equal(peaks.min[i], 0, `min[${i}] should be 0`)
      assert.equal(peaks.max[i], 0, `max[${i}] should be 0`)
      assert.equal(peaks.rms[i], 0, `rms[${i}] should be 0`)
    }
  })
})

describe('WaveformGenerator / all-ones signal', () => {
  it('all-ones: max=1, min=1, rms=1', () => {
    const ones = new Float32Array(100).fill(1.0)
    const peaks = gen.generateLive([ones], 100)
    assert.equal(peaks.max[0], 1.0)
    assert.equal(peaks.min[0], 1.0)
    assert.ok(Math.abs(peaks.rms[0] - 1.0) < 1e-5)
  })
})

describe('WaveformGenerator / sine wave peaks', () => {
  it('single-channel sine at known amplitude: peaks ≈ amplitude', () => {
    const amplitude = 0.8
    const samples = 4096
    const sine = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      sine[i] = amplitude * Math.sin((2 * Math.PI * i) / 100)
    }
    const peaks = gen.generateLive([sine], samples)
    // Single block covering all samples
    assert.ok(
      Math.abs(peaks.max[0] - amplitude) < 0.01,
      `max peak should be ~${amplitude}, got ${peaks.max[0]}`
    )
    assert.ok(
      Math.abs(peaks.min[0] - (-amplitude)) < 0.01,
      `min peak should be ~${-amplitude}, got ${peaks.min[0]}`
    )
  })
})

describe('WaveformGenerator / samplesPerPixel controls output length', () => {
  it('1000 samples / 100 spp → 10 pixels', () => {
    const buf = new Float32Array(1000).fill(0.5)
    const peaks = gen.generateLive([buf], 100)
    assert.equal(peaks.min.length, 10)
    assert.equal(peaks.max.length, 10)
    assert.equal(peaks.rms.length, 10)
    assert.equal(peaks.totalSamples, 1000)
    assert.equal(peaks.samplesPerPixel, 100)
  })
})

describe('WaveformGenerator / partial final block', () => {
  it('1050 samples / 100 spp → 11 pixels (last block = 50 samples)', () => {
    const buf = new Float32Array(1050).fill(0.5)
    const peaks = gen.generateLive([buf], 100)
    assert.equal(peaks.min.length, 11)
    assert.equal(peaks.max.length, 11)
    assert.equal(peaks.rms.length, 11)
    assert.equal(peaks.totalSamples, 1050)
  })
})

describe('WaveformGenerator / stereo channels averaged', () => {
  it('stereo channels are averaged for display', () => {
    // ch0 = all 1.0, ch1 = all -1.0 → average = 0.0
    const ch0 = new Float32Array(100).fill(1.0)
    const ch1 = new Float32Array(100).fill(-1.0)
    const peaks = gen.generateLive([ch0, ch1], 100)
    assert.equal(peaks.max[0], 0.0)
    assert.equal(peaks.min[0], 0.0)
    assert.ok(Math.abs(peaks.rms[0]) < 1e-5)
  })
})

describe('WaveformGenerator / computeFromMono matches generateLive', () => {
  it('computeFromMono matches generateLive on single-channel input', () => {
    const data = new Float32Array(500)
    for (let i = 0; i < 500; i++) data[i] = Math.sin(i * 0.1) * 0.7
    const spp = 50

    const fromLive = gen.generateLive([data], spp)
    const fromMono = gen.computeFromMono(data, spp)

    assert.equal(fromMono.min.length, fromLive.min.length)
    assert.equal(fromMono.totalSamples, fromLive.totalSamples)
    for (let i = 0; i < fromLive.min.length; i++) {
      assert.ok(
        Math.abs(fromMono.min[i] - fromLive.min[i]) < 1e-5,
        `min[${i}]: fromMono=${fromMono.min[i]}, fromLive=${fromLive.min[i]}`
      )
      assert.ok(
        Math.abs(fromMono.max[i] - fromLive.max[i]) < 1e-5,
        `max[${i}]: fromMono=${fromMono.max[i]}, fromLive=${fromLive.max[i]}`
      )
      assert.ok(
        Math.abs(fromMono.rms[i] - fromLive.rms[i]) < 1e-5,
        `rms[${i}]: fromMono=${fromMono.rms[i]}, fromLive=${fromLive.rms[i]}`
      )
    }
  })
})
