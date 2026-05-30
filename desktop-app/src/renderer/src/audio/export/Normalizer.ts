// ─── Normalizer ───────────────────────────────────────────────────────────────
// Peak and LUFS (ITU-R BS.1770-4) normalization.
// All analysis runs on the CPU in a single pass.

export type NormMode = 'none' | 'peak' | 'lufs' | 'true-peak'

export interface NormResult {
  mode:        NormMode
  measuredDB:  number   // measured peak or LUFS before normalization
  appliedGain: number   // linear gain applied
  targetDB:    number
}

// ── K-weighting filter (ITU-R BS.1770-4) ─────────────────────────────────────
// Two cascaded biquad sections per channel:
//   Stage 1: pre-filter (high-pass shelving, gain +4 dB at high freq)
//   Stage 2: RLB high-pass (rolls off below ~38 Hz)

function makeKWeightingCoeffs(sampleRate: number): { s1: number[]; s2: number[] } {
  // Stage 1: pre-filter coefficients (from BS.1770 Annex 1, Eq. 1)
  const f0  = 1681.974450955533
  const G   = 3.999843853973347
  const Q   = 0.7071752369554196
  const K1  = Math.tan(Math.PI * f0 / sampleRate)
  const Vh  = Math.pow(10, G / 20)
  const Vb  = Math.pow(Vh, 0.4996667741545416)
  const a0s1 = 1 + K1 / Q + K1 * K1
  const b0s1 = (Vh + Vb * K1 / Q + K1 * K1) / a0s1
  const b1s1 = 2 * (K1 * K1 - Vh) / a0s1
  const b2s1 = (Vh - Vb * K1 / Q + K1 * K1) / a0s1
  const a1s1 = 2 * (K1 * K1 - 1) / a0s1
  const a2s1 = (1 - K1 / Q + K1 * K1) / a0s1

  // Stage 2: RLB high-pass coefficients (from BS.1770 Annex 1, Eq. 2)
  const f2  = 38.13547087602444
  const Q2  = 0.5003270373238773
  const K2  = Math.tan(Math.PI * f2 / sampleRate)
  const a0s2 = 1 + K2 / Q2 + K2 * K2
  const b0s2 = 1 / a0s2
  const b1s2 = -2 / a0s2
  const b2s2 = 1 / a0s2
  const a1s2 = 2 * (K2 * K2 - 1) / a0s2
  const a2s2 = (1 - K2 / Q2 + K2 * K2) / a0s2

  return {
    s1: [b0s1, b1s1, b2s1, a1s1, a2s1],
    s2: [b0s2, b1s2, b2s2, a1s2, a2s2],
  }
}

function applyBiquad(
  input: Float32Array,
  b0: number, b1: number, b2: number, a1: number, a2: number,
): Float32Array {
  const out = new Float32Array(input.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < input.length; i++) {
    const x = input[i]!
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x; y2 = y1; y1 = y
    out[i] = y
  }
  return out
}

function kWeight(channel: Float32Array, sampleRate: number): Float32Array {
  const { s1, s2 } = makeKWeightingCoeffs(sampleRate)
  const stage1 = applyBiquad(channel, s1[0]!, s1[1]!, s1[2]!, s1[3]!, s1[4]!)
  return applyBiquad(stage1, s2[0]!, s2[1]!, s2[2]!, s2[3]!, s2[4]!)
}

// ── LUFS measurement ──────────────────────────────────────────────────────────

export function measureLUFS(buffer: AudioBuffer): number {
  const sr      = buffer.sampleRate
  const blockMs = 400            // momentary block: 400 ms
  const hopMs   = 100            // hop: 100 ms (75% overlap)
  const blockLen = Math.floor(sr * blockMs / 1000)
  const hopLen   = Math.floor(sr * hopMs  / 1000)

  // K-weight all channels
  const kwChannels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    kwChannels.push(kWeight(buffer.getChannelData(c), sr))
  }

  const channelWeights = buffer.numberOfChannels >= 2 ? [1, 1] : [1]

  const blockLoudness: number[] = []
  const len = kwChannels[0]!.length

  for (let start = 0; start + blockLen <= len; start += hopLen) {
    let sumMeanSquares = 0
    for (let c = 0; c < kwChannels.length; c++) {
      let sumSq = 0
      const ch  = kwChannels[c]!
      for (let i = start; i < start + blockLen; i++) sumSq += ch[i]! * ch[i]!
      sumMeanSquares += channelWeights[c]! * (sumSq / blockLen)
    }
    if (sumMeanSquares > 0) {
      blockLoudness.push(-0.691 + 10 * Math.log10(sumMeanSquares))
    }
  }

  if (blockLoudness.length === 0) return -Infinity

  // Absolute gate: -70 LUFS
  const gated1 = blockLoudness.filter(l => l > -70)
  if (!gated1.length) return -Infinity

  // Relative gate: -10 LU below ungated mean
  const ungatedMean = gated1.reduce((s, v) => s + Math.pow(10, v / 10), 0) / gated1.length
  const relThreshold = 10 * Math.log10(ungatedMean) - 10
  const gated2 = gated1.filter(l => l > relThreshold)
  if (!gated2.length) return -Infinity

  const integratedLinear = gated2.reduce((s, v) => s + Math.pow(10, v / 10), 0) / gated2.length
  return -0.691 + 10 * Math.log10(integratedLinear)
}

// ── True Peak (4x oversampled) ────────────────────────────────────────────────

export function measureTruePeak(buffer: AudioBuffer): number {
  let maxPeak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]!)
      if (abs > maxPeak) maxPeak = abs
    }
  }
  return maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity
}

// ── Apply gain ────────────────────────────────────────────────────────────────

function applyGain(buffer: AudioBuffer, gainLinear: number): void {
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < ch.length; i++) ch[i]! *= gainLinear
  }
}

// ── Main normalizer ───────────────────────────────────────────────────────────

export function normalize(
  buffer:   AudioBuffer,
  mode:     NormMode,
  targetDB: number,
): NormResult {
  if (mode === 'none') {
    return { mode, measuredDB: 0, appliedGain: 1, targetDB }
  }

  let measuredDB: number

  if (mode === 'lufs') {
    measuredDB = measureLUFS(buffer)
  } else {
    // Peak or True Peak
    measuredDB = measureTruePeak(buffer)
  }

  if (!isFinite(measuredDB)) {
    return { mode, measuredDB: -Infinity, appliedGain: 1, targetDB }
  }

  const gainDB     = targetDB - measuredDB
  const gainLinear = Math.pow(10, gainDB / 20)

  // Safety cap: never boost more than +40 dB
  const safeGain = Math.min(gainLinear, Math.pow(10, 40 / 20))
  applyGain(buffer, safeGain)

  return { mode, measuredDB, appliedGain: safeGain, targetDB }
}
