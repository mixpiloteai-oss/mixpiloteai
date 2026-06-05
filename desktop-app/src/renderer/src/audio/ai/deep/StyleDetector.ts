// ─── StyleDetector.ts ─────────────────────────────────────────────────────────
// Detects music style from BPM, groove, arrangement and mix characteristics.

import type { MusicStyle } from './AnalysisTypes'
import type { GrooveAnalysis } from './GrooveAnalyzer'
import type { ArrangementAnalysis } from './ArrangementAnalyzer'
import type { MixAnalysis } from './MixAnalyzer'

export interface StyleDetection {
  primaryStyle: MusicStyle
  confidence: number
  subStyle: string
  bpmRange: { min: number; max: number }
  characteristicElements: string[]
  referenceArtists: string[]
}

const STYLE_DATA: Record<MusicStyle, {
  bpmMin: number
  bpmMax: number
  subStyle: string
  elements: string[]
  artists: string[]
}> = {
  house: {
    bpmMin: 115, bpmMax: 135,
    subStyle: 'deep house',
    elements: ['four-on-the-floor', 'offbeat hi-hats', 'soulful chords', 'bassline groove'],
    artists: ['Larry Heard', 'Kerri Chandler', 'Frankie Knuckles'],
  },
  techno: {
    bpmMin: 128, bpmMax: 145,
    subStyle: 'melodic techno',
    elements: ['four-on-the-floor', '303 acid line', 'reverb tail breakdown', 'industrial percussion'],
    artists: ['Plastikman', 'Robert Hood', 'Jeff Mills'],
  },
  dnb: {
    bpmMin: 160, bpmMax: 180,
    subStyle: 'dark dnb',
    elements: ['amen break', 'sub bass', 'reese bass', 'half-time feel'],
    artists: ['LTJ Bukem', 'Goldie', 'Andy C'],
  },
  trap: {
    bpmMin: 60, bpmMax: 90,
    subStyle: 'modern trap',
    elements: ['hi-hat triplets', '808 sub bass', 'snare on 3', 'syncopated kicks'],
    artists: ['Metro Boomin', 'Southside', 'Pi\'erre Bourne'],
  },
  hiphop: {
    bpmMin: 70, bpmMax: 115,
    subStyle: 'boom bap',
    elements: ['sampled breaks', 'punchy snare', 'bass groove', 'swung hi-hats'],
    artists: ['J Dilla', 'Madlib', 'Pete Rock'],
  },
  ambient: {
    bpmMin: 60, bpmMax: 100,
    subStyle: 'dark ambient',
    elements: ['long pads', 'reverb tails', 'sparse percussion', 'evolving textures'],
    artists: ['Brian Eno', 'Stars of the Lid', 'Tim Hecker'],
  },
  jazz: {
    bpmMin: 80, bpmMax: 200,
    subStyle: 'jazz fusion',
    elements: ['swing feel', 'walking bass', 'ii-V-I progressions', 'improvised melody'],
    artists: ['Miles Davis', 'John Coltrane', 'Herbie Hancock'],
  },
  latin: {
    bpmMin: 90, bpmMax: 130,
    subStyle: 'afro-latin',
    elements: ['clave rhythm', 'congas', 'montuno piano', 'call-and-response'],
    artists: ['Celia Cruz', 'Tito Puente', 'Buena Vista Social Club'],
  },
  tribal: {
    bpmMin: 120, bpmMax: 140,
    subStyle: 'tribal house',
    elements: ['tribal percussion', 'repetitive groove', 'toms', 'shakers'],
    artists: ['Osunlade', 'Nic Fanciulli', 'Kerri Chandler'],
  },
  experimental: {
    bpmMin: 60, bpmMax: 200,
    subStyle: 'experimental electronic',
    elements: ['atonal elements', 'unconventional structure', 'glitch', 'noise'],
    artists: ['Aphex Twin', 'Autechre', 'Arca'],
  },
  unknown: {
    bpmMin: 60, bpmMax: 200,
    subStyle: 'unclassified',
    elements: [],
    artists: [],
  },
}

/**
 * Detect music style from analysis data.
 */
export function detectStyle(
  bpm: number,
  groove: GrooveAnalysis,
  arrangement: ArrangementAnalysis,
  mix: MixAnalysis,
): StyleDetection {
  void arrangement // used for future enhancements
  void mix         // used for future enhancements

  // Style scoring
  const scores: Partial<Record<MusicStyle, number>> = {}

  // BPM-based scoring
  if (bpm >= 60 && bpm < 90) {
    scores.trap = (scores.trap ?? 0) + 0.4
    scores.hiphop = (scores.hiphop ?? 0) + 0.3
  }
  if (bpm >= 70 && bpm <= 115) {
    scores.hiphop = (scores.hiphop ?? 0) + 0.3
  }
  if (bpm >= 115 && bpm <= 135) {
    scores.house = (scores.house ?? 0) + 0.4
    scores.tribal = (scores.tribal ?? 0) + 0.2
  }
  if (bpm >= 128 && bpm <= 145) {
    scores.techno = (scores.techno ?? 0) + 0.4
  }
  if (bpm >= 140 && bpm <= 180) {
    scores.dnb = (scores.dnb ?? 0) + 0.4
  }
  if (bpm >= 60 && bpm <= 100) {
    scores.ambient = (scores.ambient ?? 0) + 0.2
  }
  if (bpm >= 90 && bpm <= 130) {
    scores.latin = (scores.latin ?? 0) + 0.2
  }

  // Groove-based scoring
  const hint = groove.styleHint
  const hintScore = 0.5
  if (hint === 'house') scores.house = (scores.house ?? 0) + hintScore
  else if (hint === 'techno') scores.techno = (scores.techno ?? 0) + hintScore
  else if (hint === 'dnb') scores.dnb = (scores.dnb ?? 0) + hintScore
  else if (hint === 'jazz') scores.jazz = (scores.jazz ?? 0) + hintScore
  else if (hint === 'funk') scores.hiphop = (scores.hiphop ?? 0) + hintScore * 0.5
  else if (hint === 'tribal') scores.tribal = (scores.tribal ?? 0) + hintScore
  else if (hint === 'trap') scores.trap = (scores.trap ?? 0) + hintScore
  else if (hint === 'latin') scores.latin = (scores.latin ?? 0) + hintScore

  // Find highest scoring style
  let bestStyle: MusicStyle = 'unknown'
  let bestScore = 0
  for (const [style, score] of Object.entries(scores) as [MusicStyle, number][]) {
    if (score > bestScore) {
      bestScore = score
      bestStyle = style
    }
  }

  // Confidence: normalize best score
  const confidence = Math.min(1, bestScore / 0.9)

  const data = STYLE_DATA[bestStyle]

  return {
    primaryStyle: bestStyle,
    confidence: confidence > 0 ? confidence : 0.1,
    subStyle: data.subStyle,
    bpmRange: { min: data.bpmMin, max: data.bpmMax },
    characteristicElements: data.elements,
    referenceArtists: data.artists,
  }
}
