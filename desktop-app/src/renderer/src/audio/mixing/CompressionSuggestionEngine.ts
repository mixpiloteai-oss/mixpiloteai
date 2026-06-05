// ─── CompressionSuggestionEngine ──────────────────────────────────────────────
// Suggests compressor settings based on dynamics analysis.

import type { DynamicsResult } from '../analysis/DynamicsAnalyzer'
import type { TrackType } from './EQSuggestionEngine'

export interface CompressionSuggestion {
  threshold:  number   // dBFS
  ratio:      number   // e.g. 4.0 means 4:1
  attack:     number   // ms
  release:    number   // ms
  makeupGain: number   // dB
  knee:       number   // dB (soft knee width)
  reason:     string
  priority:   'critical' | 'recommended' | 'optional'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeMakeupGain(threshold: number, ratio: number): number {
  // Approximate makeup: -threshold * (1 - 1/ratio) to compensate for gain reduction
  return -threshold * (1 - 1 / ratio)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class CompressionSuggestionEngine {
  suggestCompression(
    dynamics: DynamicsResult,
    trackType?: TrackType,
  ): CompressionSuggestion {
    const { rmsDb, crestFactor } = dynamics

    // Base settings from crest factor
    let attack: number
    let ratio: number
    let release = 120

    if (crestFactor > 20) {
      // High crest factor → transient heavy → fast attack, higher ratio
      attack  = 5
      ratio   = 4.0
      release = 80
    } else if (crestFactor >= 10) {
      // Medium dynamics
      attack  = 10
      ratio   = 3.0
      release = 120
    } else {
      // Low crest factor → already compressed → gentle settings
      attack  = 20
      ratio   = 2.0
      release = 200
    }

    // Track-type overrides
    switch (trackType) {
      case 'kick':
        attack  = 5
        release = 50
        ratio   = 4.0
        break
      case 'vocals':
        attack  = 10
        release = 100
        ratio   = 3.0
        break
      case 'bass':
        attack  = 20
        release = 150
        ratio   = 3.0
        break
      case 'snare':
        attack  = 5
        release = 60
        ratio   = 4.0
        break
      case 'pad':
        attack  = 30
        release = 300
        ratio   = 2.0
        break
      case 'guitar':
        attack  = 15
        release = 120
        ratio   = 3.0
        break
      case 'lead':
        attack  = 10
        release = 100
        ratio   = 3.0
        break
      default:
        break
    }

    // Threshold: rmsDb + 6 dB (so average signal gets compressed at peaks)
    const threshold = isFinite(rmsDb) ? rmsDb + 6 : -18
    const makeupGain = computeMakeupGain(threshold, ratio)
    const knee = ratio <= 2 ? 6 : ratio <= 3 ? 4 : 2

    const reasonParts: string[] = [
      `${ratio}:1 ratio`,
      `${attack}ms attack`,
      `${release}ms release`,
    ]
    if (crestFactor > 20) {
      reasonParts.push('fast attack for high-crest transients')
    } else if (crestFactor < 6) {
      reasonParts.push('gentle settings for already-compressed material')
    }
    if (trackType) {
      reasonParts.push(`optimized for ${trackType}`)
    }

    const priority: 'critical' | 'recommended' | 'optional' =
      crestFactor > 20 || dynamics.isClipping
        ? 'critical'
        : crestFactor > 10
        ? 'recommended'
        : 'optional'

    return {
      threshold,
      ratio,
      attack,
      release,
      makeupGain,
      knee,
      reason:   reasonParts.join(', '),
      priority,
    }
  }
}

// Extend DynamicsResult type check to include isClipping if needed
declare module '../analysis/DynamicsAnalyzer' {
  interface DynamicsResult {
    isClipping?: boolean
  }
}

export const compressionSuggestionEngine = new CompressionSuggestionEngine()
