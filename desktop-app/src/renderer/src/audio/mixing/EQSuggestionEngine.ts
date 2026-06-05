// ─── EQSuggestionEngine ───────────────────────────────────────────────────────
// AI-driven EQ suggestions based on spectrum analysis and track type.

import type { SpectrumData } from '../analysis/FrequencyAnalyzer'
import { FrequencyAnalyzer } from '../analysis/FrequencyAnalyzer'

export type TrackType =
  | 'kick' | 'bass' | 'snare' | 'hihat' | 'keys'
  | 'guitar' | 'vocals' | 'lead' | 'pad' | 'unknown'

export interface EQSuggestion {
  band:        string
  frequencyHz: number
  gainDb:      number
  qFactor:     number
  type:        'cut' | 'boost' | 'highpass' | 'lowpass' | 'shelf'
  reason:      string
  priority:    'critical' | 'recommended' | 'optional'
}

// ─── Track type detection ─────────────────────────────────────────────────────

const TRACK_TYPE_KEYWORDS: Record<TrackType, string[]> = {
  kick:   ['kick', 'bd', 'bass drum', 'bassdrum'],
  bass:   ['bass', 'sub', '808'],
  snare:  ['snare', 'sd', 'clap'],
  hihat:  ['hat', 'hi-hat', 'hihat', 'cymbal', 'hh'],
  keys:   ['piano', 'keys', 'keyboard', 'organ', 'synth key'],
  guitar: ['guitar', 'gtr', 'acoustic'],
  vocals: ['vocal', 'vox', 'voice', 'lead vox', 'backing vox'],
  lead:   ['lead', 'melody', 'arp', 'synth lead'],
  pad:    ['pad', 'strings', 'atmosphere', 'ambient'],
  unknown: [],
}

export function detectTrackType(name: string): TrackType {
  const lower = name.toLowerCase()
  for (const [type, keywords] of Object.entries(TRACK_TYPE_KEYWORDS) as [TrackType, string[]][]) {
    if (type === 'unknown') continue
    if (keywords.some((k) => lower.includes(k))) return type
  }
  return 'unknown'
}

// ─── Spectrum helpers ─────────────────────────────────────────────────────────

function avgDbInRange(spectrum: SpectrumData, minHz: number, maxHz: number): number {
  const { frequencies, magnitudes } = spectrum
  let sum   = 0
  let count = 0
  for (let k = 0; k < frequencies.length; k++) {
    const f  = frequencies[k] ?? 0
    const db = magnitudes[k] ?? -Infinity
    if (f >= minHz && f <= maxHz && isFinite(db)) {
      sum += db
      count++
    }
  }
  return count > 0 ? sum / count : -Infinity
}

// ─── Per-type suggestion rules ────────────────────────────────────────────────

function kickSuggestions(): EQSuggestion[] {
  return [
    {
      band: 'sub',      frequencyHz: 80,   gainDb:  2,  qFactor: 0.7,
      type: 'boost',    reason: 'Boost sub-bass body for kick punch',
      priority: 'recommended',
    },
    {
      band: 'low-mid',  frequencyHz: 250,  gainDb: -3,  qFactor: 1.4,
      type: 'cut',      reason: 'Cut mud to clean up kick low-mid boxiness',
      priority: 'recommended',
    },
    {
      band: 'upper-mid', frequencyHz: 4000, gainDb: 2,  qFactor: 1.0,
      type: 'boost',    reason: 'Boost attack transient click for definition',
      priority: 'optional',
    },
  ]
}

function bassSuggestions(spectrum: SpectrumData): EQSuggestion[] {
  const fundamentalDb = avgDbInRange(spectrum, 80, 160)
  const suggestions: EQSuggestion[] = [
    {
      band: 'sub',     frequencyHz: 40,  gainDb: 0,  qFactor: 0.7,
      type: 'highpass', reason: 'High-pass bass to remove sub-bass rumble below 40 Hz',
      priority: 'recommended',
    },
    {
      band: 'low-mid', frequencyHz: 200, gainDb: -2, qFactor: 1.4,
      type: 'cut',     reason: 'Cut mud area to separate bass from kick',
      priority: 'recommended',
    },
  ]
  if (isFinite(fundamentalDb) && fundamentalDb < -20) {
    suggestions.push({
      band: 'bass',   frequencyHz: 120, gainDb: 3,  qFactor: 0.7,
      type: 'boost',  reason: 'Boost fundamental frequency for bass presence',
      priority: 'optional',
    })
  }
  return suggestions
}

function snareSuggestions(): EQSuggestion[] {
  return [
    {
      band: 'sub',     frequencyHz: 80,  gainDb: 0,  qFactor: 0.7,
      type: 'highpass', reason: 'High-pass snare to remove low-end rumble',
      priority: 'recommended',
    },
    {
      band: 'low-mid', frequencyHz: 400, gainDb: -2, qFactor: 1.4,
      type: 'cut',     reason: 'Cut boxy low-mid build-up',
      priority: 'recommended',
    },
    {
      band: 'presence', frequencyHz: 5000, gainDb: 2, qFactor: 1.0,
      type: 'boost',    reason: 'Boost crack and snare wire detail',
      priority: 'optional',
    },
  ]
}

function hihatSuggestions(): EQSuggestion[] {
  return [
    {
      band: 'presence', frequencyHz: 8000, gainDb: 0, qFactor: 0.7,
      type: 'highpass', reason: 'High-pass hi-hat to keep only top frequencies',
      priority: 'critical',
    },
    {
      band: 'low-mid', frequencyHz: 3000, gainDb: -3, qFactor: 0.7,
      type: 'cut',     reason: 'Cut low rumble and body below 5 kHz',
      priority: 'recommended',
    },
  ]
}

