import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AudioLatencyManager, LATENCY_CONFIGS } from '../../src/renderer/src/audio/perf/AudioLatencyManager.ts'

function mockCtx(baseLatency: number, outputLatency: number) {
  return { baseLatency, outputLatency } as unknown as AudioContext
}

test('measureLatency: baseLatency=0.005, outputLatency=0.01 → totalMs=15', () => {
  const mgr  = new AudioLatencyManager()
  const { totalMs, baseMs, outputMs } = mgr.measureLatency(mockCtx(0.005, 0.01))
  assert.ok(Math.abs(totalMs  - 15) < 0.01)
  assert.ok(Math.abs(baseMs   -  5) < 0.01)
  assert.ok(Math.abs(outputMs - 10) < 0.01)
})

test('getRecommendedMode: totalMs < 10 → low-latency', () => {
  const mgr = new AudioLatencyManager()
  // base=0.003, output=0.003 → total=6ms
  assert.strictEqual(mgr.getRecommendedMode(mockCtx(0.003, 0.003)), 'low-latency')
})

test('getRecommendedMode: totalMs=20 → balanced', () => {
  const mgr = new AudioLatencyManager()
  // base=0.01, output=0.01 → total=20ms
  assert.strictEqual(mgr.getRecommendedMode(mockCtx(0.01, 0.01)), 'balanced')
})

test('low-latency schedulerAheadSec < balanced schedulerAheadSec', () => {
  assert.ok(
    LATENCY_CONFIGS['low-latency'].schedulerAheadSec <
    LATENCY_CONFIGS['balanced'].schedulerAheadSec
  )
})
