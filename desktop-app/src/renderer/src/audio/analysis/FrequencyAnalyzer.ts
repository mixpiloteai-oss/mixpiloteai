// ─── FrequencyAnalyzer ────────────────────────────────────────────────────────
// Real DFT-based frequency analysis with Hann windowing.
// No external FFT library — pure math computation.

export interface SpectrumData {
  frequencies: Float32Array
  magnitudes:  Float32Array  // dBFS
  phases:      Float32Array  // radians
}

export interface OctaveBand {
  centerHz: number
  minHz:    number
  maxHz:    number
  avgDb:    number
  peakDb:   number
}

export interface OctaveBandData {
  bands: OctaveBand[]
}

// Standard 1/1-octave center frequencies
const OCTAVE_CENTERS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

// ─── Hann window ─────────────────────────────────────────────────────────────

function applyHannWindow(buffer: Float32Array): Float32Array {
  const N = buffer.length
  const windowed = new Float32Array(N)
  for (let n = 0; n < N; n++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
    windowed[n] = (buffer[n] ?? 0) * w
  }
  return windowed
}

// ─── Real DFT ─────────────────────────────────────────────────────────────────
// X[k] = Σ x[n]·cos(2πkn/N)  –  i·Σ x[n]·sin(2πkn/N)

function computeDFT(
  signal: Float32Array,
  fftSize: number,
): { real: Float32Array; imag: Float32Array } {
  const N = fftSize
  const half = Math.floor(N / 2) + 1
  const real = new Float32Array(half)
  const imag = new Float32Array(half)
  const twoPiOverN = (2 * Math.PI) / N

  for (let k = 0; k < half; k++) {
    let re = 0
    let im = 0
    const kTwoPiOverN = k * twoPiOverN
    for (let n = 0; n < N; n++) {
      const angle = kTwoPiOverN * n
      const sample = signal[n] ?? 0
      re += sample * Math.cos(angle)
      im -= sample * Math.sin(angle)
    }
    real[k] = re
    imag[k] = im
  }
  return { real, imag }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class FrequencyAnalyzer {
  /**
   * Analyze spectrum of an audio buffer.
   * Returns frequencies (Hz), magnitudes (dBFS), and phases (radians).
   */
  analyzeSpectrum(
    buffer: Float32Array,
    sampleRate: number,
    fftSize = 2048,
  ): SpectrumData {
    // Use up to fftSize samples from the buffer
    const N = Math.min(fftSize, buffer.length)
    const padded = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      padded[i] = buffer[i] ?? 0
    }

    const windowed = applyHannWindow(padded)
    const { real, imag } = computeDFT(windowed, N)

    const half = real.length
    const frequencies = new Float32Array(half)
    const magnitudes  = new Float32Array(half)
    const phases      = new Float32Array(half)
    const halfN       = N / 2

    for (let k = 0; k < half; k++) {
      frequencies[k] = (k * sampleRate) / N
      const re = real[k] ?? 0
      const im = imag[k] ?? 0
      const magnitude = Math.sqrt(re * re + im * im)
      // dBFS: 20 * log10(|X[k]| / (N/2))
      magnitudes[k] =
        magnitude > 0 ? 20 * Math.log10(magnitude / halfN) : -Infinity
      phases[k] = Math.atan2(im, re)
    }

    return { frequencies, magnitudes, phases }
  }

  /**
   * Compute energy in each of 10 standard octave bands.
   */
  computeOctaveBands(spectrum: SpectrumData, _sampleRate: number): OctaveBandData {
    const { frequencies, magnitudes } = spectrum
    const bands: OctaveBand[] = OCTAVE_CENTERS.map((centerHz) => {
      // One octave: lower = center / sqrt(2), upper = center * sqrt(2)
      const sqrt2 = Math.SQRT2
      const minHz = centerHz / sqrt2
      const maxHz = centerHz * sqrt2

      let sumLinear  = 0
      let count      = 0
      let peakLinear = 0

      for (let k = 0; k < frequencies.length; k++) {
        const freq = frequencies[k] ?? 0
        if (freq >= minHz && freq <= maxHz) {
          const db  = magnitudes[k] ?? -Infinity
          if (isFinite(db)) {
            const lin = Math.pow(10, db / 20)
            sumLinear  += lin
            peakLinear  = Math.max(peakLinear, lin)
            count++
          }
        }
      }

      const avgDb  = count > 0 && sumLinear > 0
        ? 20 * Math.log10(sumLinear / count)
        : -Infinity
      const peakDb = peakLinear > 0
        ? 20 * Math.log10(peakLinear)
        : -Infinity

      return { centerHz, minHz, maxHz, avgDb, peakDb }
    })

    return { bands }
  }

  /**
   * Detect mud frequencies: bins in 200–500 Hz range where energy is
   * more than 6 dB above both neighboring bins.
   */
  detectMudFrequencies(spectrum: SpectrumData): number[] {
    const { frequencies, magnitudes } = spectrum
    const mudFreqs: number[] = []

    for (let k = 1; k < frequencies.length - 1; k++) {
      const freq = frequencies[k] ?? 0
      if (freq < 200 || freq > 500) continue

      const db     = magnitudes[k] ?? -Infinity
      const dbPrev = magnitudes[k - 1] ?? -Infinity
      const dbNext = magnitudes[k + 1] ?? -Infinity

      if (
        isFinite(db) &&
        isFinite(dbPrev) &&
        isFinite(dbNext) &&
        db > dbPrev + 6 &&
        db > dbNext + 6
      ) {
        mudFreqs.push(freq)
      }
    }

    return mudFreqs
  }
}

export const frequencyAnalyzer = new FrequencyAnalyzer()
