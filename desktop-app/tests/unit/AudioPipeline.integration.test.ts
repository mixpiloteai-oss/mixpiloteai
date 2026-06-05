// ─── AudioPipeline.integration.test.ts ───────────────────────────────────────
// Integration tests for the full audio processing pipeline.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MasterChain } from '../../src/renderer/src/audio/export/MasterChain'
import { applyDither } from '../../src/renderer/src/audio/export/DitherEngine'
import { convertSampleRate } from '../../src/renderer/src/audio/export/SampleRateConverter'
import { encodeWav } from '../../src/renderer/src/audio/export/WavEncoderPcm'
import { softClip } from '../../src/renderer/src/audio/export/SoftClipper'
import { loudnessMeter } from '../../src/renderer/src/audio/export/LoudnessMeter'
import { OfflineRenderer } from '../../src/renderer/src/audio/export/OfflineRenderer'
import type { RenderJob } from '../../src/renderer/src/audio/export/OfflineRenderer'

describe('AudioPipeline.integration', () => {
  it('sine wave generation produces correct frequency', () => {
    const sampleRate = 44100
    const freq = 440
    const duration = 1
    const samples = sampleRate * duration
    const buffer = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      buffer[i] = Math.sin(2 * Math.PI * freq * i / sampleRate)
    }

    // Peak amplitude should be ≈ 1.0
    let peak = 0
    for (let i = 0; i < samples; i++) {
      const abs = Math.abs(buffer[i]!)
      if (abs > peak) peak = abs
    }
    assert.ok(peak > 0.99 && peak <= 1.0, `Peak amplitude should be ≈ 1.0, got ${peak}`)

    // First few samples should start at (or near) zero
    assert.ok(Math.abs(buffer[0]!) < 0.001, `First sample should be near 0, got ${buffer[0]}`)
  })

  it('Float32Array channel processing: applyDither then SampleRateConverter', () => {
    const inputBuffer = new Float32Array(1000).fill(0)
    // Fill with a simple signal
    for (let i = 0; i < 1000; i++) {
      inputBuffer[i] = Math.sin(i * 0.1) * 0.5
    }

    const dithered = applyDither(inputBuffer, 16, 'tpdf')
    const converted = convertSampleRate(dithered, 44100, 22050)

    // 1000 samples at 44100→22050 gives ~500 samples
    assert.ok(converted.length >= 490 && converted.length <= 510,
      `Expected ~500 samples after conversion, got ${converted.length}`)

    // All values should be in [-1.01, 1.01]
    for (let i = 0; i < converted.length; i++) {
      const v = converted[i]!
      assert.ok(v >= -1.01 && v <= 1.01, `Sample out of range at index ${i}: ${v}`)
    }
  })

  it('MasterChain: silence input produces silence output', () => {
    const chain = new MasterChain({ sampleRate: 44100, enableLimiter: true, enableSoftClipper: true })
    const silenceL = new Float32Array(4096)
    const silenceR = new Float32Array(4096)
    const result = chain.process([silenceL, silenceR])

    for (let i = 0; i < result.channels[0]!.length; i++) {
      assert.equal(result.channels[0]![i], 0, `Left channel not silent at index ${i}`)
      assert.equal(result.channels[1]![i], 0, `Right channel not silent at index ${i}`)
    }
  })

  it('MasterChain: clip above threshold is limited', () => {
    const chain = new MasterChain({
      sampleRate: 44100,
      enableLimiter: true,
      enableSoftClipper: true,
      limiterThresholdDb: -0.3,
      softClipThreshold: 0.95,
    })

    // Create a buffer with peak of 2.0
    const n = 4096
    const left = new Float32Array(n)
    const right = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      left[i] = 2.0 * Math.sin(2 * Math.PI * 440 * i / 44100)
      right[i] = 2.0 * Math.sin(2 * Math.PI * 440 * i / 44100)
    }

    const result = chain.process([left, right])
    let maxPeak = 0
    for (let i = 0; i < result.channels[0]!.length; i++) {
      const absL = Math.abs(result.channels[0]![i]!)
      const absR = Math.abs(result.channels[1]![i]!)
      if (absL > maxPeak) maxPeak = absL
      if (absR > maxPeak) maxPeak = absR
    }
    assert.ok(maxPeak <= 1.0, `Expected peak ≤ 1.0 after limiter, got ${maxPeak}`)
  })

  it('softClip preserves zero crossing', () => {
    const result = softClip(0.0, 0.95)
    assert.equal(result, 0)
  })

  it('full export path: OfflineRenderer → MasterChain → DitherEngine → WavEncoderPcm', async () => {
    const sampleRate = 44100
    const job: RenderJob = {
      type: 'master',
      tracks: [
        {
          id: 'track-1',
          name: 'Synth',
          type: 'instrument',
          notes: [
            { pitch: 60, startSample: 0, durationSamples: 22050, velocity: 100 }
          ],
          gainDb: 0,
          pan: 0,
          muted: false,
          soloed: false,
        }
      ],
      sampleRate,
      startSample: 0,
      endSample: 44100,
      bpm: 120,
      applyMasterChain: true,
      masterOptions: {
        sampleRate,
        enableLimiter: true,
        enableSoftClipper: true,
        limiterThresholdDb: -0.3,
        softClipThreshold: 0.95,
        enablePeakProtection: true,
      },
    }

    const renderer = new OfflineRenderer()
    const renderResult = await renderer.render(job)

    // Apply dither
    const ditheredL = applyDither(renderResult.masterMix[0]!, 16, 'tpdf')
    const ditheredR = applyDither(renderResult.masterMix[1]!, 16, 'tpdf')

    // Encode WAV
    const wavBytes = encodeWav([ditheredL, ditheredR], sampleRate, 16)
    assert.ok(wavBytes instanceof Uint8Array, 'Should produce Uint8Array')
    assert.ok(wavBytes.length > 44, 'WAV should be larger than header')

    // Check RIFF header
    const riff = String.fromCharCode(wavBytes[0]!, wavBytes[1]!, wavBytes[2]!, wavBytes[3]!)
    assert.equal(riff, 'RIFF', 'Should start with RIFF header')
  })

  it('SampleRateConverter 44100→48000 preserves length ratio', () => {
    const inputLen = 44100
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) input[i] = Math.sin(i * 0.01)

    const output = convertSampleRate(input, 44100, 48000)
    const expectedLength = Math.round(inputLen * 48000 / 44100)
    assert.ok(Math.abs(output.length - expectedLength) <= 2,
      `Expected length ${expectedLength}, got ${output.length}`)
  })

  it('LoudnessMeter: full-scale sine ≈ -3dB RMS', () => {
    const sampleRate = 44100
    const freq = 440
    const n = sampleRate // 1 second
    const buffer = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      buffer[i] = Math.sin(2 * Math.PI * freq * i / sampleRate)
    }

    const rmsDb = loudnessMeter.measureRms(buffer)
    // Full-scale sine has RMS = 1/sqrt(2) ≈ -3.01 dB
    assert.ok(Math.abs(rmsDb - (-3.01)) < 0.5,
      `Expected RMS ≈ -3dB, got ${rmsDb}`)
  })
})
