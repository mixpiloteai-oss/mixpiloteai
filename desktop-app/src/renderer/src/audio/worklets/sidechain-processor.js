/**
 * SidechainProcessor — AudioWorklet replacement for ScriptProcessorNode sidechain.
 *
 * Computes RMS of the sidechain source in the audio thread and posts the result
 * back to the main thread at a configurable rate. This replaces the deprecated
 * ScriptProcessorNode approach in MixerEngine.connectSidechain().
 *
 * Message in:  { type: 'set-threshold', threshold: number }
 * Message out: { type: 'rms', rms: number }
 */
class SidechainProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._bufCount    = 0
    this._reportEvery = 4    // post RMS every 4 render quanta (~5.8ms at 44.1kHz × 128 samples)
    this._sumSq       = 0
    this._sampleCount = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const channel = input[0]
    for (let i = 0; i < channel.length; i++) {
      this._sumSq += channel[i] * channel[i]
    }
    this._sampleCount += channel.length
    this._bufCount++

    if (this._bufCount >= this._reportEvery) {
      const rms = Math.sqrt(this._sumSq / this._sampleCount)
      this.port.postMessage({ type: 'rms', rms })
      this._sumSq       = 0
      this._sampleCount = 0
      this._bufCount    = 0
    }

    return true
  }
}

registerProcessor('sidechain-processor', SidechainProcessor)
