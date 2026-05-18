import type { AudioEngineConfig, ChannelLevel } from './types'

// ─── Utility ───────────────────────────────────────────────────────────────

export function dbToGain(db: number): number {
  if (db <= -100) return 0
  return Math.pow(10, db / 20)
}

export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity
  return 20 * Math.log10(gain)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ─── AudioEngine ──────────────────────────────────────────────────────────
//
// Manages the Web Audio API context and the master signal chain:
//
//   [track inputs] → masterGain → masterCompressor → masterAnalyser → destination
//
// Singleton — call AudioEngine.getInstance() everywhere.

const DEFAULT_CONFIG: Required<AudioEngineConfig> = {
  sampleRate:    44100,
  latencyHint:   'interactive',
  masterGainDb:  0,
}

export class AudioEngine {
  private static _instance: AudioEngine | null = null

  readonly ctx:              AudioContext
  readonly masterGain:       GainNode
  readonly masterCompressor: DynamicsCompressorNode
  readonly masterAnalyser:   AnalyserNode

  /** Connect track channel strips here. */
  readonly masterInput: AudioNode

  private _masterGainDb = 0
  private _analyserBuffer: Float32Array<ArrayBuffer>
  private _peakHold    = 0
  private _peakTimer   = 0

  private constructor(cfg: Required<AudioEngineConfig>) {
    this.ctx = new AudioContext({
      sampleRate:  cfg.sampleRate,
      latencyHint: cfg.latencyHint,
    })

    // Master bus nodes
    this.masterGain       = this.ctx.createGain()
    this.masterCompressor = this.ctx.createDynamicsCompressor()
    this.masterAnalyser   = this.ctx.createAnalyser()

    // Compressor: light limiter at master bus
    this.masterCompressor.threshold.value = -3
    this.masterCompressor.knee.value      = 6
    this.masterCompressor.ratio.value     = 10
    this.masterCompressor.attack.value    = 0.003
    this.masterCompressor.release.value   = 0.25

    this.masterAnalyser.fftSize               = 2048
    this.masterAnalyser.smoothingTimeConstant = 0.0  // raw, hooks smooth separately

    // Chain
    this.masterGain.connect(this.masterCompressor)
    this.masterCompressor.connect(this.masterAnalyser)
    this.masterAnalyser.connect(this.ctx.destination)

    this.masterInput = this.masterGain

    this.setMasterGain(cfg.masterGainDb)

    this._analyserBuffer = new Float32Array(this.masterAnalyser.fftSize) as Float32Array<ArrayBuffer>

    // Suspend when tab is hidden (saves CPU)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.ctx.suspend()
      else                 this.ctx.resume()
    })
  }

  static getInstance(cfg?: AudioEngineConfig): AudioEngine {
    if (!AudioEngine._instance) {
      AudioEngine._instance = new AudioEngine({ ...DEFAULT_CONFIG, ...cfg })
    }
    return AudioEngine._instance
  }

  /** Must be called on a user gesture (click, keydown) to unlock AudioContext. */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  get currentTime(): number    { return this.ctx.currentTime }
  get sampleRate(): number      { return this.ctx.sampleRate }
  get state(): AudioContextState { return this.ctx.state }
  get masterGainDb(): number   { return this._masterGainDb }

  setMasterGain(db: number): void {
    this._masterGainDb = db
    this.masterGain.gain.setTargetAtTime(
      dbToGain(db),
      this.ctx.currentTime,
      0.005,
    )
  }

  /** Returns instantaneous metering levels. Call from rAF — not render. */
  getMasterLevel(): ChannelLevel {
    this.masterAnalyser.getFloatTimeDomainData(this._analyserBuffer)

    let sumSq = 0
    let peak  = 0
    for (let i = 0; i < this._analyserBuffer.length; i++) {
      const v = Math.abs(this._analyserBuffer[i])
      sumSq += v * v
      if (v > peak) peak = v
    }
    const rms = Math.sqrt(sumSq / this._analyserBuffer.length)

    // Simple peak hold: hold 1.5 s, then decay
    const now = performance.now()
    if (peak >= this._peakHold) {
      this._peakHold  = peak
      this._peakTimer = now
    } else if (now - this._peakTimer > 1500) {
      this._peakHold = Math.max(this._peakHold - 0.01, peak)
    }

    return {
      rms,
      peak:  this._peakHold,
      dbfs:  gainToDb(rms),
    }
  }



  dispose(): void {
    this.ctx.close()
    AudioEngine._instance = null
  }
}
