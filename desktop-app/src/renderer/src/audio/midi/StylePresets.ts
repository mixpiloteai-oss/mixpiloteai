// ─── Style Presets ────────────────────────────────────────────────────────────
// Pure data module — no DOM/browser imports. Only imports from musicTheory.ts.

import type { ScaleMode } from '../../lib/musicTheory'

export type StyleName = 'techno' | 'house' | 'trap' | 'orchestral' | 'ambient' | 'cinematic' | 'edm'

export interface DrumStep {
  active: boolean
  velocity: number  // 1-127
}

export interface DrumPattern16 {
  kick:      DrumStep[]  // 16 elements
  snare:     DrumStep[]
  closedHat: DrumStep[]
  openHat:   DrumStep[]
  clap:      DrumStep[]
  rim:       DrumStep[]
}

export interface StylePreset {
  name:            StyleName
  label:           string
  bpmRange:        [number, number]
  swing:           number       // 0 = straight, 1 = max swing
  drumPattern:     DrumPattern16
  basslineStyle:   'stabs' | 'walking' | 'sustained' | 'pumping' | 'offbeat'
  melodyDensity:   'sparse' | 'medium' | 'dense'
  preferredMode:   ScaleMode
  chordOctave:     number       // center octave for chords
  bassOctave:      number       // bass octave (2 or 3)
  velocityAccent:  number[]     // 16 accent multipliers (0.5-1.3)
}

// ─── Helper to make 16-step pattern ─────────────────────────────────────────

function steps16(activeIndices: number[], baseVelocity: number, accentIndices: number[] = []): DrumStep[] {
  return Array.from({ length: 16 }, (_, i) => {
    const active = activeIndices.includes(i)
    const vel = accentIndices.includes(i) ? Math.min(127, baseVelocity + 20) : baseVelocity
    return { active, velocity: Math.max(1, Math.min(127, vel)) }
  })
}

function emptySteps(): DrumStep[] {
  return Array.from({ length: 16 }, () => ({ active: false, velocity: 80 }))
}

// ─── Style Presets ────────────────────────────────────────────────────────────
// Steps are 0-indexed. The spec uses 1-based notation (step 1 = index 0).

