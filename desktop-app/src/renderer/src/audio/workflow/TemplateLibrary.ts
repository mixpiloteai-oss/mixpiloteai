// ─── TemplateLibrary ─────────────────────────────────────────────────────────
// Smart project templates.

import type { MusicalStyle } from '../ai/MusicAnalyzer'
import type { Project } from '../../types/project'

export interface TemplateTrack {
  name:      string
  type:      'midi' | 'audio' | 'bus'
  color:     string
  gainDb:    number
  panCenter: number
}

export interface ProjectTemplate {
  id:                     string
  name:                   string
  style:                  MusicalStyle
  description:            string
  tracks:                 TemplateTrack[]
  bpm:                    number
  timeSignatureNumerator: number
}

export interface TemplateDiff {
  missingTracks: TemplateTrack[]
  extraTracks:   string[]
  bpmDiff:       number
}

const TEMPLATES: ProjectTemplate[] = [
  {
    id:          'techno-template',
    name:        'Techno',
    style:       'techno',
    description: 'Classic techno arrangement with kick, bass, leads, and FX.',
    bpm:         140,
    timeSignatureNumerator: 4,
    tracks: [
      { name: 'Kick',        type: 'midi',  color: '#f97316', gainDb: 0,   panCenter: 0    },
      { name: 'Snare',       type: 'midi',  color: '#f97316', gainDb: -3,  panCenter: 0    },
      { name: 'Hi-Hat',      type: 'midi',  color: '#f97316', gainDb: -6,  panCenter: 0.2  },
      { name: 'Bass',        type: 'midi',  color: '#7c3aed', gainDb: -2,  panCenter: 0    },
      { name: 'Lead Synth',  type: 'midi',  color: '#10b981', gainDb: -4,  panCenter: 0    },
      { name: 'Pad',         type: 'midi',  color: '#3b82f6', gainDb: -10, panCenter: 0    },
      { name: 'FX Riser',   type: 'audio', color: '#eab308', gainDb: -12, panCenter: 0    },
      { name: 'Drum Bus',    type: 'bus',   color: '#6b7280', gainDb: -2,  panCenter: 0    },
    ],
  },
  {
    id:          'house-template',
    name:        'House',
    style:       'house',
    description: 'Uplifting house with chord stabs, vocals, and deep bass.',
    bpm:         124,
    timeSignatureNumerator: 4,
    tracks: [
      { name: 'Kick',        type: 'midi',  color: '#f97316', gainDb: 0,   panCenter: 0    },
      { name: 'Hi-Hat',      type: 'midi',  color: '#f97316', gainDb: -6,  panCenter: 0.3  },
      { name: 'Clap',        type: 'midi',  color: '#f97316', gainDb: -4,  panCenter: 0    },
      { name: 'Bass',        type: 'midi',  color: '#7c3aed', gainDb: -2,  panCenter: 0    },
      { name: 'Chord Stabs', type: 'midi',  color: '#3b82f6', gainDb: -6,  panCenter: 0.1  },
      { name: 'Vocal Chops', type: 'audio', color: '#ec4899', gainDb: -4,  panCenter: 0    },
      { name: 'Lead',        type: 'midi',  color: '#10b981', gainDb: -5,  panCenter: -0.1 },
      { name: 'FX Sweep',   type: 'audio', color: '#eab308', gainDb: -12, panCenter: 0    },
      { name: 'Mix Bus',     type: 'bus',   color: '#6b7280', gainDb: -2,  panCenter: 0    },
    ],
  },
  {
    id:          'hiphop-template',
    name:        'Hip-Hop',
    style:       'hip-hop',
    description: 'Boom bap hip-hop with drums, 808 bass, and melody.',
    bpm:         90,
    timeSignatureNumerator: 4,
    tracks: [
      { name: 'Kick',        type: 'midi',  color: '#f97316', gainDb: 0,   panCenter: 0    },
      { name: 'Snare',       type: 'midi',  color: '#f97316', gainDb: -3,  panCenter: 0    },
      { name: 'Hi-Hat',      type: 'midi',  color: '#f97316', gainDb: -8,  panCenter: 0.2  },
      { name: 'Bass 808',    type: 'midi',  color: '#7c3aed', gainDb: -2,  panCenter: 0    },
      { name: 'Melody',      type: 'midi',  color: '#10b981', gainDb: -4,  panCenter: 0    },
      { name: 'Sample',      type: 'audio', color: '#3b82f6', gainDb: -6,  panCenter: 0    },
      { name: 'Vocal',       type: 'audio', color: '#ec4899', gainDb: -3,  panCenter: 0    },
      { name: 'Drum Bus',    type: 'bus',   color: '#6b7280', gainDb: -2,  panCenter: 0    },
    ],
  },
  {
    id:          'ambient-template',
    name:        'Ambient',
    style:       'ambient',
    description: 'Atmospheric ambient with layered pads, textures, and drones.',
    bpm:         75,
    timeSignatureNumerator: 4,
    tracks: [
      { name: 'Drone',       type: 'midi',  color: '#3b82f6', gainDb: -8,  panCenter: 0    },
      { name: 'Pad Layer 1', type: 'midi',  color: '#3b82f6', gainDb: -10, panCenter: -0.3 },
      { name: 'Pad Layer 2', type: 'midi',  color: '#3b82f6', gainDb: -10, panCenter: 0.3  },
      { name: 'Melody',      type: 'midi',  color: '#10b981', gainDb: -6,  panCenter: 0    },
      { name: 'Texture',     type: 'audio', color: '#eab308', gainDb: -14, panCenter: 0    },
      { name: 'Reverb FX',  type: 'audio', color: '#eab308', gainDb: -16, panCenter: 0    },
      { name: 'Perc',        type: 'midi',  color: '#f97316', gainDb: -12, panCenter: 0.1  },
      { name: 'Mix Bus',     type: 'bus',   color: '#6b7280', gainDb: -3,  panCenter: 0    },
    ],
  },
  {
    id:          'pop-template',
    name:        'Pop',
    style:       'pop',
    description: 'Modern pop production with live-feel drums, synths, and vocals.',
    bpm:         110,
    timeSignatureNumerator: 4,
    tracks: [
      { name: 'Kick',        type: 'midi',  color: '#f97316', gainDb: 0,   panCenter: 0    },
      { name: 'Snare',       type: 'midi',  color: '#f97316', gainDb: -3,  panCenter: 0    },
      { name: 'Hi-Hat',      type: 'midi',  color: '#f97316', gainDb: -7,  panCenter: 0.3  },
      { name: 'Bass',        type: 'midi',  color: '#7c3aed', gainDb: -3,  panCenter: 0    },
      { name: 'Synth Lead',  type: 'midi',  color: '#10b981', gainDb: -4,  panCenter: 0    },
      { name: 'Chord Pad',   type: 'midi',  color: '#3b82f6', gainDb: -8,  panCenter: 0    },
      { name: 'Vocal',       type: 'audio', color: '#ec4899', gainDb: -3,  panCenter: 0    },
      { name: 'BG Vox',      type: 'audio', color: '#ec4899', gainDb: -8,  panCenter: 0.4  },
      { name: 'Mix Bus',     type: 'bus',   color: '#6b7280', gainDb: -2,  panCenter: 0    },
    ],
  },
]

export function getTemplate(style: MusicalStyle): ProjectTemplate | null {
  return TEMPLATES.find(t => t.style === style) ?? null
}

export function getAllTemplates(): ProjectTemplate[] {
  return TEMPLATES
}

export function getTemplateDiff(project: Project, template: ProjectTemplate): TemplateDiff {
  const projectTrackNames = project.tracks.map(t => t.name.toLowerCase())

  const missingTracks = template.tracks.filter(tt => {
    const ttNameLower = tt.name.toLowerCase()
    return !projectTrackNames.some(pn => pn.includes(ttNameLower) || ttNameLower.includes(pn))
  })

  const templateTrackNames = template.tracks.map(tt => tt.name.toLowerCase())
  const extraTracks = project.tracks
    .filter(pt => {
      const ptNameLower = pt.name.toLowerCase()
      return !templateTrackNames.some(tn => tn.includes(ptNameLower) || ptNameLower.includes(tn))
    })
    .map(t => t.name)

  const bpmDiff = template.bpm - project.bpm

  return { missingTracks, extraTracks, bpmDiff }
}
