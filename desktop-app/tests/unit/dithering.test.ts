import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Ditherer } from '../../src/renderer/src/audio/export/Dithering.ts'

describe('Ditherer / passthrough', () => {
  it('type=none returns the input unchanged', () => {
    const d = new Ditherer()
    for (const v of [-1, -0.5, 0, 0.25, 1]) {
      assert.equal(d.apply(v, 'none', 32768), v)
    }
  })
})

describe('Ditherer / TPDF', () => {
  it('keeps perturbations small relative to the input', () => {
    const d = new Ditherer()
    const scale = 32768
    // TPDF noise has range (-1, 1) divided by scaleFactor → very small at 16-bit.
    for (let i = 0; i < 1000; i++) {
      const out = d.apply(0.5, 'tpdf', scale)
      assert.ok(Math.abs(out - 0.5) < 2 / scale,
        `TPDF deviation too large: ${out - 0.5}`)
    }
  })
  it('mean of perturbations approaches 0 over many calls (unbiased)', () => {
    const d = new Ditherer()
    let sum = 0
    const n = 5000
    for (let i = 0; i < n; i++) sum += d.apply(0, 'tpdf', 1)
    const mean = sum / n
    assert.ok(Math.abs(mean) < 0.05, `mean too far from 0: ${mean}`)
  })
})

describe('Ditherer / flat (RPDF)', () => {
  it('stays within ±1/scaleFactor', () => {
    const d = new Ditherer()
    const scale = 1024
    for (let i = 0; i < 1000; i++) {
      const out = d.apply(0, 'flat', scale)
      assert.ok(Math.abs(out) <= 1 / scale + 1e-9,
        `flat dither out of bound: ${out}`)
    }
  })
})

describe('Ditherer / noise-shaping', () => {
  it('does not blow up over many iterations (stable filter)', () => {
    const d = new Ditherer()
    const scale = 32768
    let maxAbs = 0
    for (let i = 0; i < 10000; i++) {
      const out = d.apply(0, 'ns', scale)
      const a = Math.abs(out)
      if (a > maxAbs) maxAbs = a
    }
    // Noise-shaped output amplitude is bounded; should stay << 1 at 16-bit
    assert.ok(maxAbs < 0.05, `NS dither blew up: max=${maxAbs}`)
  })
  it('reset() clears history (next call uses fresh state)', () => {
    const d = new Ditherer()
    for (let i = 0; i < 100; i++) d.apply(0, 'ns', 32768)
    d.reset()
    const out = d.apply(0, 'ns', 32768)
    assert.ok(Number.isFinite(out))
  })
})
