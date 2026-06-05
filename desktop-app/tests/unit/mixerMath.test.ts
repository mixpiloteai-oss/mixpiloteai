// ─── mixerMath.test.ts ───────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dBToLinear, linearToDb, panToStereo } from '../../src/renderer/src/audio/mixerMath.ts'

const EPS = 1e-6

describe('mixerMath / dBToLinear', () => {
  it('0 dB → 1.0', () => {
    assert.ok(Math.abs(dBToLinear(0) - 1.0) < EPS)
  })

  it('-20 dB → 0.1', () => {
    assert.ok(Math.abs(dBToLinear(-20) - 0.1) < EPS)
  })

  it('-Infinity → 0 (exact)', () => {
    assert.equal(dBToLinear(-Infinity), 0)
  })

  it('+6 dB ≈ 2.0', () => {
    assert.ok(Math.abs(dBToLinear(6) - 1.99526) < 0.001)
  })

  it('NaN → 0', () => {
    assert.equal(dBToLinear(NaN), 0)
  })
})

describe('mixerMath / linearToDb', () => {
  it('1.0 → 0 dB', () => {
    assert.ok(Math.abs(linearToDb(1.0)) < EPS)
  })

  it('0.1 → -20 dB', () => {
    assert.ok(Math.abs(linearToDb(0.1) - (-20)) < EPS)
  })

  it('0 → -Infinity', () => {
    const result = linearToDb(0)
    assert.equal(result, -Infinity)
  })

  it('negative → -Infinity', () => {
    assert.equal(linearToDb(-1), -Infinity)
  })

  it('round-trip: dBToLinear(linearToDb(x)) ≈ x', () => {
    const x = 0.3
    assert.ok(Math.abs(dBToLinear(linearToDb(x)) - x) < EPS)
  })
})

describe('mixerMath / panToStereo', () => {
  it('pan=0 → L ≈ R ≈ √2/2 (equal power center)', () => {
    const { left, right } = panToStereo(0)
    assert.ok(Math.abs(left  - Math.SQRT2 / 2) < EPS)
    assert.ok(Math.abs(right - Math.SQRT2 / 2) < EPS)
  })

  it('pan=-1 → hard left: L=1, R=0', () => {
    const { left, right } = panToStereo(-1)
    assert.ok(Math.abs(left  - 1) < EPS)
    assert.ok(Math.abs(right - 0) < EPS)
  })

  it('pan=+1 → hard right: L=0, R=1', () => {
    const { left, right } = panToStereo(1)
    assert.ok(Math.abs(left  - 0) < EPS)
    assert.ok(Math.abs(right - 1) < EPS)
  })

  it('constant-power invariant: L² + R² ≈ 1.0', () => {
    for (const pan of [-1, -0.5, 0, 0.5, 1]) {
      const { left, right } = panToStereo(pan)
      assert.ok(Math.abs(left * left + right * right - 1.0) < EPS, `Failed at pan=${pan}`)
    }
  })
})
