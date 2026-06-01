// ─── BasslineGenerator.ts ────────────────────────────────────────────────────
// Chord-progression-aware bassline generator.

import type { MusicalStyle } from './MusicAnalyzer'
import type { GeneratedNote, GeneratedPattern } from './PatternGenerator'
import type { ChordDef } from './MusicTheory'
import { getProgression, getChordNotes } from './MusicTheory'
import { SeededRng } from './SeededRng'
import { styleToProgressionStyle } from './MelodyGenerator'

export type BasslineStyle = 'root_only' | 'walking' | 'syncopated' | 'groove' | 'arpeggio'

export interface BasslineOptions {
  key:       { root: number; mode: 'major' | 'minor' }
  style:     MusicalStyle
  bassStyle: BasslineStyle
  bars:      number
  octave:    number   // typically 2 for bass (C2 = MIDI 36)
  seed:      number
}

function clampBass(pitch: number): number {
  return Math.max(24, Math.min(60, pitch))
}

function note(pitch: number, startBeat: number, velocity: number, length: number): GeneratedNote {
  return { pitch: clampBass(pitch), startBeat, velocity, lengthBeats: length }
}

/** Generate a bassline from BasslineOptions. */
export function generateBassline(opts: BasslineOptions): GeneratedPattern {
  const rng = new SeededRng(opts.seed)
  const totalBeats = opts.bars * 4
  const progressionStyle = styleToProgressionStyle(opts.style)
  const progression = getProgression(opts.key, progressionStyle, totalBeats)

  // Build a flat array of chords per bar
  function getChordAtBar(bar: number): ChordDef {
    const beat = bar * 4
    let elapsed = 0
    for (const chord of progression) {
      elapsed += chord.duration
      if (beat < elapsed) return chord
    }
    return progression[progression.length - 1]!
  }

  function getNextChordRoot(bar: number): number {
    const nextBar = bar + 1
    if (nextBar >= opts.bars) return getChordAtBar(bar).root
    return getChordAtBar(nextBar).root
  }

  const notes: GeneratedNote[] = []

  for (let bar = 0; bar < opts.bars; bar++) {
    const o = bar * 4
    const chord = getChordAtBar(bar)
    // Use (octave + 1) * 12 formula consistent with getChordNotes/getScaleNotes
    const chordRoot = chord.root + (opts.octave + 1) * 12
    const chordTones = getChordNotes(chord.root, chord.type, opts.octave)
    const chord5th = chordRoot + 7  // perfect fifth

    switch (opts.bassStyle) {
      case 'root_only':
        notes.push(note(chordRoot, o + 0, 100, 1.9))
        notes.push(note(chordRoot, o + 2, 90,  1.9))
        break

      case 'walking': {
        const nextRoot = getNextChordRoot(bar) + (opts.octave + 1) * 12
        const vel = 85 + rng.nextInt(0, 15)
        notes.push(note(chordRoot,      o + 0, vel, 0.9))
        notes.push(note(chord5th,       o + 1, vel, 0.9))
        notes.push(note(nextRoot - 2,   o + 2, vel, 0.9))
        notes.push(note(nextRoot - 1,   o + 3, vel, 0.9))
        break
      }

      case 'syncopated':
        notes.push(note(chordRoot, o + 0,    110, 0.5))
        notes.push(note(chordRoot, o + 0.75, 80,  0.25))
        notes.push(note(chord5th,  o + 2,    105, 0.5))
        notes.push(note(chordRoot, o + 2.75, 75,  0.25))
        break

      case 'groove': {
        const beats = [0, 0.5, 1.0, 2.0, 2.5, 3.0]
        for (let i = 0; i < beats.length; i++) {
          const p = i % 2 === 0 ? chordRoot : chord5th
          const v = i % 2 === 0 ? 95 : 75
          notes.push(note(p, o + beats[i]!, v, 0.45))
        }
        break
      }

      case 'arpeggio': {
        // arpeggiate chord tones (root, 3rd, 5th, octave) over bar in 8th notes
        const arpeggioTones = [
          chordTones[0] ?? chordRoot,
          chordTones[1] ?? (chordRoot + 4),
          chordTones[2] ?? (chordRoot + 7),
          chordRoot + 12,
        ]
        for (let i = 0; i < 8; i++) {
          const pitch = arpeggioTones[i % arpeggioTones.length]!
          notes.push(note(pitch, o + i * 0.5, 90, 0.45))
        }
        break
      }
    }
  }

  return { name: `Bassline (${opts.bassStyle})`, notes, bars: opts.bars }
}