export const STYLE_PRESETS: Record<StyleName, StylePreset> = {

  techno: {
    name:          'techno',
    label:         'Techno',
    bpmRange:      [130, 150],
    swing:         0,
    drumPattern: {
      kick:      steps16([0, 4, 8, 12], 110, [0]),
      snare:     steps16([4, 12], 100, [4, 12]),
      closedHat: steps16([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], 70, [0, 4, 8, 12]),
      openHat:   emptySteps(),
      clap:      emptySteps(),
      rim:       steps16([2, 10], 85),
    },
    basslineStyle:  'sustained',
    melodyDensity:  'sparse',
    preferredMode:  'minor',
    chordOctave:    4,
    bassOctave:     2,
    velocityAccent: [1.2, 0.7, 0.8, 0.7, 1.1, 0.7, 0.8, 0.7, 1.1, 0.7, 0.8, 0.7, 1.1, 0.7, 0.8, 0.7],
  },

  house: {
    name:          'house',
    label:         'House',
    bpmRange:      [120, 135],
    swing:         0.1,
    drumPattern: {
      kick:      steps16([0, 4, 8, 12], 115, [0]),
      snare:     steps16([4, 12], 105, [4, 12]),
      closedHat: steps16([1, 3, 5, 7, 9, 11, 13, 15], 75, []),
      openHat:   steps16([2, 6, 10, 14], 90, [2, 6, 10, 14]),
      clap:      steps16([4, 12], 95),
      rim:       emptySteps(),
    },
    basslineStyle:  'walking',
    melodyDensity:  'medium',
    preferredMode:  'minor',
    chordOctave:    4,
    bassOctave:     2,
    velocityAccent: [1.2, 0.8, 0.9, 0.8, 1.1, 0.8, 0.9, 0.8, 1.1, 0.8, 0.9, 0.8, 1.1, 0.8, 0.9, 0.8],
  },

  trap: {
    name:          'trap',
    label:         'Trap',
    bpmRange:      [130, 175],
    swing:         0.15,
    drumPattern: {
      kick:      steps16([0, 2, 8], 115, [0]),
      snare:     steps16([4, 12], 110, [4, 12]),
      closedHat: steps16([0,1,2,3,4,5,6,7], 65, [0, 4]),
      openHat:   steps16([15], 95),
      clap:      emptySteps(),
      rim:       steps16([6, 9, 11], 80),
    },
    basslineStyle:  'stabs',
    melodyDensity:  'sparse',
    preferredMode:  'minor',
    chordOctave:    4,
    bassOctave:     2,
    velocityAccent: [1.3, 0.6, 0.7, 0.6, 1.1, 0.7, 0.8, 0.6, 1.2, 0.6, 0.7, 0.6, 1.0, 0.7, 0.8, 0.5],
  },

  orchestral: {
    name:          'orchestral',
    label:         'Orchestral',
    bpmRange:      [60, 120],
    swing:         0,
    drumPattern: {
      kick:      steps16([0], 95, [0]),
      snare:     steps16([4, 12], 80),
      closedHat: emptySteps(),
      openHat:   emptySteps(),
      clap:      emptySteps(),
      rim:       steps16([2, 6, 10, 14], 65),
    },
    basslineStyle:  'walking',
    melodyDensity:  'dense',
    preferredMode:  'major',
    chordOctave:    4,
    bassOctave:     2,
    velocityAccent: [1.2, 0.8, 0.9, 0.7, 1.1, 0.8, 0.9, 0.7, 1.1, 0.8, 0.9, 0.7, 1.1, 0.8, 0.9, 0.7],
  },

  ambient: {
    name:          'ambient',
    label:         'Ambient',
    bpmRange:      [70, 100],
    swing:         0,
    drumPattern: {
      kick:      steps16([0], 80, [0]),
      snare:     emptySteps(),
      closedHat: emptySteps(),
      openHat:   steps16([8], 60),
      clap:      emptySteps(),
      rim:       emptySteps(),
    },
    basslineStyle:  'sustained',
    melodyDensity:  'sparse',
    preferredMode:  'pentatonic-major',
    chordOctave:    4,
    bassOctave:     2,
    velocityAccent: [1.0, 0.7, 0.7, 0.7, 0.9, 0.7, 0.7, 0.7, 0.9, 0.7, 0.7, 0.7, 0.9, 0.7, 0.7, 0.7],
  },

  cinematic: {
    name:          'cinematic',
    label:         'Cinematic',
    bpmRange:      [60, 100],
    swing:         0,
    drumPattern: {
      kick:      emptySteps(),
      snare:     emptySteps(),
      closedHat: emptySteps(),
      openHat:   emptySteps(),
      clap:      emptySteps(),
      rim:       steps16([0, 4, 8, 12], 85, [0, 8]),
    },
    basslineStyle:  'sustained',
    melodyDensity:  'medium',
    preferredMode:  'harmonic-minor',
    chordOctave:    4,
    bassOctave:     2,
    velocityAccent: [1.2, 0.7, 0.8, 0.7, 1.0, 0.7, 0.8, 0.7, 1.1, 0.7, 0.8, 0.7, 1.0, 0.7, 0.8, 0.7],
  },

  edm: {
    name:          'edm',
    label:         'EDM',
    bpmRange:      [125, 140],
    swing:         0,
    drumPattern: {
      kick:      steps16([0, 4, 8, 12], 120, [0]),
      snare:     steps16([4, 12], 105, [4, 12]),
      closedHat: steps16([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], 80, [0, 4, 8, 12]),
      openHat:   steps16([2, 10], 95),
      clap:      steps16([4, 12], 110, [4, 12]),
      rim:       emptySteps(),
    },
    basslineStyle:  'offbeat',
    melodyDensity:  'dense',
    preferredMode:  'minor',
    chordOctave:    4,
    bassOctave:     2,
    velocityAccent: [1.3, 0.7, 0.9, 0.7, 1.2, 0.7, 0.9, 0.7, 1.2, 0.7, 0.9, 0.7, 1.2, 0.7, 0.9, 0.7],
  },
}

export const STYLE_NAMES: Record<StyleName, string> = {
  techno:      'Techno',
  house:       'House',
  trap:        'Trap',
  orchestral:  'Orchestral',
  ambient:     'Ambient',
  cinematic:   'Cinematic',
  edm:         'EDM',
}
