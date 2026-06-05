// ─── Mix Analyzer ─────────────────────────────────────────────────────────────
// Frequency-band energy analysis from a master AnalyserNode (FFT).
// Splits spectrum into 7 perceptual bands and computes RMS per band.
// Pure computation — runs in <1 ms per tick.

export interface BandEnergy {
  label:     string
  freqLow:   number   // Hz
  freqHigh:  number   // Hz
  rms:       number   // 0–1 normalised
  dB:        number   // ≤ 0
}

export interface MixAnalysis {
  bands:          BandEnergy[]
  loudnessLUFS:   number   // rough estimate from overall RMS
  stereoWidth:    number   // 0–1 placeholder (mono analyser → 0)
  dynamicRange:   number   // dB difference between loud and quiet bands
  issues:         string[]
  suggestions:    string[]
}

// Perceptual frequency bands
const BANDS: { label: string; freqLow: number; freqHigh: number }[] = [
  { label: 'Sub',      freqLow:   20, freqHigh:   80  },
  { label: 'Bass',     freqLow:   80, freqHigh:   250 },
  { label: 'Lo-Mid',   freqLow:  250, freqHigh:   800 },
  { label: 'Mid',      freqLow:  800, freqHigh:  2500 },
  { label: 'Hi-Mid',   freqLow: 2500, freqHigh:  5000 },
  { label: 'Presence', freqLow: 5000, freqHigh: 10000 },
  { label: 'Air',      freqLow:10000, freqHigh: 20000 },
]

function binRange(freqLow: number, freqHigh: number, sampleRate: number, fftSize: number): [number, number] {
  const nyquist   = sampleRate / 2
  const binWidth  = nyquist / (fftSize / 2)
  const lo = Math.max(0, Math.floor(freqLow / binWidth))
  const hi = Math.min(fftSize / 2 - 1, Math.ceil(freqHigh / binWidth))
  return [lo, hi]
}

function rmsSlice(data: Float32Array, lo: number, hi: number): number {
  let sum = 0
  const count = hi - lo + 1
  for (let i = lo; i <= hi; i++) {
    // data is magnitude in dBFS (from getFloatFrequencyData), convert to linear
    const lin = Math.pow(10, (data[i]! / 20))
    sum += lin * lin
  }
  return Math.sqrt(sum / count)
}

export function analyzeMix(analyser: AnalyserNode): MixAnalysis {
  const buf = new Float32Array(analyser.frequencyBinCount)
  analyser.getFloatFrequencyData(buf)

  const { sampleRate } = analyser.context
  const fftSize        = analyser.fftSize

  const bands: BandEnergy[] = BANDS.map(b => {
    const [lo, hi] = binRange(b.freqLow, b.freqHigh, sampleRate, fftSize)
    const rms      = rmsSlice(buf, lo, hi)
    const dB       = rms > 0 ? 20 * Math.log10(rms) : -96
    return { ...b, rms: Math.min(1, rms), dB }
  })

  // Overall loudness: average of mid + hi-mid bands (rough LUFS proxy)
  const mid    = bands.find(b => b.label === 'Mid')!
  const hiMid  = bands.find(b => b.label === 'Hi-Mid')!
  const loudnessLUFS = ((mid.dB + hiMid.dB) / 2) - 3  // rough proxy

  // Dynamic range: spread between loudest and quietest band
  const dBs          = bands.map(b => b.dB)
  const dynamicRange = Math.max(...dBs) - Math.min(...dBs)

  const issues:      string[] = []
  const suggestions: string[] = []

  const sub      = bands.find(b => b.label === 'Sub')!
  const bass     = bands.find(b => b.label === 'Bass')!
  const loMid    = bands.find(b => b.label === 'Lo-Mid')!
  const presence = bands.find(b => b.label === 'Presence')!
  const air      = bands.find(b => b.label === 'Air')!

  if (sub.rms > 0.8) {
    issues.push('Excessive sub energy below 80 Hz')
    suggestions.push('Apply a high-pass filter at 30–40 Hz and check for resonances around 50–60 Hz.')
  }
  if (bass.rms > sub.rms * 1.8) {
    issues.push('Bass band dominates sub — may sound heavy')
    suggestions.push('Reduce 100–150 Hz by 2–4 dB to balance the low end.')
  }
  if (loMid.rms > mid.rms * 1.5) {
    issues.push('Low-mid buildup (250–800 Hz) muddying the mix')
    suggestions.push('Cut 300–500 Hz by 2–3 dB on the busiest instrument in this range.')
  }
  if (presence.rms < 0.1) {
    issues.push('Lacking presence (5–10 kHz) — mix may feel dull')
    suggestions.push('Add a gentle high-shelf boost (+2 dB) at 8 kHz on the master bus.')
  }
  if (air.rms < 0.05) {
    issues.push('No air (>10 kHz) — mix sounds closed')
    suggestions.push('A subtle air band boost (+1–2 dB at 16 kHz) adds openness without harshness.')
  }
  if (dynamicRange < 6) {
    issues.push('Low dynamic range — mix may be over-compressed')
    suggestions.push('Back off the master limiter threshold by 1–2 dB to restore transient punch.')
  }

  return { bands, loudnessLUFS, stereoWidth: 0, dynamicRange, issues, suggestions }
}
