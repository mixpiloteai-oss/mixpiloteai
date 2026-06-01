// ─── GainStagingAnalyzer ──────────────────────────────────────────────────────
// Analyzes gain staging across tracks and suggests adjustments.

export interface GainStagingTrack {
  id:     string
  name:   string
  buffer: Float32Array
}

export interface TrackGainAdvice {
  trackId:           string
  currentRmsDb:      number
  targetRmsDb:       number
  gainAdjustmentDb:  number
  isClipping:        boolean
  needsGainReduction: boolean
}

export interface GainStagingResult {
  tracks:             TrackGainAdvice[]
  suggestedMasterGain: number   // dB to apply to master to reach -14 LUFS
  averageRmsDb:       number
}

// Target: -18 to -12 dBRMS for instrument tracks (midpoint -15)
const TARGET_RMS_LOW  = -18
const TARGET_RMS_HIGH = -12
const TARGET_RMS_MID  = (TARGET_RMS_LOW + TARGET_RMS_HIGH) / 2  // -15

const CLIP_THRESHOLD = 0.9999
const TARGET_LUFS    = -14

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRmsDb(buffer: Float32Array): number {
  if (buffer.length === 0) return -Infinity
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const s = buffer[i] ?? 0
    sum += s * s
  }
  const rms = Math.sqrt(sum / buffer.length)
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity
}

function isClipping(buffer: Float32Array): boolean {
  for (let i = 0; i < buffer.length; i++) {
    if (Math.abs(buffer[i] ?? 0) >= CLIP_THRESHOLD) return true
  }
  return false
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class GainStagingAnalyzer {
  analyzeGainStaging(tracks: GainStagingTrack[]): GainStagingResult {
    if (tracks.length === 0) {
      return {
        tracks: [],
        suggestedMasterGain: 0,
        averageRmsDb: -Infinity,
      }
    }

    let totalRms       = 0
    let finiteCount    = 0

    const trackAdvice: TrackGainAdvice[] = tracks.map((track) => {
      const currentRmsDb = computeRmsDb(track.buffer)
      const clipping     = isClipping(track.buffer)

      // If RMS is finite, use target mid; otherwise suggest moderate reduction
      const targetRmsDb = isFinite(currentRmsDb) ? TARGET_RMS_MID : TARGET_RMS_MID
      const gainAdjustmentDb = isFinite(currentRmsDb)
        ? targetRmsDb - currentRmsDb
        : 0

      const needsGainReduction = isFinite(currentRmsDb) && currentRmsDb > TARGET_RMS_HIGH

      if (isFinite(currentRmsDb)) {
        totalRms    += currentRmsDb
        finiteCount++
      }

      return {
        trackId:           track.id,
        currentRmsDb,
        targetRmsDb,
        gainAdjustmentDb,
        isClipping:        clipping,
        needsGainReduction,
      }
    })

    const averageRmsDb = finiteCount > 0 ? totalRms / finiteCount : -Infinity

    // Suggested master gain: how many dB to adjust to reach -14 LUFS
    // Approximate: LUFS ≈ RMS - some offset, we target -14 LUFS
    // Assuming average RMS correlates with integrated loudness
    // A typical offset between RMS and LUFS is ~3 dB
    const estimatedLufs    = isFinite(averageRmsDb) ? averageRmsDb - 3 : -Infinity
    const suggestedMasterGain = isFinite(estimatedLufs)
      ? TARGET_LUFS - estimatedLufs
      : 0

    return { tracks: trackAdvice, suggestedMasterGain, averageRmsDb }
  }
}

export const gainStagingAnalyzer = new GainStagingAnalyzer()
