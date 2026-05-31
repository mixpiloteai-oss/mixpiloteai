export interface FrequencyBin {
  freq: number    // center frequency Hz
  db: number      // level in dBFS (-Infinity to 0)
}

export class SpectrumAnalyzer {
  private readonly analyser: AnalyserNode
  private readonly _freqData: Float32Array<ArrayBuffer>
  private readonly _logBinFreqs: Float32Array<ArrayBuffer>
  readonly NUM_BINS = 64
  readonly FREQ_MIN = 20
  readonly FREQ_MAX = 20000

  constructor(ctx: AudioContext, fftSize = 2048) {
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = fftSize
    this.analyser.smoothingTimeConstant = 0.8
    this._freqData = new Float32Array(this.analyser.frequencyBinCount) as Float32Array<ArrayBuffer>

    // Pre-compute log-spaced bin center frequencies
    const logBins = new Float32Array(this.NUM_BINS) as Float32Array<ArrayBuffer>
    const logRange = Math.log10(this.FREQ_MAX / this.FREQ_MIN)
    for (let j = 0; j < this.NUM_BINS; j++) {
      logBins[j] = this.FREQ_MIN * Math.pow(10, (j / (this.NUM_BINS - 1)) * logRange)
    }
    this._logBinFreqs = logBins
  }

  get input(): AudioNode { return this.analyser }

  /** Get snapshot of current spectrum as Float32Array of dBFS values (NUM_BINS bins) */
  getFrequencyData(): Float32Array<ArrayBuffer> {
    this.analyser.getFloatFrequencyData(this._freqData)
    const sampleRate = this.analyser.context.sampleRate
    const binCount = this._freqData.length  // fftSize/2
    const out = new Float32Array(this.NUM_BINS) as Float32Array<ArrayBuffer>

    for (let j = 0; j < this.NUM_BINS; j++) {
      const centerFreq = this._logBinFreqs[j]!
      // Find corresponding raw FFT bin
      const rawIdx = Math.round((centerFreq / (sampleRate / 2)) * binCount)
      const lo = Math.max(0, rawIdx - 1)
      const hi = Math.min(binCount - 1, rawIdx + 1)
      let sum = 0
      for (let k = lo; k <= hi; k++) sum += this._freqData[k]!
      out[j] = sum / (hi - lo + 1)  // average of nearby bins (already in dBFS)
    }
    return out
  }

  /** Get full raw FFT data (frequencyBinCount bins, dBFS) */
  getRawFrequencyData(): Float32Array<ArrayBuffer> {
    this.analyser.getFloatFrequencyData(this._freqData)
    return this._freqData.slice() as Float32Array<ArrayBuffer>
  }

  dispose(): void { this.analyser.disconnect() }
}
