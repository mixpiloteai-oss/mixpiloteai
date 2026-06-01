// ─── FrequencyCollisionDetector ───────────────────────────────────────────────
// Detects frequency collisions between tracks and kick/bass conflicts.

import { FrequencyAnalyzer } from './FrequencyAnalyzer'
import type { SpectrumData } from './FrequencyAnalyzer'

export interface AnalysisTrack {
  id:     string
  name:   string
  buffer: Float32Array
}

export interface FrequencyCollision {
  trackA:      string
  trackB:      string
  frequencyHz: number
  severityDb:  number
  band:        string
}

export interface KickBassConflict {
  subBassOverlap: number  // 0–1 overlap intensity in 20–80 Hz
  bassOverlap:    number  // 0–1 overlap intensity in 80–250 Hz
  severity:       'low' | 'medium' | 'high'
  details:        string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEMITONE_RATIO = Math.pow(2, 1 / 12)  // ≈ 1.0595

function freqToBand(hz: number): string {
  if (hz < 80)   return 'sub-bass'
  if (hz < 250)  return 'bass'
  if (hz < 500)  return 'low-mid'
  if (hz < 2000) return 'mid'
  if (hz < 6000) return 'presence'
  return 'air'
}

/**
 * Returns true if two frequencies are within 3 semitones of each other.
 */
function withinSemitones(freqA: number, freqB: number, semitones: number): boolean {
  if (freqA <= 0 || freqB <= 0) return false
  const ratio = freqA > freqB ? freqA / freqB : freqB / freqA
  return ratio <= Math.pow(SEMITONE_RATIO, semitones)
}

function computeOverlapIntensity(
  specA: SpectrumData,
  specB: SpectrumData,
  minHz: number,
  maxHz: number,
): number {
  const freqsA = specA.frequencies
  const magsA  = specA.magnitudes
  const freqsB = specB.frequencies
  const magsB  = specB.magnitudes

  let totalA = 0
  let totalB = 0
  let overlapA = 0
  let overlapB = 0

  const lenA = freqsA.length
  const lenB = freqsB.length

  for (let k = 0; k < lenA; k++) {
    const freq = freqsA[k] ?? 0
    const db   = magsA[k] ?? -Infinity
    if (isFinite(db)) {
      const lin = Math.pow(10, db / 20)
      totalA += lin
      if (freq >= minHz && freq <= maxHz) overlapA += lin
    }
  }

  for (let k = 0; k < lenB; k++) {
    const freq = freqsB[k] ?? 0
    const db   = magsB[k] ?? -Infinity
    if (isFinite(db)) {
      const lin = Math.pow(10, db / 20)
      totalB += lin
      if (freq >= minHz && freq <= maxHz) overlapB += lin
    }
  }

  if (totalA === 0 || totalB === 0) return 0
  return Math.sqrt((overlapA / totalA) * (overlapB / totalB))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class FrequencyCollisionDetector {
  private readonly analyzer = new FrequencyAnalyzer()

  detectCollisions(
    tracks: AnalysisTrack[],
    sampleRate: number,
  ): FrequencyCollision[] {
    if (tracks.length < 2) return []

    // Pre-compute spectrum for each track
    const spectra = tracks.map((track) =>
      this.analyzer.analyzeSpectrum(track.buffer, sampleRate),
    )

    const collisions: FrequencyCollision[] = []
    const THRESHOLD_DB = -30

    for (let a = 0; a < tracks.length - 1; a++) {
      for (let b = a + 1; b < tracks.length; b++) {
        const specA = spectra[a]!
        const specB = spectra[b]!
        const trackA = tracks[a]!.id
        const trackB = tracks[b]!.id

        // For each bin in track A above threshold, look for matching bins in track B
        for (let k = 0; k < specA.frequencies.length; k++) {
          const freqA = specA.frequencies[k] ?? 0
          const dbA   = specA.magnitudes[k] ?? -Infinity

          if (!isFinite(dbA) || dbA < THRESHOLD_DB) continue

          // Find matching bin in specB within 3 semitones
          for (let j = 0; j < specB.frequencies.length; j++) {
            const freqB = specB.frequencies[j] ?? 0
            const dbB   = specB.magnitudes[j] ?? -Infinity

            if (!isFinite(dbB) || dbB < THRESHOLD_DB) continue

            if (withinSemitones(freqA, freqB, 3)) {
              const severity = Math.min(dbA, dbB)
              collisions.push({
                trackA,
                trackB,
                frequencyHz: (freqA + freqB) / 2,
                severityDb:  severity,
                band:        freqToBand((freqA + freqB) / 2),
              })
              break  // One collision per bin pair is enough
            }
          }
        }
      }
    }

    // Deduplicate: group by frequency range (50Hz buckets) and take strongest
    const bucketMap = new Map<string, FrequencyCollision>()
    for (const col of collisions) {
      const bucket = `${col.trackA}:${col.trackB}:${Math.round(col.frequencyHz / 50)}`
      const existing = bucketMap.get(bucket)
      if (!existing || col.severityDb > existing.severityDb) {
        bucketMap.set(bucket, col)
      }
    }

    return Array.from(bucketMap.values())
  }

  detectKickBassConflict(
    kick: AnalysisTrack,
    bass: AnalysisTrack,
    sampleRate: number,
  ): KickBassConflict {
    const kickSpectrum = this.analyzer.analyzeSpectrum(kick.buffer, sampleRate)
    const bassSpectrum = this.analyzer.analyzeSpectrum(bass.buffer, sampleRate)

    // Sub-bass: 20–80 Hz, Bass: 80–250 Hz
    const subBassOverlap = computeOverlapIntensity(kickSpectrum, bassSpectrum, 20, 80)
    const bassOverlap    = computeOverlapIntensity(kickSpectrum, bassSpectrum, 80, 250)

    const combined = (subBassOverlap + bassOverlap) / 2
    let severity: 'low' | 'medium' | 'high'
    if (combined > 0.3)       severity = 'high'
    else if (combined > 0.15) severity = 'medium'
    else                      severity = 'low'

    const details = `Sub-bass overlap: ${(subBassOverlap * 100).toFixed(1)}%, ` +
      `Bass overlap: ${(bassOverlap * 100).toFixed(1)}%`

    return { subBassOverlap, bassOverlap, severity, details }
  }
}

export const frequencyCollisionDetector = new FrequencyCollisionDetector()
