// ─── WorkflowTipEngine ────────────────────────────────────────────────────────
// Contextual tips and onboarding.

import type { Project } from '../../types/project'
import type { MixingAnalysis } from './MixingAssistant'

export type TipCategory = 'beginner' | 'intermediate' | 'shortcut' | 'mixing' | 'arrangement' | 'error'

export interface Tip {
  id:        string
  category:  TipCategory
  title:     string
  body:      string
  shortcut?: string
  level:     'beginner' | 'intermediate' | 'advanced'
}

export const TIPS: Tip[] = [
  // Beginner tips
  {
    id: 'tip-b-001', category: 'beginner', level: 'beginner',
    title: 'Create your first clip',
    body: 'Double-click on any track in the timeline to create a new MIDI clip. Then open the piano roll to add notes.',
  },
  {
    id: 'tip-b-002', category: 'beginner', level: 'beginner',
    title: 'Set your project BPM',
    body: 'Click the BPM display at the top of the screen to set your project tempo. Tap it repeatedly to tap-tempo.',
  },
  {
    id: 'tip-b-003', category: 'beginner', level: 'beginner',
    title: 'Mute and solo tracks',
    body: 'Use the M and S buttons on each track to mute or solo it. Soloing lets you hear a single track in isolation.',
  },
  {
    id: 'tip-b-004', category: 'beginner', level: 'beginner',
    title: 'Arm a track for recording',
    body: 'Click the arm button (R) on a track before hitting record. Make sure your input device is selected.',
  },
  {
    id: 'tip-b-005', category: 'beginner', level: 'beginner',
    title: 'Save your project often',
    body: 'Use Ctrl+S to save. Enable auto-save in preferences to avoid losing work.',
  },
  {
    id: 'tip-b-006', category: 'beginner', level: 'beginner',
    title: 'Use the loop region',
    body: 'Drag the loop region markers to focus on a section while you compose. Press L to toggle loop playback.',
  },
  {
    id: 'tip-b-007', category: 'beginner', level: 'beginner',
    title: 'Zoom in for precision editing',
    body: 'Use Ctrl+scroll or the zoom controls to zoom in on the timeline for more precise clip editing.',
  },
  {
    id: 'tip-b-008', category: 'beginner', level: 'beginner',
    title: 'Duplicate clips quickly',
    body: 'Select a clip and press Ctrl+D to duplicate it. The copy appears right after the original.',
  },

  // Intermediate tips
  {
    id: 'tip-i-001', category: 'intermediate', level: 'intermediate',
    title: 'Use sends for parallel processing',
    body: 'Route tracks to a reverb bus via sends to share one reverb across multiple tracks, saving CPU.',
  },
  {
    id: 'tip-i-002', category: 'intermediate', level: 'intermediate',
    title: 'Sidechain your kick to bass',
    body: 'Use sidechain compression on your bass triggered by the kick to create a pumping groove.',
  },
  {
    id: 'tip-i-003', category: 'intermediate', level: 'intermediate',
    title: 'Group tracks into buses',
    body: 'Route drums to a Drum Bus to control all drums with a single fader and apply shared processing.',
  },
  {
    id: 'tip-i-004', category: 'intermediate', level: 'intermediate',
    title: 'Use automation envelopes',
    body: 'Draw automation curves to vary volume, panning, or plugin parameters over time for dynamic mixes.',
  },
  {
    id: 'tip-i-005', category: 'intermediate', level: 'intermediate',
    title: 'Clip gain adjustment',
    body: 'Use per-clip gain to balance clips before fader. This preserves headroom on your channel strip.',
  },
  {
    id: 'tip-i-006', category: 'intermediate', level: 'intermediate',
    title: 'Consolidate clips before export',
    body: 'Select multiple clips and consolidate them into one for a cleaner arrangement.',
  },

  // Shortcuts
  {
    id: 'tip-s-001', category: 'shortcut', level: 'beginner',
    title: 'Space to play/pause',
    body: 'Press Space to start or stop playback from the current position.',
    shortcut: 'Space',
  },
  {
    id: 'tip-s-002', category: 'shortcut', level: 'beginner',
    title: 'Ctrl+Z to undo',
    body: 'Undo the last action with Ctrl+Z. Ctrl+Shift+Z to redo.',
    shortcut: 'Ctrl+Z',
  },
  {
    id: 'tip-s-003', category: 'shortcut', level: 'beginner',
    title: 'Ctrl+D to duplicate',
    body: 'Duplicate selected clips with Ctrl+D. They are placed immediately after the selection.',
    shortcut: 'Ctrl+D',
  },
  {
    id: 'tip-s-004', category: 'shortcut', level: 'beginner',
    title: 'Delete to remove clips',
    body: 'Select one or more clips and press Delete (or Backspace) to remove them.',
    shortcut: 'Delete',
  },
  {
    id: 'tip-s-005', category: 'shortcut', level: 'intermediate',
    title: 'S to split clip at cursor',
    body: 'Place the playhead where you want to cut, select a clip, and press S to split it.',
    shortcut: 'S',
  },
  {
    id: 'tip-s-006', category: 'shortcut', level: 'beginner',
    title: 'Ctrl+S to save',
    body: 'Save your project at any time with Ctrl+S.',
    shortcut: 'Ctrl+S',
  },
  {
    id: 'tip-s-007', category: 'shortcut', level: 'intermediate',
    title: 'Ctrl+A to select all',
    body: 'Select all clips in the current view with Ctrl+A.',
    shortcut: 'Ctrl+A',
  },

  // Mixing tips
  {
    id: 'tip-m-001', category: 'mixing', level: 'beginner',
    title: 'Leave headroom on your master',
    body: 'Keep your master output at -6 dB or below. Leave room for mastering compression and limiting.',
  },
  {
    id: 'tip-m-002', category: 'mixing', level: 'intermediate',
    title: 'Pan for stereo width',
    body: 'Pan hi-hats, pads, and guitars slightly left or right to create a wide stereo image.',
  },
  {
    id: 'tip-m-003', category: 'mixing', level: 'intermediate',
    title: 'High-pass filter everything except bass and kick',
    body: 'Roll off low frequencies (below 80–120 Hz) on non-bass tracks to clean up mud and give the bass room.',
  },
  {
    id: 'tip-m-004', category: 'mixing', level: 'advanced',
    title: 'Use reference tracks',
    body: 'Import a commercial track in a similar style and compare your mix against it to calibrate levels and tone.',
  },
  {
    id: 'tip-m-005', category: 'mixing', level: 'intermediate',
    title: 'Check your mix in mono',
    body: 'Collapse your mix to mono to check for phase issues and ensure the mix translates well on small speakers.',
  },
  {
    id: 'tip-m-006', category: 'mixing', level: 'beginner',
    title: 'Gain stage before EQ and compression',
    body: 'Set clip gain and fader levels so your signal is around -18 dBFS RMS before hitting any processing.',
  },

  // Arrangement tips
  {
    id: 'tip-a-001', category: 'arrangement', level: 'beginner',
    title: 'Build in sections',
    body: 'Structure your track as intro, verse, buildup, drop, breakdown, and outro. Each section should feel different.',
  },
  {
    id: 'tip-a-002', category: 'arrangement', level: 'intermediate',
    title: 'Use tension and release',
    body: 'Strip tracks back before a drop, then bring everything in at once for maximum impact.',
  },
  {
    id: 'tip-a-003', category: 'arrangement', level: 'intermediate',
    title: 'Add transitions',
    body: 'Use risers, sweeps, and drum fills at section boundaries to smooth transitions between parts.',
  },
  {
    id: 'tip-a-004', category: 'arrangement', level: 'beginner',
    title: 'Start with 4-bar loops',
    body: 'Build your core groove as a 4-bar loop first, then extend and vary it to fill a full arrangement.',
  },
  {
    id: 'tip-a-005', category: 'arrangement', level: 'advanced',
    title: 'Vary your loops',
    body: 'Avoid exact repetition. Remove a hi-hat hit, add a synth accent, or pitch-shift a note every 8 bars.',
  },
  {
    id: 'tip-a-006', category: 'arrangement', level: 'intermediate',
    title: 'Think about energy flow',
    body: 'Map out the energy level across your track. It should rise, peak, and fall in a satisfying arc.',
  },

  // Error tips
  {
    id: 'tip-e-001', category: 'error', level: 'beginner',
    title: 'Clip distorting?',
    body: 'If audio is distorting, check clip gain, track fader, and master gain. Lower any that are above 0 dBFS.',
  },
  {
    id: 'tip-e-002', category: 'error', level: 'intermediate',
    title: 'Track not playing back?',
    body: 'Check if the track is muted, or if another track is soloed. Also verify the output bus is connected.',
  },
]

