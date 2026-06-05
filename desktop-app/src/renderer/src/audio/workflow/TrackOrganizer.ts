// ─── TrackOrganizer ───────────────────────────────────────────────────────────
// Proposes track organization changes. Never mutates state. Returns suggestion objects only.

import type { Project, Track } from '../../types/project'

export interface TrackColorSuggestion {
  trackId:        string
  trackName:      string
  currentColor:   string
  suggestedColor: string
  reason:         string
}

export interface TrackNameSuggestion {
  trackId:       string
  currentName:   string
  suggestedName: string
  reason:        string
}

export interface GroupSuggestion {
  trackIds:  string[]
  groupName: string
  reason:    string
}

export interface OrganizationSuggestions {
  colors: TrackColorSuggestion[]
  names:  TrackNameSuggestion[]
  groups: GroupSuggestion[]
}

interface ColorRule {
  pattern: RegExp
  color:   string
  label:   string
}

const COLOR_RULES: ColorRule[] = [
  { pattern: /kick|drum|perc|snare|hat/i, color: '#f97316', label: 'percussion' },
  { pattern: /bass|sub|low/i,              color: '#7c3aed', label: 'bass' },
  { pattern: /lead|mel|solo|synth/i,       color: '#10b981', label: 'lead/melody' },
  { pattern: /pad|chord|harm|string/i,     color: '#3b82f6', label: 'pad/chords' },
  { pattern: /vox|vocal|voice|sing/i,      color: '#ec4899', label: 'vocals' },
  { pattern: /fx|effect|riser|sweep|reverb/i, color: '#eab308', label: 'FX' },
  { pattern: /master|bus|mix/i,            color: '#6b7280', label: 'bus/master' },
]

const GENERIC_NAME_RE = /^Track(\s+\d+)?$/i

export function suggestColors(tracks: Track[]): TrackColorSuggestion[] {
  const suggestions: TrackColorSuggestion[] = []

  for (const track of tracks) {
    for (const rule of COLOR_RULES) {
      if (rule.pattern.test(track.name)) {
        if (track.color !== rule.color) {
          suggestions.push({
            trackId:        track.id,
            trackName:      track.name,
            currentColor:   track.color,
            suggestedColor: rule.color,
            reason:         `Track name suggests ${rule.label} role`,
          })
        }
        break // only apply first matching rule
      }
    }
  }

  return suggestions
}

export function suggestNames(tracks: Track[]): TrackNameSuggestion[] {
  const suggestions: TrackNameSuggestion[] = []

  const typeCounts: Record<string, number> = {}

  for (const track of tracks) {
    if (GENERIC_NAME_RE.test(track.name)) {
      const idx = (typeCounts[track.type] ?? 0) + 1
      typeCounts[track.type] = idx

      let suggestedName: string
      if (track.type === 'midi') {
        suggestedName = `MIDI ${idx}`
      } else if (track.type === 'audio') {
        suggestedName = `Audio ${idx}`
      } else if (track.type === 'bus') {
        suggestedName = `Bus ${idx}`
      } else {
        suggestedName = `Master ${idx}`
      }

      suggestions.push({
        trackId:       track.id,
        currentName:   track.name,
        suggestedName,
        reason:        'Generic track name — suggest a descriptive name',
      })
    }
  }

  return suggestions
}

export function suggestGroups(tracks: Track[]): GroupSuggestion[] {
  const suggestions: GroupSuggestion[] = []

  const drumTracks = tracks.filter(t => /kick|snare|hat|drum|perc/i.test(t.name))
  if (drumTracks.length >= 2) {
    suggestions.push({
      trackIds:  drumTracks.map(t => t.id),
      groupName: 'DRUMS',
      reason:    `${drumTracks.length} percussion tracks detected`,
    })
  }

  const bassTracks = tracks.filter(t => /bass|sub|low/i.test(t.name))
  if (bassTracks.length >= 2) {
    suggestions.push({
      trackIds:  bassTracks.map(t => t.id),
      groupName: 'BASS',
      reason:    `${bassTracks.length} bass tracks detected`,
    })
  }

  const melodyTracks = tracks.filter(t => /lead|mel|solo|synth/i.test(t.name))
  if (melodyTracks.length >= 2) {
    suggestions.push({
      trackIds:  melodyTracks.map(t => t.id),
      groupName: 'MELODY',
      reason:    `${melodyTracks.length} melody/lead tracks detected`,
    })
  }

  return suggestions
}

export function analyzeOrganization(project: Project): OrganizationSuggestions {
  return {
    colors: suggestColors(project.tracks),
    names:  suggestNames(project.tracks),
    groups: suggestGroups(project.tracks),
  }
}
