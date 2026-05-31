export type LatencyMode = 'low-latency' | 'balanced' | 'power-saving'

export interface LatencyConfig {
  mode:              LatencyMode
  latencyHint:       AudioContextLatencyCategory
  schedulerAheadSec: number
  bufferSize:        number
}

export const LATENCY_CONFIGS: Record<LatencyMode, LatencyConfig> = {
  'low-latency': {
    mode: 'low-latency', latencyHint: 'interactive',
    schedulerAheadSec: 0.05, bufferSize: 256,
  },
  'balanced': {
    mode: 'balanced', latencyHint: 'balanced',
    schedulerAheadSec: 0.1, bufferSize: 512,
  },
  'power-saving': {
    mode: 'power-saving', latencyHint: 'playback',
    schedulerAheadSec: 0.2, bufferSize: 1024,
  },
}

export class AudioLatencyManager {
  private _mode: LatencyMode = 'balanced'

  measureLatency(ctx: AudioContext): { totalMs: number; baseMs: number; outputMs: number } {
    const baseMs   = (ctx.baseLatency ?? 0) * 1000
    const outputMs = (ctx.outputLatency ?? 0) * 1000
    // When outputLatency is unsupported (= 0), estimate it as baseLatency
    const effectiveOutput = outputMs > 0 ? outputMs : baseMs
    return { totalMs: baseMs + effectiveOutput, baseMs, outputMs: effectiveOutput }
  }

  getRecommendedMode(ctx: AudioContext): LatencyMode {
    const { totalMs } = this.measureLatency(ctx)
    if (totalMs < 10) return 'low-latency'
    if (totalMs < 30) return 'balanced'
    return 'power-saving'
  }

  applyMode(mode: LatencyMode): void {
    this._mode = mode
  }

  getConfig(): LatencyConfig {
    return LATENCY_CONFIGS[this._mode]
  }

  get currentMode(): LatencyMode { return this._mode }
}

export const audioLatencyManager = new AudioLatencyManager()