const _seen = new Set<string>()

export function getContextualTips(
  project: Project,
  analysis: MixingAnalysis | null,
  maxTips: number,
): Tip[] {
  const result: Tip[] = []

  // Prioritize tips based on context
  const hasNoClips = project.tracks.every(t => t.clips.length === 0)
  const hasMixIssues = analysis !== null && analysis.issues.length > 0
  const hasManyTracks = project.tracks.length > 20

  const prioritized: Tip[] = []

  if (hasNoClips) {
    const beginnerTips = TIPS.filter(t => t.category === 'beginner' && !_seen.has(t.id))
    prioritized.push(...beginnerTips)
  }

  if (hasMixIssues) {
    const mixingTips = TIPS.filter(t => t.category === 'mixing' && !_seen.has(t.id))
    prioritized.push(...mixingTips)
  }

  if (hasManyTracks) {
    const arrangementTips = TIPS.filter(t => t.category === 'arrangement' && !_seen.has(t.id))
    prioritized.push(...arrangementTips)
  }

  // Add remaining unseen tips
  const remaining = TIPS.filter(t => !_seen.has(t.id) && !prioritized.some(p => p.id === t.id))
  prioritized.push(...remaining)

  // Collect up to maxTips unique tips
  for (const tip of prioritized) {
    if (result.length >= maxTips) break
    if (!_seen.has(tip.id)) {
      result.push(tip)
      _seen.add(tip.id)
    }
  }

  return result
}

export function getAllTips(): Tip[] {
  return TIPS
}

export function getTipsByCategory(category: TipCategory): Tip[] {
  return TIPS.filter(t => t.category === category)
}

export function resetSeenTips(): void {
  _seen.clear()
}
