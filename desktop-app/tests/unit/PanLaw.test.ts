import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePanGains } from '../../src/renderer/src/audio/PanLaw.ts'

test('sine law center is -3dB (0.707)', () => {
  const { gainL, gainR } = computePanGains(0, 'sine')
  assert.ok(Math.abs(gainL - Math.SQRT1_2) < 0.001)
  assert.ok(Math.abs(gainR - Math.SQRT1_2) < 0.001)
})
test('sine law full right', () => {
  const { gainL, gainR } = computePanGains(1, 'sine')
  assert.ok(gainL < 0.001)
  assert.ok(Math.abs(gainR - 1) < 0.001)
})
test('sine law full left', () => {
  const { gainL, gainR } = computePanGains(-1, 'sine')
  assert.ok(Math.abs(gainL - 1) < 0.001)
  assert.ok(gainR < 0.001)
})
test('linear law center is -6dB (0.5)', () => {
  const { gainL, gainR } = computePanGains(0, 'linear')
  assert.strictEqual(gainL, 0.5)
  assert.strictEqual(gainR, 0.5)
})
test('linear law full right', () => {
  const { gainL, gainR } = computePanGains(1, 'linear')
  assert.strictEqual(gainL, 0)
  assert.strictEqual(gainR, 1)
})
