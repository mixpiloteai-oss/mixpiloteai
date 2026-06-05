// ─── AnalysisTypes.ts ─────────────────────────────────────────────────────────
// Shared types for the deep analysis layer.

// ── Track Types ───────────────────────────────────────────────────────────────

export type TrackType = 'drum' | 'bass' | 'lead' | 'pad' | 'chord' | 'fx' | 'vocal' | 'unknown'

export interface AnalysisNote {
  pitch: number        // 0-127
  startBeat: number
  duration: number
  velocity: number     // 0-127
}

export interface AnalysisClip {
  id: string
  startBeat: number
  notes: AnalysisNote[]
}

export interface AnalysisTrack {
  id: string
  name: string
  type: TrackType
  clips: AnalysisClip[]
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Classify track type from name using keyword rules.
 */
export function classifyTrackType(name: string): TrackType {
  const n = name.toLowerCase()
  if (/kick|bd|bass.?drum|snare|hat|drum|perc|clap|cymbal|tom/.test(n)) return 'drum'
  if (/bass|sub|808/.test(n)) return 'bass'
  if (/lead|synth|main|solo/.test(n)) return 'lead'
  if (/pad|string|atmo|ambient|choir|layer/.test(n)) return 'pad'
  if (/chord|harm|piano|keys|organ/.test(n)) return 'chord'
  if (/fx|effect|impact|riser|swoosh|noise/.test(n)) return 'fx'
  if (/vocal|vox|voice|sing/.test(n)) return 'vocal'
  return 'unknown'
}

// ── Shared Note Position ──────────────────────────────────────────────────────

export interface NotePosition {
  beat: number
  pitch?: number
  velocity: number
}

// ── Arrangement Types ─────────────────────────────────────────────────────────

export type SectionLabel =
  | 'intro' | 'verse' | 'buildup' | 'drop' | 'breakdown' | 'bridge' | 'outro' | 'silence'

export interface SectionRegion {
  label: SectionLabel
  startBar: number
  endBar: number
  energy: number      // 0-1
  clipDensity: number
}

// ── Groove Types ──────────────────────────────────────────────────────────────

export type GrooveTemplate = 'straight' | 'swing' | 'shuffled' | 'humanized' | 'laid-back' | 'pushed'

// ── Style ─────────────────────────────────────────────────────────────────────

export type MusicStyle =
  | 'house' | 'techno' | 'dnb' | 'trap' | 'hiphop'
  | 'ambient' | 'jazz' | 'latin' | 'tribal' | 'experimental' | 'unknown'

// ── Mix Types ─────────────────────────────────────────────────────────────────

export interface FrequencyBand {
  sub: number   // 0-36 MIDI pitch range
  low: number   // 36-60
  mid: number   // 60-84
  high: number  // 84-127
}
