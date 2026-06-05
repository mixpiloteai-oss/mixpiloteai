// ─── BpmDetector ─────────────────────────────────────────────────────────────
// BPM detection via autocorrelation on onset-strength signal.

export interface BpmResult {
  bpm:           number
  confidence:    number
  beatPositions: number[]
}

const HOP = 512

export function detectBpm(buffer: Float32Array, sampleRate: number): BpmResult {
  if (buffer.length < HOP * 8) {
    return { bpm: 0, confidence: 0, beatPositions: [] }
  }

  // ── Build onset-strength signal ────────────────────────────────────────
  const numFrames = Math.floor(buffer.length / HOP)
  const onset     = new Float32Array(numFrames)

  let prevEnergy = 0
  for (let f = 0; f < numFrames; f++) {
    let energy = 0
    const off  = f * HOP
    for (let i = 0; i < HOP; i++) energy += (buffer[off + i] ?? 0) ** 2
    const flux = energy - prevEnergy
    onset[f]   = flux > 0 ? flux : 0
    prevEnergy = energy
  }

  // ── Autocorrelation on onset signal ───────────────────────────────────
  const framesPerSec  = sampleRate / HOP
  const lagMin        = Math.round(framesPerSec * 60 / 200)  // 200 BPM
  const lagMax        = Math.round(framesPerSec * 60 / 60)   // 60 BPM

  const ac = new Float32Array(lagMax + 1)
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let sum = 0
    for (let f = 0; f < numFrames - lag; f++) sum += onset[f] * onset[f + lag]
    ac[lag] = sum
  }

  // ── Find peak in lag range ────────────────────────────────────────────
  let peakLag   = lagMin
  let peakValue = 0
  for (let lag = lagMin; lag <= lagMax; lag++) {
    if (ac[lag] > peakValue) { peakValue = ac[lag]; peakLag = lag }
  }

  const bpm = 60 * framesPerSec / peakLag

  // ── Confidence = peak / mean ──────────────────────────────────────────
  let meanAc = 0
  let count  = 0
  for (let lag = lagMin; lag <= lagMax; lag++) { meanAc += ac[lag]; count++ }
  meanAc /= count
  const confidence = meanAc > 0 ? Math.min(peakValue / (meanAc * 3), 1) : 0

  // ── Beat positions ────────────────────────────────────────────────────
  const beatPositions: number[] = []
  const firstOnset = onset.findIndex(v => v > 0)
  if (firstOnset >= 0) {
    let pos = firstOnset * HOP
    const beatStride = Math.round(peakLag * HOP)
    while (pos < buffer.length) {
      beatPositions.push(pos)
      pos += beatStride
    }
  }

  return { bpm: Math.round(bpm * 10) / 10, confidence, beatPositions }
}
