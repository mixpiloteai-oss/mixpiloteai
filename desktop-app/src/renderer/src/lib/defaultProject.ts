// ─── Default Project Templates ───────────────────────────────────────────────
// Factory functions for built-in project templates.
// All data uses real MidiNote pitches / velocities — no placeholders.

import type { Project, Track, Clip, MidiNote } from '../types/project'

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = Date.now()
const uid = () => `gen-${(_idCounter++).toString(36)}`

function mkNote(pitch: number, startBeat: number, lengthBeats: number, velocity: number): MidiNote {
  return { id: uid(), pitch, startBeat, lengthBeats, velocity }
}

function mkClip(
  trackId: string,
  name: string,
  startBar: number,
  lengthBars: number,
  color: string,
  notes: MidiNote[] = [],
): Clip {
  return {
    id:         uid(),
    trackId,
    name,
    startBar,
    lengthBars,
    color,
    muted:      false,
    notes,
  }
}

function mkTrack(
  name: string,
  type: Track['type'],
  color: string,
  gainDb: number,
  panCenter: number,
  clips: Clip[],
): Track {
  return {
    id:        uid(),
    name,
    type,
    color,
    gainDb,
    panCenter,
    muted:     false,
    soloed:    false,
    armed:     false,
    sends:     [],
    height:    64,
    clips,
  }
}

// ─── Pattern builders ─────────────────────────────────────────────────────────

// 4/4 kick-snare-hihat pattern (2-bar loop), using GM drum pitches:
// kick=36, snare=38, closed-hat=42, open-hat=46
function drumPattern2bar(trackId: string, startBar: number, color: string): Clip {
  const notes: MidiNote[] = [
    // bar 1
    mkNote(36, 0.0, 0.25, 100), // kick beat 1
    mkNote(42, 0.0, 0.25,  70), // hihat beat 1
    mkNote(42, 0.5, 0.25,  55), // hihat +½
    mkNote(38, 1.0, 0.25,  90), // snare beat 2
    mkNote(42, 1.0, 0.25,  70), // hihat
    mkNote(42, 1.5, 0.25,  55), // hihat +½
    mkNote(36, 2.0, 0.25,  95), // kick beat 3
    mkNote(42, 2.0, 0.25,  70),
    mkNote(36, 2.5, 0.25,  80), // kick + (trap double)
    mkNote(42, 2.5, 0.25,  55),
    mkNote(38, 3.0, 0.25,  90), // snare beat 4
    mkNote(42, 3.0, 0.25,  70),
    mkNote(42, 3.5, 0.25,  55),
    // bar 2
    mkNote(36, 4.0, 0.25, 100),
    mkNote(42, 4.0, 0.25,  70),
    mkNote(42, 4.5, 0.25,  55),
    mkNote(38, 5.0, 0.25,  90),
    mkNote(42, 5.0, 0.25,  70),
    mkNote(42, 5.5, 0.25,  55),
    mkNote(36, 6.0, 0.25,  95),
    mkNote(42, 6.0, 0.25,  70),
    mkNote(36, 6.75,0.25,  75),
    mkNote(38, 7.0, 0.25,  90),
    mkNote(42, 7.0, 0.25,  70),
    mkNote(46, 7.5, 0.25,  65), // open hat fill
  ]
  return mkClip(trackId, 'Drums', startBar, 2, color, notes)
}

