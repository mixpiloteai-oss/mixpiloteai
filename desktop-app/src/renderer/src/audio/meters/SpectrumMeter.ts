// ─── SpectrumMeter ────────────────────────────────────────────────────────────
// Real-time spectrum metering with logarithmic bar scaling.

import { FrequencyAnalyzer } from '../analysis/FrequencyAnalyzer'
import type { SpectrumData } from '../analysis/FrequencyAnalyzer'

// ─── Public API ───────────────────────────────────────────────────────────────

export class SpectrumMeter {
  private readonly analyzer = new FrequencyAnalyzer()

  /**
   * Smooth spectrum: alpha=1.0 → prev, alpha=0.0 → next
   */
  computeSmoothedSpectrum(
    prev: Float32Array,
    next: Float32Array,
    smoothing = 0.8,
  ): Float32Array {
    const len    = Math.min(prev.length, next.length)
    const result = new Float32Array(len)
    for (let i = 0; i < len; i++) {
      const p = prev[i] ?? -Infinity
      const n = next[i] ?? -Infinity
      // Handle -Infinity gracefully
      if (!isFinite(p) && !isFinite(n)) {
        result[i] = -Infinity
      } else if (!isFinite(p)) {
        result[i] = n
      } else if (!isFinite(n)) {
        result[i] = p
      } else {
        result[i] = smoothing * p + (1 - smoothing) * n
      }
    }
    return result
  }

  /**
   * Compute bar heights for a spectrum display.
   * numBars bars with logarithmic frequency spacing.
   * Returns magnitudes (dBFS) for each bar — the max in that bar's range.
   */
  computeBarHeights(
    spectrum: SpectrumData,
    numBars: number,
    sampleRate: number,
  ): Float32Array {
    const bars       = new Float32Array(numBars)
    const { frequencies, magnitudes } = spectrum
    const freqMin    = 20
    const freqMax    = sampleRate / 2

    for (let i = 0; i < numBars; i++) {
      // Logarithmic frequency boundaries for bar i
      const freqLo = freqMin * Math.pow(freqMax / freqMin, i / numBars)
      const freqHi = freqMin * Math.pow(freqMax / freqMin, (i + 1) / numBars)

      let maxDb = -Infinity
      for (let k = 0; k < frequencies.length; k++) {
        const f  = frequencies[k] ?? 0
        if (f >= freqLo && f < freqHi) {
          const db = magnitudes[k] ?? -Infinity
          if (isFinite(db) && db > maxDb) maxDb = db
        }
      }
      bars[i] = isFinite(maxDb) ? maxDb : -120
    }

    return bars
  }

  /**
   * Start realtime spectrum analysis. Returns stop function.
   * Uses setInterval (not requestAnimationFrame).
   */
  start(
    getBuffer: () => Float32Array,
    sampleRate: number,
    onSpectrum: (spectrum: SpectrumData, bars: Float32Array) => void,
    numBars = 64,
  ): () => void {
    let prevBars = new Float32Array(numBars).fill(-120)

    const id = setInterval(() => {
      const buffer = getBuffer()
      if (buffer.length === 0) return

      const spectrum = this.analyzer.analyzeSpectrum(buffer, sampleRate)
      const rawBars  = this.computeBarHeights(spectrum, numBars, sampleRate)
      const smoothed = this.computeSmoothedSpectrum(prevBars, rawBars, 0.8)
      prevBars       = smoothed

      onSpectrum(spectrum, smoothed)
    }, 60)

    return () => clearInterval(id)
  }
}

export const spectrumMeter = new SpectrumMeter()
