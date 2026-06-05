// ─── PatternGenerator ─────────────────────────────────────────────────────────
// Deterministic, musically correct MIDI pattern generators.
// NO Math.random() — all patterns are fully deterministic.

import type { StyleTag } from './CommandParser'

export interface GeneratedNote {
  pitch:       number
  startBeat:   number
  lengthBeats: number
  velocity:    number
}

export interface GeneratedPattern {
  name:  string
  notes: GeneratedNote[]
  bars:  number
}

// Standard MIDI drum pitches
const PITCH_KICK_BASS_DRUM = 36
const PITCH_SNARE          = 38
const PITCH_HIHAT_CLOSED   = 42
const PITCH_HIHAT_OPEN     = 46

// ─── Hardtek / Mentalcore presets ─────────────────────────────────────────────

/**
 * Generate a hardtek kick pattern.
 * 4-on-the-floor at 160+ BPM with velocity accent on beat 1.
 */
export function generateHardtekKick(bars: number): GeneratedPattern {
  const notes: GeneratedNote[] = []
  const beatsPerBar = 4

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar
    for (let b = 0; b < beatsPerBar; b++) {
      // Beat 1 (b=0) of every bar gets a harder accent
      const velocity = b === 0 ? 127 : 110
      notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + b, lengthBeats: 0.5, velocity })
    }
    // Extra syncopated kick at beat 3.75 on even bars for hardtek groove
    if (bar % 2 === 0) {
      notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + 3.75, lengthBeats: 0.25, velocity: 95 })
    }
  }

  return { name: 'Hardtek Kick', notes, bars }
}

/**
 * Generate a hardtek distorted bass pattern.
 * Notes at MIDI 36-40, short lengths (0.125–0.25 beats), syncopated.
 */
export function generateHardtekBass(bars: number): GeneratedPattern {
  const notes: GeneratedNote[] = []
  const beatsPerBar = 4

  // Syncopated 16th-note pattern — same deterministic offsets each bar
  // Pitches alternate between 36 (C2) and 38 (D2) for distorted texture
  const pattern: Array<{ beat: number; pitch: number; length: number; velocity: number }> = [
    { beat: 0,    pitch: 36, length: 0.25, velocity: 127 },
    { beat: 0.25, pitch: 38, length: 0.125, velocity: 90 },
    { beat: 0.5,  pitch: 36, length: 0.25, velocity: 115 },
    { beat: 1.0,  pitch: 40, length: 0.125, velocity: 100 },
    { beat: 1.25, pitch: 36, length: 0.25, velocity: 120 },
    { beat: 1.75, pitch: 38, length: 0.125, velocity: 85 },
    { beat: 2.0,  pitch: 36, length: 0.25, velocity: 127 },
    { beat: 2.5,  pitch: 40, length: 0.125, velocity: 95 },
    { beat: 2.75, pitch: 36, length: 0.125, velocity: 110 },
    { beat: 3.0,  pitch: 38, length: 0.25, velocity: 120 },
    { beat: 3.5,  pitch: 36, length: 0.125, velocity: 100 },
    { beat: 3.75, pitch: 40, length: 0.125, velocity: 90 },
  ]

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar
    for (const step of pattern) {
      notes.push({
        pitch:       step.pitch,
        startBeat:   offset + step.beat,
        lengthBeats: step.length,
        velocity:    step.velocity,
      })
    }
  }

  return { name: 'Hardtek Bass', notes, bars }
}

/**
 * Generate a hardtek hi-hat pattern.
 * 16th-note pattern with deterministic velocity humanization.
 */
