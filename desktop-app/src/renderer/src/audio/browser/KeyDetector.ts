export type MusicalKey = string // e.g. "C major", "A minor"

export class KeyDetector {
  // Krumhansl-Schmuckler key profiles
  private static readonly MAJOR_PROFILE: readonly number[] = [
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
  ]
  private static readonly MINOR_PROFILE: readonly number[] = [
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
  ]

  private static readonly NOTE_NAMES: readonly string[] = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  ]

  detect(buffer: AudioBuffer): MusicalKey | null {
    if (buffer.length === 0) return null
    try {
      const chroma = this._computeChroma(buffer)
      return this._matchProfile(chroma)
    } catch {
      return null
    }
  }

  private _computeChroma(buffer: AudioBuffer): Float32Array {
    const chroma = new Float32Array(12)
    const sampleRate = buffer.sampleRate
    const data = buffer.getChannelData(0)
    // Use a window of up to 4 seconds for analysis
    const maxSamples = Math.min(data.length, sampleRate * 4)

    // Simple DFT for specific MIDI note frequencies (MIDI 21-108 = A0-C8)
    for (let midi = 21; midi <= 108; midi++) {
      const freq = 440 * Math.pow(2, (midi - 69) / 12)
      const pc = midi % 12
      // Compute magnitude at this frequency via Goertzel algorithm
      const mag = this._goertzel(data, maxSamples, freq, sampleRate)
      chroma[pc] = (chroma[pc] ?? 0) + mag
    }

    // Normalize
    let max = 0
    for (let i = 0; i < 12; i++) if ((chroma[i] ?? 0) > max) max = chroma[i] ?? 0
    if (max > 0) for (let i = 0; i < 12; i++) chroma[i] = (chroma[i] ?? 0) / max
    return chroma
  }

  // Goertzel single-frequency detector
  private _goertzel(signal: Float32Array, n: number, freq: number, sampleRate: number): number {
    const omega = 2 * Math.PI * freq / sampleRate
    const coeff = 2 * Math.cos(omega)
    let s0 = 0, s1 = 0, s2 = 0
    for (let i = 0; i < n; i++) {
      s0 = (signal[i] ?? 0) + coeff * s1 - s2
      s2 = s1; s1 = s0
    }
    return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2)
  }

  private _matchProfile(chroma: Float32Array): MusicalKey {
    let bestKey = 'C major'
    let bestCorr = -Infinity

    const correlate = (a: Float32Array, b: readonly number[]): number => {
      const n = 12
      let sumAB = 0, sumA = 0, sumB = 0, sumA2 = 0, sumB2 = 0
      for (let i = 0; i < n; i++) {
        const ai = a[i] ?? 0
        const bi = b[i] ?? 0
        sumAB += ai * bi
        sumA  += ai; sumA2 += ai * ai
        sumB  += bi; sumB2 += bi * bi
      }
      const num = sumAB - (sumA * sumB) / n
      const den = Math.sqrt((sumA2 - sumA ** 2 / n) * (sumB2 - sumB ** 2 / n))
      return den < 1e-10 ? 0 : num / den
    }

    for (let root = 0; root < 12; root++) {
      const majProfile = KeyDetector.MAJOR_PROFILE
      const minProfile = KeyDetector.MINOR_PROFILE
      const majRotated = [...majProfile.slice(root), ...majProfile.slice(0, root)]
      const minRotated = [...minProfile.slice(root), ...minProfile.slice(0, root)]
      const majCorr = correlate(chroma, majRotated)
      const minCorr = correlate(chroma, minRotated)
      const noteName = KeyDetector.NOTE_NAMES[root] ?? 'C'
      if (majCorr > bestCorr) { bestCorr = majCorr; bestKey = `${noteName} major` }
      if (minCorr > bestCorr) { bestCorr = minCorr; bestKey = `${noteName} minor` }
    }
    return bestKey
  }
}

let _instance: KeyDetector | null = null

export function getKeyDetector(): KeyDetector {
  if (!_instance) _instance = new KeyDetector()
  return _instance
}
