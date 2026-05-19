export class BpmDetector {
  private audioCtx: AudioContext | null = null

  private getCtx(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext({ sampleRate: 44100 })
    return this.audioCtx
  }

  // Unused but kept for potential future use
  private _ensureCtx(): AudioContext {
    return this.getCtx()
  }

  detect(buffer: AudioBuffer): number | null {
    if (buffer.length === 0) return null
    const mono = this._mixToMono(buffer)
    const hopSize = Math.floor(buffer.sampleRate / 100) // 10ms hops
    const envelope = this._computeEnvelope(mono, hopSize)
    return this._autocorrelate(envelope, buffer.sampleRate, hopSize)
  }

  private _mixToMono(buffer: AudioBuffer): Float32Array {
    const out = new Float32Array(buffer.length)
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < data.length; i++) out[i] += data[i] ?? 0
    }
    const inv = 1 / buffer.numberOfChannels
    for (let i = 0; i < out.length; i++) out[i] *= inv
    return out
  }

  private _computeEnvelope(signal: Float32Array, hopSize: number): Float32Array {
    const numHops = Math.floor(signal.length / hopSize)
    const env = new Float32Array(numHops)
    for (let i = 0; i < numHops; i++) {
      let sum = 0
      const start = i * hopSize
      for (let j = 0; j < hopSize; j++) {
        const v = signal[start + j] ?? 0
        sum += v * v
      }
      env[i] = Math.sqrt(sum / hopSize)
    }
    return env
  }

  private _autocorrelate(envelope: Float32Array, sampleRate: number, hopSize: number): number | null {
    const hopsPerSec = sampleRate / hopSize
    const minLag = Math.floor(hopsPerSec * 60 / 200) // 200 BPM
    const maxLag = Math.floor(hopsPerSec * 60 / 60)  // 60 BPM

    let bestLag = -1
    let bestVal = -Infinity

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0
      for (let i = 0; i + lag < envelope.length; i++) {
        sum += (envelope[i] ?? 0) * (envelope[i + lag] ?? 0)
      }
      if (sum > bestVal) { bestVal = sum; bestLag = lag }
    }

    if (bestLag < 0) return null
    const bpm = (sampleRate / hopSize) * 60 / bestLag
    // Round to nearest 0.5
    return Math.round(bpm * 2) / 2
  }
}

let _instance: BpmDetector | null = null

export function getBpmDetector(): BpmDetector {
  if (!_instance) _instance = new BpmDetector()
  return _instance
}