export function generateHardtekHihat(bars: number): GeneratedPattern {
  const notes: GeneratedNote[] = []
  const beatsPerBar    = 4
  const sixteenthsPerBar = 16
  // Velocity pattern for 16 steps: accents on every 4th, softer offbeats
  const velocityTemplate = [85, 55, 70, 55, 80, 55, 65, 55, 85, 55, 70, 55, 75, 55, 68, 50]

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar
    for (let step = 0; step < sixteenthsPerBar; step++) {
      const beat     = offset + step * (beatsPerBar / sixteenthsPerBar)
      // Deterministic velocity humanization using sine offset
      const baseVel  = velocityTemplate[step]
      const humanize = Math.round(Math.sin(bar * 7 + step * 2.39996) * 5)
      const velocity = Math.max(40, Math.min(127, baseVel + humanize))
      notes.push({ pitch: PITCH_HIHAT_CLOSED, startBeat: beat, lengthBeats: 0.125, velocity })
    }
    // Open hat on the "and" of beat 4 (step 14 = beat 3.5) in every bar
    notes.push({ pitch: PITCH_HIHAT_OPEN, startBeat: offset + 3.5, lengthBeats: 0.25, velocity: 75 })
  }

  return { name: 'Hardtek Hihat', notes, bars }
}

/**
 * Generate a full hardtek drum pattern combining kick, bass, and hihat.
 * All notes merged into one pattern for single-track insertion.
 */
export function generateHardtekFull(bars: number): GeneratedPattern {
  const kick  = generateHardtekKick(bars)
  const bass  = generateHardtekBass(bars)
  const hihat = generateHardtekHihat(bars)

  const notes: GeneratedNote[] = [
    ...kick.notes,
    ...bass.notes,
    ...hihat.notes,
  ]

  return { name: 'Hardtek Full', notes, bars }
}

/**
 * Generate a kick drum pattern.
 * startBeat is 0-based within the full pattern.
 */
export function generateKickPattern(style: StyleTag, bars: number): GeneratedPattern {
  const notes: GeneratedNote[] = []
  const beatsPerBar = 4

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar

    if (style === 'tribe') {
      // 4-on-the-floor (beats 0,1,2,3) + syncopated on beat 2.75 in bars 2+4 (0-indexed: 1, 3)
      const downbeats = [0, 1, 2, 3]
      for (const b of downbeats) {
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + b, lengthBeats: 0.5, velocity: 127 })
      }
      if (bar % 2 === 1) {
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + 2.75, lengthBeats: 0.25, velocity: 90 })
      }
    } else if (style === 'techno') {
      // 4-on-the-floor, every beat, velocity 110 (steady, industrial)
      for (let b = 0; b < beatsPerBar; b++) {
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + b, lengthBeats: 0.5, velocity: 110 })
      }
    } else if (style === 'house') {
      // beats 0,1,2,3 + ghost kick at 0.5 in bars 0+2 (0-indexed: 0, 2)
      const velocities = [127, 100, 120, 95]
      for (let b = 0; b < beatsPerBar; b++) {
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + b, lengthBeats: 0.5, velocity: velocities[b] })
      }
      if (bar % 2 === 0) {
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + 0.5, lengthBeats: 0.25, velocity: 80 })
      }
    } else {
      // default: 4-on-the-floor, velocity 110
      for (let b = 0; b < beatsPerBar; b++) {
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + b, lengthBeats: 0.5, velocity: 110 })
      }
    }
  }

  return { name: `Kick (${style})`, notes, bars }
}

/**
 * Generate a bass pattern.
 * All pitches centered around C2 = MIDI 36.
 */
export function generateBassPattern(style: StyleTag, bars: number): GeneratedPattern {
  const notes: GeneratedNote[] = []
  const beatsPerBar = 4

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar

    if (style === 'aggressive') {
      // Short 16th-note runs, high velocity
      const beats = [0, 0.25, 0.75, 1.0, 1.5, 2.0, 2.25, 3.0]
      beats.forEach((b, i) => {
        const velocity = i % 2 === 0 ? 127 : 115
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + b, lengthBeats: 0.25, velocity })
      })
    } else if (style === 'tribe') {
      // Long-short pattern, velocities alternating
      const beats   = [0, 1.0, 2.0, 2.5, 3.0]
      const lengths = [1.0, 1.0, 0.5, 0.5, 1.0]
      beats.forEach((b, i) => {
        const velocity = i % 2 === 0 ? 100 : 80
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + b, lengthBeats: lengths[i], velocity })
      })
    } else {
      // default: root note on beats 0 and 2
      notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + 0, lengthBeats: 1.0, velocity: 95 })
      notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + 2, lengthBeats: 1.0, velocity: 95 })
    }
  }

  return { name: `Bass (${style})`, notes, bars }
}

