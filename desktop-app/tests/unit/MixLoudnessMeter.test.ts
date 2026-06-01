import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LoudnessMeter } from '../../src/renderer/src/audio/meters/LoudnessMeter.ts'

const SR = 44100

function makeSine(freq: number, sr: number, seconds: number, amplitude = 1.0): Float32Array {
  const n   = Math.floor(sr * seconds)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

describe('LoudnessMeter (mix-assistant)', () => {
  const meter = new LoudnessMeter()

  describe('measure() — integrated LUFS', () => {
    it('silence → integrated = -Infinity', () => {
      const buf = new Float32Array(SR * 2)
      const m   = meter.measure(buf, SR)
      assert.ok(!isFinite(m.integrated), `expected -Infinity, got ${m.integrated}`)
    })

    it('loud signal → integrated is finite', () => {
      const buf = makeSine(440, SR, 2.0, 0.8)
      const m   = meter.measure(buf, SR)
      assert.ok(isFinite(m.integrated), `expected finite integrated LUFS, got ${m.integrated}`)
    })
  })

  describe('measure() — truePeak', () => {
    it('full-scale sine → truePeak is finite and ≤ 0 dBFS', () => {
      const buf = makeSine(440, SR, 1.0, 1.0)
      const m   = meter.measure(buf, SR)
      assert.ok(isFinite(m.truePeak), `expected finite truePeak, got ${m.truePeak}`)
      assert.ok(m.truePeak <= 0, `truePeak should be ≤ 0 dBFS, got ${m.truePeak}`)
    })
  })

  describe('measure() — LRA', () => {
    it('uniform signal → range ≈ 0 (minimal dynamic variation)', () => {
      // Full-scale sine has minimal dynamic variation across 3s blocks
      const buf = makeSine(440, SR, 6.0, 0.8)
      const m   = meter.measure(buf, SR)
      // Uniform sine: all 3s blocks should have similar levels → small LRA
      assert.ok(m.range < 3, `expected small LRA for uniform signal, got ${m.range}`)
    })
  })

  describe('measure() — momentary and shortTerm', () => {
    it('returns finite momentary and shortTerm for loud signal', () => {
      const buf = makeSine(440, SR, 3.1, 0.7)
      const m   = meter.measure(buf, SR)
      assert.ok(isFinite(m.momentary),  `momentary should be finite, got ${m.momentary}`)
      assert.ok(isFinite(m.shortTerm),  `shortTerm should be finite, got ${m.shortTerm}`)
    })
  })
})