// Simple root-note bassline (C2=48) — 4 bars
function bassPattern4bar(trackId: string, startBar: number, rootPitch: number, color: string): Clip {
  const notes: MidiNote[] = [
    mkNote(rootPitch,     0.0, 0.75, 100),
    mkNote(rootPitch,     1.0, 0.5,   85),
    mkNote(rootPitch + 3, 2.0, 0.5,   80),
    mkNote(rootPitch,     3.0, 0.75,  90),
    mkNote(rootPitch + 5, 4.0, 0.5,   85),
    mkNote(rootPitch,     5.0, 0.5,   80),
    mkNote(rootPitch + 3, 6.0, 0.5,   80),
    mkNote(rootPitch,     7.0, 1.0,   90),
    mkNote(rootPitch,     8.0, 0.75, 100),
    mkNote(rootPitch + 7, 9.0, 0.5,   85),
    mkNote(rootPitch,    10.0, 0.5,   80),
    mkNote(rootPitch + 5,11.0, 0.5,   80),
    mkNote(rootPitch,    12.0, 0.75,  90),
    mkNote(rootPitch + 3,13.0, 0.5,   80),
    mkNote(rootPitch,    14.0, 0.5,   80),
    mkNote(rootPitch,    15.0, 1.0,   95),
  ]
  return mkClip(trackId, 'Bass', startBar, 4, color, notes)
}

// Simple C major chord stabs — 4 bars
function synthPattern4bar(trackId: string, startBar: number, color: string): Clip {
  // C4=60, E4=64, G4=67, A4=69, F4=65
  const stabs: Array<[number, number, number, number]> = [
    // [beat, pitch, length, vel]
    [0.0, 60, 0.5, 80], [0.0, 64, 0.5, 75], [0.0, 67, 0.5, 78], // Cmaj
    [2.0, 60, 0.5, 75], [2.0, 64, 0.5, 70], [2.0, 67, 0.5, 72],
    [4.0, 57, 0.5, 80], [4.0, 60, 0.5, 75], [4.0, 64, 0.5, 78], // Am
    [6.0, 57, 0.5, 75], [6.0, 60, 0.5, 70], [6.0, 64, 0.5, 72],
    [8.0, 65, 0.5, 80], [8.0, 69, 0.5, 75], [8.0, 72, 0.5, 78], // F
    [10.0,65, 0.5, 75], [10.0,69, 0.5, 70], [10.0,72, 0.5, 72],
    [12.0,62, 0.5, 80], [12.0,65, 0.5, 75], [12.0,69, 0.5, 78], // Dm
    [14.0,62, 0.5, 75], [14.0,65, 0.5, 70], [14.0,69, 0.5, 72],
  ]
  const notes = stabs.map(([beat, pitch, len, vel]) => mkNote(pitch, beat, len, vel))
  return mkClip(trackId, 'Synth', startBar, 4, color, notes)
}

// Lo-fi drum pattern — slower, more swing feel
function lofiDrums2bar(trackId: string, startBar: number, color: string): Clip {
  const notes: MidiNote[] = [
    mkNote(36, 0.0, 0.25, 90),
    mkNote(42, 0.0, 0.25, 60),
    mkNote(42, 0.75,0.25, 50), // swung 16th
    mkNote(38, 2.0, 0.25, 80),
    mkNote(42, 2.0, 0.25, 60),
    mkNote(42, 2.75,0.25, 50),
    mkNote(36, 4.0, 0.25, 85),
    mkNote(42, 4.0, 0.25, 58),
    mkNote(42, 4.75,0.25, 48),
    mkNote(38, 6.0, 0.25, 78),
    mkNote(42, 6.0, 0.25, 60),
    mkNote(46, 7.0, 0.25, 55),
  ]
  return mkClip(trackId, 'Drums', startBar, 2, color, notes)
}

// ─── Template: Default New Project ───────────────────────────────────────────

