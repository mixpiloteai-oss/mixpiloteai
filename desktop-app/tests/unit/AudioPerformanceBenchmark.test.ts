import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runAudioBenchmark } from '../../src/renderer/src/audio/AudioPerformanceBenchmark.ts'

const mockCtx = { baseLatency: 0.005, outputLatency: 0.015, sampleRate: 48000 }

test('benchmark returns all required fields', async () => {
  const result = await runAudioBenchmark(mockCtx)
  assert.ok(typeof result.sampleRate === 'number')
  assert.ok(typeof result.schedulerOverheadMs === 'number')
  assert.ok(typeof result.peakMeterFpsCapacity === 'number')
  assert.ok(typeof result.waveformPeaksMpps === 'number')
  assert.ok(['low-latency', 'standard', 'power-saving'].includes(result.recommendation))
})
test('scheduler overhead < 1ms per iteration', async () => {
  const result = await runAudioBenchmark(mockCtx)
  assert.ok(result.schedulerOverheadMs < 1, `scheduler too slow: ${result.schedulerOverheadMs}ms`)
})
test('waveform peaks > 10 Msamples/sec', async () => {
  const result = await runAudioBenchmark(mockCtx)
  assert.ok(result.waveformPeaksMpps > 10, `too slow: ${result.waveformPeaksMpps} Msamples/s`)
})
test('roundtrip = base + output', async () => {
  const result = await runAudioBenchmark(mockCtx)
  assert.ok(Math.abs(result.roundtripLatencyMs - (result.baseLatencyMs + result.outputLatencyMs)) < 0.001)
})
test('recommendation for 20ms roundtrip is standard', async () => {
  const result = await runAudioBenchmark({ sampleRate: 44100, baseLatency: 0.01, outputLatency: 0.01 })
  assert.strictEqual(result.recommendation, 'standard')
})
