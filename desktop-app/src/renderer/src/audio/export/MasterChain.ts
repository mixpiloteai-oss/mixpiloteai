// ─── MasterChain ──────────────────────────────────────────────────────────────
// Orchestrates the mastering signal chain: soft clipper → limiter → peak protection
// Applied to Float32Array[] (one array per channel) before encoding.

import { processBuffer } from './SoftClipper'
import { LimiterProcessor } from './LimiterProcessor'
import { loudnessMeter, type LoudnessMeasurement } from './LoudnessMeter'
import { peakProtector, type PeakAnalysis } from './PeakProtector'

export interface MasterChainOptions {
  sampleRate:           number   // Hz, default 44100
  enableLimiter:        boolean  // default true
  enableSoftClipper:    boolean  // default true
  limiterThresholdDb:   number   // default -0.3
  softClipThreshold:    number   // normalized 0-1, default 0.95
  enablePeakProtection: boolean  // default true
}

export interface MasterChainResult {
  channels:             Float32Array[]
  loudness:             LoudnessMeasurement
  peakAnalysis:         PeakAnalysis
  gainReductionApplied: number  // linear gain actually applied by peak protection (1.0 = none)
}

const DEFAULT_OPTIONS: MasterChainOptions = {
  sampleRate:           44100,
  enableLimiter:        true,
  enableSoftClipper:    true,
  limiterThresholdDb:   -0.3,
  softClipThreshold:    0.95,
  enablePeakProtection: true,
}

export class MasterChain {
  private readonly options:  MasterChainOptions
  private readonly limiter:  LimiterProcessor

  constructor(options: Partial<MasterChainOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.limiter = new LimiterProcessor({
      thresholdDb: this.options.limiterThresholdDb,
      sampleRate:  this.options.sampleRate,
    })
  }

  /**
   * Run multi-channel audio through the mastering chain:
   *   1. Soft clipper (if enabled)
   *   2. Brickwall limiter (if enabled)
   *   3. True-peak protection (if enabled)
   *   4. Loudness measurement
   *
   * Returns new arrays (safe for re-use of originals).
   */
  process(channels: Float32Array[]): MasterChainResult {
    // Work on copies so originals are not mutated
    let processed: Float32Array[] = channels.map(ch => new Float32Array(ch))

    // Step 1: Soft clipper
    if (this.options.enableSoftClipper) {
      processed = processBuffer(processed, this.options.softClipThreshold)
    }

    // Step 2: Brickwall limiter (in-place, returns same arrays)
    if (this.options.enableLimiter) {
      processed = this.limiter.process(processed)
    }

    // Step 3: True-peak protection
    let gainReductionApplied = 1.0
    const peakAnalysis = peakProtector.analyze(processed)
    if (this.options.enablePeakProtection && peakAnalysis.hasTruePeakViolation) {
      gainReductionApplied = peakAnalysis.suggestedGainReduction
      processed = peakProtector.applyGainReduction(processed, gainReductionApplied)
    }

    // Step 4: Measure final loudness
    const loudness = loudnessMeter.measureIntegratedLoudness(processed, this.options.sampleRate)

    return { channels: processed, loudness, peakAnalysis, gainReductionApplied }
  }

  /**
   * Reset the limiter envelope (useful between exports).
   */
  reset(): void {
    this.limiter.reset()
  }
}

/** Singleton instance with default 44100 Hz settings. */
export const masterChain = new MasterChain({
  sampleRate:           44100,
  enableLimiter:        true,
  enableSoftClipper:    true,
  limiterThresholdDb:   -0.3,
  softClipThreshold:    0.95,
  enablePeakProtection: true,
})
