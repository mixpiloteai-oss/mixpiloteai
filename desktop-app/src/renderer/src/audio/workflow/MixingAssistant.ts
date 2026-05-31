// ─── MixingAssistant ─────────────────────────────────────────────────────────
// Real mixing analysis with actionable suggestions. All checks are deterministic.

import type { Project } from '../../types/project'

export type MixingIssueLevel = 'info' | 'warning' | 'critical'

export interface MixingIssue {
  id:       string
  level:    MixingIssueLevel
  title:    string
  detail:   string
  trackId?: string
  fix?:     string
}

export interface MixingAnalysis {
  score:      number
  issues:     MixingIssue[]
  panBalance: number
  headroomDb: number
  trackCount: number
  busCount:   number
}

export function analyzeMix(project: Project): MixingAnalysis {
  const issues: MixingIssue[] = []

  // Check 1: master gain > 0 → critical
  if (project.masterGainDb > 0) {
    issues.push({
      id:     'master-clip',
      level:  'critical',
      title:  'Master gain is positive',
      detail: 'Risk of clipping — master gain should be 0 dB or below.',
      fix:    'Set master gain to 0 dB or lower.',
    })
  }

  // Check 2: master gain > -3 → warning (only if not already critical)
  if (project.masterGainDb > -3 && project.masterGainDb <= 0) {
    issues.push({
      id:     'master-headroom',
      level:  'warning',
      title:  'Low headroom on master',
      detail: 'Less than 3 dB of headroom on master.',
      fix:    'Lower master gain to at least -3 dB.',
    })
  }

  // Per-track checks
  const allPanCenter = project.tracks.every(t => t.panCenter === 0)

  for (const track of project.tracks) {
    // Check 3: track gain > 6 dB → warning
    if (track.gainDb > 6) {
      issues.push({
        id:      `track-gain-high-${track.id}`,
        level:   'warning',
        title:   `Track '${track.name}' gain is high`,
        detail:  `Gain is ${track.gainDb.toFixed(1)} dB — consider reducing to avoid distortion.`,
        trackId: track.id,
        fix:     `Reduce gain on '${track.name}' to 6 dB or below.`,
      })
    }

    // Check 7: track soloed → warning
    if (track.soloed) {
      issues.push({
        id:      `track-soloed-${track.id}`,
        level:   'warning',
        title:   `Track '${track.name}' is soloed`,
        detail:  'A soloed track will mute all other tracks during playback.',
        trackId: track.id,
        fix:     `Unsolo '${track.name}' before export.`,
      })
    }

    // Check 8: track muted → info
    if (track.muted) {
      issues.push({
        id:      `track-muted-${track.id}`,
        level:   'info',
        title:   `Track '${track.name}' is muted`,
        detail:  'This track will not play back.',
        trackId: track.id,
        fix:     `Unmute '${track.name}' if it should be heard.`,
      })
    }

    // Check 6: no clips → info
    if (track.clips.length === 0) {
      issues.push({
        id:      `track-empty-${track.id}`,
        level:   'info',
        title:   `Track '${track.name}' has no clips`,
        detail:  'This track contains no audio/MIDI clips.',
        trackId: track.id,
        fix:     `Add clips to '${track.name}' or remove the track.`,
      })
    }
  }

  // Check 4: all tracks centered → info
  if (allPanCenter && project.tracks.length > 0) {
    issues.push({
      id:     'all-centered',
      level:  'info',
      title:  'All tracks are centered',
      detail: 'All tracks are panned to center. Try panning for width.',
      fix:    'Pan some tracks left or right to create stereo width.',
    })
  }

  // Check 5: too many tracks → info
  if (project.tracks.length > 20) {
    issues.push({
      id:     'too-many-tracks',
      level:  'info',
      title:  `Project has ${project.tracks.length} tracks`,
      detail: 'Consider grouping tracks into buses for better organization.',
      fix:    'Group related tracks into bus channels.',
    })
  }

  // Score calculation
  let score = 100
  for (const issue of issues) {
    if (issue.level === 'critical') score -= 20
    else if (issue.level === 'warning') score -= 10
    else score -= 2
  }
  score = Math.max(0, Math.min(100, score))

  // Pan balance: weighted average of panCenter * gainDb / sum(|gainDb|)
  const tracks = project.tracks
  const totalAbsGain = tracks.reduce((s, t) => s + Math.abs(t.gainDb), 0)
  const panBalance = totalAbsGain > 0
    ? tracks.reduce((s, t) => s + t.panCenter * t.gainDb, 0) / totalAbsGain
    : 0

  const headroomDb = -project.masterGainDb
  const busCount = project.tracks.filter(t => t.type === 'bus').length

  return {
    score,
    issues,
    panBalance,
    headroomDb,
    trackCount: project.tracks.length,
    busCount,
  }
}

export function getSuggestions(analysis: MixingAnalysis): string[] {
  const criticals = analysis.issues.filter(i => i.level === 'critical' && i.fix)
  const warnings  = analysis.issues.filter(i => i.level === 'warning' && i.fix)
  const infos     = analysis.issues.filter(i => i.level === 'info' && i.fix)

  const ordered = [...criticals, ...warnings, ...infos]
  return ordered.slice(0, 3).map(i => i.fix ?? i.title)
}
