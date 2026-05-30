// Piano roll domain types — separate from the project MidiNote type so the
// editor can carry ephemeral state (selection, mute override) without polluting
// the project store.

export interface PRNote {
  id: string
  pitch: number        // 0–127 MIDI
  startBeat: number    // beats from clip start (float)
  lengthBeats: number  // duration in beats (float, > 0)
  velocity: number     // 1–127
  selected: boolean
  muted: boolean
  glide?:       boolean   // portamento to next note
  probability?: number    // 0–100, 100 = always plays
  channel?:     number    // MIDI channel 0–15
}

export type PRTool = 'pointer' | 'pencil' | 'erase' | 'velocity'

export type SnapGrid = 'off' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1/1'

export const SNAP_BEATS: Record<SnapGrid, number> = {
  'off':  0,
  '1/32': 0.125,
  '1/16': 0.25,
  '1/8':  0.5,
  '1/4':  1,
  '1/2':  2,
  '1/1':  4,
}

export const TOTAL_PITCHES = 128
export const NOTE_NAMES    = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export function pitchName(pitch: number): string {
  return `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`
}

export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12)
}

export function snapFloor(beat: number, grid: SnapGrid): number {
  const s = SNAP_BEATS[grid]
  return s === 0 ? beat : Math.floor(beat / s) * s
}

export function snapRound(beat: number, grid: SnapGrid): number {
  const s = SNAP_BEATS[grid]
  return s === 0 ? beat : Math.round(beat / s) * s
}

export function snapCeil(beat: number, grid: SnapGrid): number {
  const s = SNAP_BEATS[grid]
  return s === 0 ? beat : Math.ceil(beat / s) * s
}

export type AutomationParam = {
  id: string
  label: string
  min: number
  max: number
  defaultValue: number
  color: string
  visible: boolean
}

export const DEFAULT_AUTO_PARAMS: AutomationParam[] = [
  { id: 'volume',   label: 'Volume',       min: 0,    max: 127, defaultValue: 100, color: '#06b6d4', visible: false },
  { id: 'pan',      label: 'Pan',          min: -64,  max: 64,  defaultValue: 0,   color: '#a855f7', visible: false },
  { id: 'pitch',    label: 'Pitch Bend',   min: -8192, max: 8191, defaultValue: 0, color: '#f59e0b', visible: false },
  { id: 'filter',   label: 'Filter Cutoff',min: 0,    max: 127, defaultValue: 64,  color: '#10b981', visible: false },
  { id: 'resonance',label: 'Resonance',    min: 0,    max: 127, defaultValue: 0,   color: '#ec4899', visible: false },
]

// ─── Scale / Mode types (mirrored from musicTheory for use inside piano-roll) ─

export type ScaleMode =
  | 'major' | 'minor' | 'harmonic-minor' | 'melodic-minor'
  | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
  | 'pentatonic-major' | 'pentatonic-minor' | 'blues'

export type ScaleRoot = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

export const SCALE_ROOT_NAMES: ScaleRoot[] = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export const SCALE_MODE_NAMES: Record<ScaleMode, string> = {
  'major':            'Major',
  'minor':            'Natural Minor',
  'harmonic-minor':   'Harmonic Minor',
  'melodic-minor':    'Melodic Minor',
  'dorian':           'Dorian',
  'phrygian':         'Phrygian',
  'lydian':           'Lydian',
  'mixolydian':       'Mixolydian',
  'locrian':          'Locrian',
  'pentatonic-major': 'Pentatonic Major',
  'pentatonic-minor': 'Pentatonic Minor',
  'blues':            'Blues',
}