function vocalsSuggestions(spectrum: SpectrumData): EQSuggestion[] {
  const harshnessDb = avgDbInRange(spectrum, 2000, 3000)
  const suggestions: EQSuggestion[] = [
    {
      band: 'sub',      frequencyHz: 80,  gainDb: 0,  qFactor: 0.7,
      type: 'highpass', reason: 'High-pass vocals to remove low rumble and plosives',
      priority: 'recommended',
    },
    {
      band: 'presence', frequencyHz: 4000, gainDb: 2, qFactor: 1.0,
      type: 'boost',    reason: 'Boost presence for vocal clarity and intelligibility',
      priority: 'recommended',
    },
  ]
  if (isFinite(harshnessDb) && harshnessDb > -12) {
    suggestions.push({
      band: 'harshness', frequencyHz: 2500, gainDb: -2, qFactor: 2.0,
      type: 'cut',       reason: 'Cut harsh 2–3 kHz zone to reduce sibilance buildup',
      priority: 'recommended',
    })
  }
  return suggestions
}

function padSuggestions(): EQSuggestion[] {
  return [
    {
      band: 'bass',    frequencyHz: 120,  gainDb: 0,  qFactor: 0.7,
      type: 'highpass', reason: 'High-pass pad to prevent low-end muddiness',
      priority: 'recommended',
    },
    {
      band: 'bass-shelf', frequencyHz: 200, gainDb: -3, qFactor: 0.5,
      type: 'shelf',    reason: 'Low-shelf cut to thin out pad for mix space',
      priority: 'recommended',
    },
    {
      band: 'air-shelf', frequencyHz: 8000, gainDb: -3, qFactor: 0.5,
      type: 'shelf',    reason: 'High-shelf cut to reduce pad air and make space for cymbals',
      priority: 'optional',
    },
  ]
}

function guitarSuggestions(): EQSuggestion[] {
  return [
    {
      band: 'sub',     frequencyHz: 80,  gainDb: 0,  qFactor: 0.7,
      type: 'highpass', reason: 'High-pass guitar to remove low-end build-up',
      priority: 'recommended',
    },
    {
      band: 'low-mid', frequencyHz: 300, gainDb: -2, qFactor: 1.4,
      type: 'cut',     reason: 'Cut guitar mud at 300 Hz for clarity',
      priority: 'recommended',
    },
    {
      band: 'presence', frequencyHz: 2000, gainDb: 2, qFactor: 1.0,
      type: 'boost',   reason: 'Boost guitar presence for cut-through in mix',
      priority: 'optional',
    },
  ]
}

function leadSuggestions(): EQSuggestion[] {
  return [
    {
      band: 'sub',     frequencyHz: 100, gainDb: 0,  qFactor: 0.7,
      type: 'highpass', reason: 'High-pass lead synth to clear low end',
      priority: 'recommended',
    },
    {
      band: 'mid',     frequencyHz: 500, gainDb: -2, qFactor: 1.4,
      type: 'cut',     reason: 'Cut mid boxiness in lead for transparency',
      priority: 'recommended',
    },
    {
      band: 'presence', frequencyHz: 3000, gainDb: 2, qFactor: 1.0,
      type: 'boost',   reason: 'Boost lead presence to cut through mix',
      priority: 'optional',
    },
  ]
}

function keysSuggestions(): EQSuggestion[] {
  return [
    {
      band: 'sub',     frequencyHz: 60,  gainDb: 0,  qFactor: 0.7,
      type: 'highpass', reason: 'High-pass keys to avoid bass frequency conflict',
      priority: 'recommended',
    },
    {
      band: 'low-mid', frequencyHz: 200, gainDb: -2, qFactor: 1.4,
      type: 'cut',     reason: 'Cut keys mud to keep low end clean',
      priority: 'recommended',
    },
  ]
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class EQSuggestionEngine {
  private readonly analyzer = new FrequencyAnalyzer()

  suggestEQ(
    spectrum: SpectrumData,
    trackName: string,
    trackType?: TrackType,
  ): EQSuggestion[] {
    const type = trackType ?? detectTrackType(trackName)

    let suggestions: EQSuggestion[]
    switch (type) {
      case 'kick':   suggestions = kickSuggestions(); break
      case 'bass':   suggestions = bassSuggestions(spectrum); break
      case 'snare':  suggestions = snareSuggestions(); break
      case 'hihat':  suggestions = hihatSuggestions(); break
      case 'vocals': suggestions = vocalsSuggestions(spectrum); break
      case 'pad':    suggestions = padSuggestions(); break
      case 'guitar': suggestions = guitarSuggestions(); break
      case 'lead':   suggestions = leadSuggestions(); break
      case 'keys':   suggestions = keysSuggestions(); break
      default:       suggestions = []
    }

    // Add cuts at detected mud frequencies
    const mudFreqs = this.analyzer.detectMudFrequencies(spectrum)
    for (const freq of mudFreqs) {
      // Don't add duplicates near already suggested frequencies
      const alreadySuggested = suggestions.some(
        (s) => Math.abs(s.frequencyHz - freq) < 50,
      )
      if (!alreadySuggested) {
        suggestions.push({
          band:        'mud',
          frequencyHz: freq,
          gainDb:      -4,
          qFactor:     2.0,
          type:        'cut',
          reason:      `Cut mud frequency peak at ${freq.toFixed(0)} Hz detected in spectrum`,
          priority:    'recommended',
        })
      }
    }

    return suggestions
  }
}

export const eqSuggestionEngine = new EQSuggestionEngine()