/**
 * Generate a hi-hat pattern.
 */
export function generateHihatPattern(style: StyleTag, bars: number): GeneratedPattern {
  const notes: GeneratedNote[] = []
  const beatsPerBar  = 4
  const eighthsPerBar = 8

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar

    if (style === 'groovy') {
      // 8th notes with velocity swing + occasional 16th fills
      for (let i = 0; i < eighthsPerBar; i++) {
        const beat     = offset + i * 0.5
        const velocity = i % 2 === 0 ? 85 : 65  // swing: even louder, odd softer
        notes.push({ pitch: PITCH_HIHAT_CLOSED, startBeat: beat, lengthBeats: 0.25, velocity })
        // 16th fill on last 8th of bar
        if (i === eighthsPerBar - 1) {
          notes.push({ pitch: PITCH_HIHAT_CLOSED, startBeat: beat + 0.25, lengthBeats: 0.125, velocity: 55 })
        }
      }
    } else if (style === 'straight') {
      // Straight 8th notes, uniform velocity
      for (let i = 0; i < eighthsPerBar; i++) {
        notes.push({ pitch: PITCH_HIHAT_CLOSED, startBeat: offset + i * 0.5, lengthBeats: 0.25, velocity: 80 })
      }
    } else {
      // default: 8th notes, velocity 75
      for (let i = 0; i < eighthsPerBar; i++) {
        notes.push({ pitch: PITCH_HIHAT_CLOSED, startBeat: offset + i * 0.5, lengthBeats: 0.25, velocity: 75 })
      }
    }
  }

  return { name: `Hihat (${style})`, notes, bars }
}

/**
 * Generate a buildup pattern.
 * Rising hihat density, rising pitch, crescendo velocity.
 */
export function generateBuildup(bars: number): GeneratedPattern {
  const notes: GeneratedNote[] = []
  const beatsPerBar = 4

  for (let bar = 0; bar < bars; bar++) {
    const barProgress = bar / Math.max(1, bars - 1)  // 0 to 1

    // Density increases from 8th notes in bar 0 to 16th notes and denser later
    // Subdivision: 2 = 8th notes, 4 = 16th, 8 = 32nd
    const subdivisions = Math.max(2, Math.round(2 + barProgress * 6))
    const stepSize     = beatsPerBar / subdivisions

    for (let step = 0; step < subdivisions; step++) {
      const beat         = bar * beatsPerBar + step * stepSize
      const noteProgress = (bar * subdivisions + step) / (bars * subdivisions)

      // Velocity crescendo from 60 to 127
      const velocity = Math.round(60 + noteProgress * 67)

      // Pitch rises from closed hat (42) to open hat (46)
      const pitch = noteProgress < 0.7 ? PITCH_HIHAT_CLOSED : PITCH_HIHAT_OPEN

      notes.push({
        pitch,
        startBeat:   beat,
        lengthBeats: stepSize * 0.8,
        velocity:    Math.min(127, velocity),
      })
    }
  }

  return { name: 'Buildup', notes, bars }
}

/**
 * Generate a drop pattern.
 * Bar 1: silence except kick on beat 0. Bars 2+: kick on every beat.
 */
export function generateDrop(bars: number): GeneratedPattern {
  const notes: GeneratedNote[] = []
  const beatsPerBar = 4

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar

    if (bar === 0) {
      // Bar 1: single kick on beat 0, silence after
      notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset, lengthBeats: 0.5, velocity: 127 })
    } else {
      // Bars 2+: kick on every beat
      for (let b = 0; b < beatsPerBar; b++) {
        notes.push({ pitch: PITCH_KICK_BASS_DRUM, startBeat: offset + b, lengthBeats: 0.5, velocity: 127 })
      }
      // Add snare on beats 1 and 3 (2nd and 4th)
      notes.push({ pitch: PITCH_SNARE, startBeat: offset + 1, lengthBeats: 0.5, velocity: 110 })
      notes.push({ pitch: PITCH_SNARE, startBeat: offset + 3, lengthBeats: 0.5, velocity: 110 })
    }
  }

  return { name: 'Drop', notes, bars }
}
