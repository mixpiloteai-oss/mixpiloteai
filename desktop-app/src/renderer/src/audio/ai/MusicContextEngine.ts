// ─── MusicContextEngine.ts ────────────────────────────────────────────────────
// Layer 2: Merges deep analyses into a single MusicContext.

import type { AnalysisTrack } from './deep/AnalysisTypes'
import { analyzeArrangement } from './deep/ArrangementAnalyzer'
import type { ArrangementAnalysis } from './deep/ArrangementAnalyzer'
import { analyzeEnergy } from './deep/EnergyAnalyzer'
import type { EnergyAnalysis } from './deep/EnergyAnalyzer'
import { analyzeKickBass } from './deep/KickBassAnalyzer'
import type { KickBassAnalysis } from './deep/KickBassAnalyzer'
import { analyzeGroove } from './deep/GrooveAnalyzer'
import type { GrooveAnalysis } from './deep/GrooveAnalyzer'
import { analyzeMix } from './deep/MixAnalyzer'
import type { MixAnalysis } from './deep/MixAnalyzer'
import { detectStyle } from './deep/StyleDetector'
import type { StyleDetection } from './deep/StyleDetector'

export interface ProjectSnapshot {
  bpm: number
  tracks: AnalysisTrack[]
  totalBars: number
  sampleRate: number
  key?: string
}

export interface MusicContext {
  project: ProjectSnapshot
  arrangement: ArrangementAnalysis
  energy: EnergyAnalysis
  kickBass: KickBassAnalysis
  groove: GrooveAnalysis
  mix: MixAnalysis
  style: StyleDetection
  contextSummary: string
  buildTimestamp: number
}

class MusicContextEngine {
  /**
   * Build a full MusicContext from a project snapshot.
   */
  async buildContext(project: ProjectSnapshot): Promise<MusicContext> {
    const totalNotes = project.tracks.reduce((sum, t) =>
      sum + t.clips.reduce((s, c) => s + c.notes.length, 0), 0)

    const arrangement = analyzeArrangement(project.tracks, project.bpm, project.totalBars)
    const energy = analyzeEnergy(project.tracks, project.bpm, project.totalBars)
    const kickBass = analyzeKickBass(project.tracks)
    const groove = analyzeGroove(project.tracks, project.bpm)
    const mix = analyzeMix(project.tracks, totalNotes)
    const style = detectStyle(project.bpm, groove, arrangement, mix)

    const partial = { project, arrangement, energy, kickBass, groove, mix, style }
    const contextSummary = this.buildContextSummary(partial)

    return {
      ...partial,
      contextSummary,
      buildTimestamp: Date.now(),
    }
  }

  /**
   * Build a one-paragraph text description of the project for cloud AI.
   */
  buildContextSummary(
    ctx: Omit<MusicContext, 'contextSummary' | 'buildTimestamp'>,
  ): string {
    const { project, style, groove, arrangement, energy, mix } = ctx
    const keyStr = project.key ? ` in ${project.key}` : ''
    const styleStr = style.primaryStyle !== 'unknown' ? style.primaryStyle : 'electronic'
    const grooveStr = `The groove is ${groove.grooveTemplate} with ${groove.dominantSubdivision} note subdivision`
    const energyStr = energy.buildupPoints.length > 0
      ? `Energy builds at bars ${energy.buildupPoints.slice(0, 2).join(', ')}`
      : 'Energy is relatively consistent throughout'
    const sectionStr = arrangement.sections.length > 0
      ? `The arrangement has ${arrangement.sections.length} sections including ${arrangement.sections[0]?.label ?? 'intro'}`
      : 'The arrangement structure is minimal'
    const mixStr = mix.suggestions.length > 0
      ? `Mix note: ${mix.suggestions[0]}`
      : 'The mix balance is adequate'

    return `A ${styleStr} track at ${project.bpm} BPM${keyStr}. ${grooveStr}. ${sectionStr}. ${energyStr}. ${mixStr}.`
  }
}

export const musicContextEngine = new MusicContextEngine()