export function buildDefaultProject(): Project {
  const drums  = mkTrack('Drums',  'midi',   '#e74c3c',  0,    0,    [])
  const bass   = mkTrack('Bass',   'midi',   '#3498db', -2,    0,    [])
  const synth  = mkTrack('Synth',  'midi',   '#2ecc71', -4,    0.1,  [])
  const audio  = mkTrack('Audio',  'audio',  '#f39c12', -6,    0,    [])
  const master = mkTrack('Master', 'master', '#9b59b6',  0,    0,    [])

  // 4 drum clips × 2 bars each = bars 1–8
  drums.clips = [
    drumPattern2bar(drums.id, 1, drums.color),
    drumPattern2bar(drums.id, 3, drums.color),
    drumPattern2bar(drums.id, 5, drums.color),
    drumPattern2bar(drums.id, 7, drums.color),
  ]

  // 2 bass clips × 4 bars each = bars 1–8
  bass.clips = [
    bassPattern4bar(bass.id, 1, 48, bass.color), // C2
    bassPattern4bar(bass.id, 5, 48, bass.color),
  ]

  // 2 synth clips × 4 bars each = bars 1–8
  synth.clips = [
    synthPattern4bar(synth.id, 1, synth.color),
    synthPattern4bar(synth.id, 5, synth.color),
  ]

  // 1 empty audio clip — placeholder for user to drop a file
  audio.clips = [
    mkClip(audio.id, 'Drop audio here', 1, 8, audio.color, []),
  ]

  return {
    id:                        uid(),
    name:                      'New Project',
    bpm:                       128,
    timeSignatureNumerator:    4,
    timeSignatureDenominator:  4,
    sampleRate:                44100,
    masterGainDb:              0,
    loopStart:                 1,
    loopEnd:                   9,
    totalBars:                 32,
    tracks:                    [drums, bass, synth, audio, master],
  }
}

// ─── Template: Trap Beat ─────────────────────────────────────────────────────

export function buildTrapBeatProject(): Project {
  const drums    = mkTrack('Drums',    'midi',  '#e74c3c',  0,    0,   [])
  const bass808  = mkTrack('808 Bass', 'midi',  '#e67e22', -2,    0,   [])
  const melody   = mkTrack('Melody',   'midi',  '#9b59b6', -5,    0.2, [])
  const chords   = mkTrack('Chords',   'midi',  '#1abc9c', -8,    0,   [])
  const fx       = mkTrack('FX',       'audio', '#e91e63',-12,    0,   [])

  drums.clips = [
    drumPattern2bar(drums.id, 1, drums.color),
    drumPattern2bar(drums.id, 3, drums.color),
    drumPattern2bar(drums.id, 5, drums.color),
    drumPattern2bar(drums.id, 7, drums.color),
    drumPattern2bar(drums.id, 9, drums.color),
    drumPattern2bar(drums.id,11, drums.color),
    drumPattern2bar(drums.id,13, drums.color),
    drumPattern2bar(drums.id,15, drums.color),
  ]

  bass808.clips = [
    bassPattern4bar(bass808.id, 1,  36, bass808.color), // C1 — 808 range
    bassPattern4bar(bass808.id, 5,  36, bass808.color),
    bassPattern4bar(bass808.id, 9,  36, bass808.color),
    bassPattern4bar(bass808.id, 13, 36, bass808.color),
  ]

  melody.clips = [
    synthPattern4bar(melody.id, 3, melody.color),
    synthPattern4bar(melody.id, 9, melody.color),
  ]

  chords.clips = [
    synthPattern4bar(chords.id, 1, chords.color),
    synthPattern4bar(chords.id, 5, chords.color),
    synthPattern4bar(chords.id, 9, chords.color),
    synthPattern4bar(chords.id, 13, chords.color),
  ]

  fx.clips = [
    mkClip(fx.id, 'Riser FX',  7, 1, fx.color),
    mkClip(fx.id, 'Impact',    9, 1, fx.color),
    mkClip(fx.id, 'Riser FX', 15, 1, fx.color),
  ]

  return {
    id:                       uid(),
    name:                     'Trap Beat',
    bpm:                      140,
    timeSignatureNumerator:   4,
    timeSignatureDenominator: 4,
    sampleRate:               44100,
    masterGainDb:             0,
    loopStart:                1,
    loopEnd:                  17,
    totalBars:                32,
    tracks:                   [drums, bass808, melody, chords, fx],
  }
}

// ─── Template: Lo-Fi Session ─────────────────────────────────────────────────

