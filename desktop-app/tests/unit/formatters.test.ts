import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dbToGain, gainToDb, clamp, lerp,
  formatTime, formatBarsBeats, formatFileSize, formatCount, formatCents,
} from '../../src/renderer/src/lib/formatters.ts'

const approx = (a: number, b: number, eps = 1e-6): void => {
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b} (eps=${eps})`)
}

describe('formatters / dB conversion', () => {
  it('dbToGain(0) is unity gain', () => approx(dbToGain(0), 1))
  it('dbToGain(-6) ≈ 0.5012', () => approx(dbToGain(-6), 0.5011872336272722, 1e-9))
  it('dbToGain(+6) ≈ 1.995', () => approx(dbToGain(6), 1.9952623149688795, 1e-9))
  it('gainToDb(1) === 0', () => approx(gainToDb(1), 0))
  it('gainToDb is the inverse of dbToGain over [-60, +12]', () => {
    for (let db = -60; db <= 12; db += 6) approx(gainToDb(dbToGain(db)), db, 1e-9)
  })
  it('gainToDb(0) is floored to a finite very-negative value (no -Infinity)', () => {
    const v = gainToDb(0)
    assert.ok(Number.isFinite(v), `expected finite, got ${v}`)
    assert.ok(v < -100, `expected very negative, got ${v}`)
  })
})

describe('formatters / clamp', () => {
  it('clamps above max', () => assert.equal(clamp(5, 0, 3), 3))
  it('clamps below min', () => assert.equal(clamp(-2, 0, 3), 0))
  it('passes through in-range', () => assert.equal(clamp(1.5, 0, 3), 1.5))
  it('NaN input → NaN (Math.min/max behavior)', () => assert.ok(Number.isNaN(clamp(NaN, 0, 3))))
})

describe('formatters / lerp', () => {
  it('lerp at t=0', () => assert.equal(lerp(2, 10, 0), 2))
  it('lerp at t=1', () => assert.equal(lerp(2, 10, 1), 10))
  it('lerp at t=0.5', () => assert.equal(lerp(2, 10, 0.5), 6))
  it('extrapolates outside [0,1]', () => assert.equal(lerp(0, 10, 2), 20))
})

describe('formatters / formatTime', () => {
  it('0 ms → 00:00.00', () => assert.equal(formatTime(0), '00:00.00'))
  it('1500 ms → 00:01.50', () => assert.equal(formatTime(1500), '00:01.50'))
  it('75500 ms → 01:15.50', () => assert.equal(formatTime(75500), '01:15.50'))
  it('zero-pads minutes & seconds', () => assert.match(formatTime(9000), /^\d{2}:\d{2}\.\d{2}$/))
})

describe('formatters / formatBarsBeats', () => {
  it('pads bar to 3 digits and increments beat for 1-based display', () => {
    assert.equal(formatBarsBeats(3, 1, 480), '003.2.480')
  })
  it('default tick is 0 with pad', () => assert.equal(formatBarsBeats(1, 0), '001.1.000'))
})

describe('formatters / formatFileSize', () => {
  it('B', () => assert.equal(formatFileSize(512), '512 B'))
  it('KB', () => assert.equal(formatFileSize(2048), '2.0 KB'))
  it('MB', () => assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 MB'))
  it('GB uses 2 decimals', () => assert.equal(formatFileSize(2 * 1024 ** 3), '2.00 GB'))
})

describe('formatters / formatCount', () => {
  it('< 1k passes through', () => assert.equal(formatCount(42), '42'))
  it('1.5K', () => assert.equal(formatCount(1500), '1.5K'))
  it('2.5M', () => assert.equal(formatCount(2_500_000), '2.5M'))
})

describe('formatters / formatCents', () => {
  it('formats USD by default', () => {
    const out = formatCents(1234)
    // platform-specific NBSPs/spaces; just assert key parts
    assert.match(out, /\$/)
    assert.match(out, /12\.34/)
  })
})
