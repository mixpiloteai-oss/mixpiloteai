// ─── ProjectContextBuilder ────────────────────────────────────────────────────
// Builds a compact text context string from project state for AI prompt construction.

import type { Project } from '../../types/project'
import type { ProjectAnalysis } from './MusicAnalyzer'

export interface ProjectContext {
  summary:   string     // compact one-paragraph summary for LLM prompt
  bpm:       number
  key:       string     // "C major" or "unknown"
  style:     string
  trackList: string[]   // ["Track 1 (midi, 32 notes, percussive)", ...]
  totalBars: number
}

/**
 * Build a compact context from the current project and analysis.
 */
export function buildContext(project: Project, analysis: ProjectAnalysis): ProjectContext {
  const key   = analysis.detectedKey ? analysis.detectedKey.name : 'unknown'
  const style = analysis.style

  const kickStr    = analysis.hasKick    ? 'Kick present. '    : ''
  const bassStr    = analysis.hasBass    ? 'Bass present. '    : ''
  const harmonyStr = analysis.hasHarmony ? 'Harmony present. ' : ''

  const summary =
    `BPM ${analysis.bpm}, ${key}, ${style} style. ` +
    `${analysis.activeTracks} active tracks. ` +
    `${analysis.totalNotes} notes total. ` +
    `${kickStr}${bassStr}${harmonyStr}`.trim()

  const trackList = analysis.tracks.map(t => {
    const extras: string[] = []
    if (t.isPercussive) extras.push('percussive')
    if (t.isBass)       extras.push('bass')
    const extrasStr = extras.length > 0 ? `, ${extras.join(', ')}` : ''
    return `${t.trackName} (${t.type}, ${t.noteCount} notes${extrasStr})`
  })

  return {
    summary,
    bpm:       analysis.bpm,
    key,
    style,
    trackList,
    totalBars: project.totalBars,
  }
}
