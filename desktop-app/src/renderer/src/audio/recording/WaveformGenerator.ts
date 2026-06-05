// ─── WaveformGenerator ────────────────────────────────────────────────────────
// Computes waveform peak data from Float32Array audio data.
// Pure computation — no file I/O, no browser APIs.

export interface WaveformPeaks {
  min:             Float32Array
  max:             Float32Array
  rms:             Float32Array
  samplesPerPixel: number
  totalSamples:    number
}

export class WaveformGenerator {
  // Compute peaks from multi-channel data (channels are averaged to mono for display).
  // Returns one min/max/rms value per block of `samplesPerPixel` samples.
  // The last block may be partial — it is still included.
  generateLive(channels: Float32Array[], samplesPerPixel: number): WaveformPeaks {
    if (channels.length === 0 || samplesPerPixel <= 0) {
      return { min: new Float32Array(0), max: new Float32Array(0), rms: new Float32Array(0), samplesPerPixel, totalSamples: 0 }
    }

    const totalSamples = channels[0].length
    const numBlocks    = Math.ceil(totalSamples / samplesPerPixel)
    const channelCount = channels.length

    const minArr = new Float32Array(numBlocks)
    const maxArr = new Float32Array(numBlocks)
    const rmsArr = new Float32Array(numBlocks)

    for (let b = 0; b < numBlocks; b++) {
      const start      = b * samplesPerPixel
      const end        = Math.min(start + samplesPerPixel, totalSamples)
      const blockLen   = end - start

      let blockMin  =  Infinity
      let blockMax  = -Infinity
      let sumSq     = 0

      for (let i = start; i < end; i++) {
        // Average channels to mono
        let sample = 0
        for (let ch = 0; ch < channelCount; ch++) {
          sample += channels[ch][i]
        }
        sample /= channelCount

        if (sample < blockMin) blockMin = sample
        if (sample > blockMax) blockMax = sample
        sumSq += sample * sample
      }

      minArr[b] = blockLen > 0 ? blockMin : 0
      maxArr[b] = blockLen > 0 ? blockMax : 0
      rmsArr[b] = blockLen > 0 ? Math.sqrt(sumSq / blockLen) : 0
    }

    return { min: minArr, max: maxArr, rms: rmsArr, samplesPerPixel, totalSamples }
  }

  // Generate peaks from a pre-decoded mono buffer.
  computeFromMono(mono: Float32Array, samplesPerPixel: number): WaveformPeaks {
    if (mono.length === 0 || samplesPerPixel <= 0) {
      return { min: new Float32Array(0), max: new Float32Array(0), rms: new Float32Array(0), samplesPerPixel, totalSamples: 0 }
    }

    const totalSamples = mono.length
    const numBlocks    = Math.ceil(totalSamples / samplesPerPixel)

    const minArr = new Float32Array(numBlocks)
    const maxArr = new Float32Array(numBlocks)
    const rmsArr = new Float32Array(numBlocks)

    for (let b = 0; b < numBlocks; b++) {
      const start    = b * samplesPerPixel
      const end      = Math.min(start + samplesPerPixel, totalSamples)
      const blockLen = end - start

      let blockMin =  Infinity
      let blockMax = -Infinity
      let sumSq    = 0

      for (let i = start; i < end; i++) {
        const sample = mono[i]
        if (sample < blockMin) blockMin = sample
        if (sample > blockMax) blockMax = sample
        sumSq += sample * sample
      }

      minArr[b] = blockLen > 0 ? blockMin : 0
      maxArr[b] = blockLen > 0 ? blockMax : 0
      rmsArr[b] = blockLen > 0 ? Math.sqrt(sumSq / blockLen) : 0
    }

    return { min: minArr, max: maxArr, rms: rmsArr, samplesPerPixel, totalSamples }
  }
}