export function buildLoFiProject(): Project {
  const drums  = mkTrack('Lo-Fi Drums', 'midi',  '#795548',  0,   0,   [])
  const bass   = mkTrack('Bass',        'midi',  '#3f51b5', -3,   0,   [])
  const piano  = mkTrack('Piano',       'midi',  '#607d8b', -5,  -0.1, [])
  const guitar = mkTrack('Guitar',      'audio', '#8bc34a', -7,   0.2, [])
  const vinyl  = mkTrack('Vinyl / Tape','audio', '#ff9800', -14,  0,   [])

  drums.clips = [
    lofiDrums2bar(drums.id, 1, drums.color),
    lofiDrums2bar(drums.id, 3, drums.color),
    lofiDrums2bar(drums.id, 5, drums.color),
    lofiDrums2bar(drums.id, 7, drums.color),
  ]

  bass.clips = [
    bassPattern4bar(bass.id, 1, 43, bass.color), // G2 — lo-fi key
    bassPattern4bar(bass.id, 5, 43, bass.color),
  ]

  piano.clips = [
    synthPattern4bar(piano.id, 1, piano.color),
    synthPattern4bar(piano.id, 5, piano.color),
  ]

  guitar.clips = [
    mkClip(guitar.id, 'Guitar Loop', 1, 4, guitar.color),
    mkClip(guitar.id, 'Guitar Loop', 5, 4, guitar.color),
  ]

  vinyl.clips = [
    mkClip(vinyl.id, 'Vinyl Noise', 1, 8, vinyl.color),
  ]

  return {
    id:                       uid(),
    name:                     'Lo-Fi Session',
    bpm:                      85,
    timeSignatureNumerator:   4,
    timeSignatureDenominator: 4,
    sampleRate:               44100,
    masterGainDb:             0,
    loopStart:                1,
    loopEnd:                  9,
    totalBars:                16,
    tracks:                   [drums, bass, piano, guitar, vinyl],
  }
}

// ─── Template: Podcast ───────────────────────────────────────────────────────

export function buildPodcastProject(): Project {
  const voice1  = mkTrack('Host Voice',   'audio', '#2196f3',  0,  -0.1, [])
  const voice2  = mkTrack('Guest Voice',  'audio', '#4caf50',  0,   0.1, [])
  const musicBed= mkTrack('Music Bed',    'audio', '#ff5722', -20,  0,   [])
  const sfx     = mkTrack('SFX / Jingles','audio', '#9c27b0', -12,  0,   [])
  const master  = mkTrack('Master',       'master','#607d8b',  0,   0,   [])

  voice1.clips = [
    mkClip(voice1.id,  'Intro',   1, 4, voice1.color),
    mkClip(voice1.id,  'Main Q1', 5, 8, voice1.color),
    mkClip(voice1.id,  'Main Q2',13, 8, voice1.color),
  ]

  voice2.clips = [
    mkClip(voice2.id,  'Intro',    3, 2,  voice2.color),
    mkClip(voice2.id,  'Answer 1', 7, 6,  voice2.color),
    mkClip(voice2.id,  'Answer 2',15, 6,  voice2.color),
  ]

  musicBed.clips = [
    mkClip(musicBed.id, 'Intro Music',  1, 4,  musicBed.color),
    mkClip(musicBed.id, 'Outro Music', 20, 4,  musicBed.color),
  ]

  sfx.clips = [
    mkClip(sfx.id, 'Transition', 4, 1, sfx.color),
    mkClip(sfx.id, 'Transition',12, 1, sfx.color),
    mkClip(sfx.id, 'Stinger',    1, 1, sfx.color),
  ]

  return {
    id:                       uid(),
    name:                     'Podcast',
    bpm:                      120,
    timeSignatureNumerator:   4,
    timeSignatureDenominator: 4,
    sampleRate:               44100,
    masterGainDb:             0,
    loopStart:                1,
    loopEnd:                  25,
    totalBars:                32,
    tracks:                   [voice1, voice2, musicBed, sfx, master],
  }
}
