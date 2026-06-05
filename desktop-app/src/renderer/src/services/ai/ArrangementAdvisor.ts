// ─── Arrangement Advisor ──────────────────────────────────────────────────────
// Analyses the current arrangement state and produces actionable suggestions.
// Pure rule-based — no network, no model, runs in <1 ms.

import { type StructureAnalysis } from '../../audio/analysis/StructureAnalyzer'

export interface TrackSummary {
  name:    string
  clipCount: number   // number of clips on this track
  fillPct:   number   // 0–100: percentage of bars covered by clips
}

export interface ArrangementAdvice {
  issues:      string[]
  suggestions: string[]
  score:       number    // 0–100 overall arrangement health
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreIssues(issueCount: number): number {
  return Math.max(0, 100 - issueCount * 12)
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function adviseArrangement(
  tracks:    TrackSummary[],
  totalBars: number,
  bpm:       number,
  structure: StructureAnalysis | null,
): ArrangementAdvice {
  const issues:      string[] = []
  const suggestions: string[] = []

  // ── Track density checks ──────────────────────────────────────────────────
  const emptyTracks = tracks.filter(t => t.clipCount === 0)
  if (emptyTracks.length > 0) {
    issues.push(`${emptyTracks.length} track(s) have no clips: ${emptyTracks.map(t => t.name).join(', ')}.`)
    suggestions.push('Remove empty tracks or add content — unused tracks waste CPU and clutter the view.')
  }

  const spareTracks = tracks.filter(t => t.fillPct < 20 && t.clipCount > 0)
  if (spareTracks.length > 1) {
    issues.push(`${spareTracks.length} tracks cover less than 20 % of the song — arrangement feels sparse.`)
    suggestions.push('Extend clips or duplicate sections to fill gaps and maintain energy throughout.')
  }

  // ── Length checks ─────────────────────────────────────────────────────────
  const durationSec = (totalBars * 60) / bpm * 4  // assume 4/4
  if (durationSec < 90) {
    issues.push('Track is under 90 seconds — may feel too short for a full release.')
    suggestions.push('Consider extending the outro or adding a second verse/drop to reach at least 2 minutes.')
  }
  if (durationSec > 480) {
    issues.push('Track exceeds 8 minutes — consider tightening intros/outros for streaming.')
    suggestions.push('Trim 8–16 bars from the intro and outro if the core idea is established early.')
  }

  // ── Structure checks ─────────────────────────────────────────────────────
  if (structure) {
    if (!structure.hasIntro) {
      issues.push('No intro detected — track starts at full energy.')
      suggestions.push('Add 8–16 bars of low-energy intro (kick/bass only) to set the scene.')
    }
    if (!structure.hasOutro) {
      issues.push('No outro detected — track ends abruptly.')
      suggestions.push('Fade out or strip back layers over 16–32 bars for a clean ending.')
    }
    if (!structure.hasBuildups) {
      issues.push('No buildup section detected.')
      suggestions.push('A 4–8 bar buildup (rising filter or snare roll) before each drop increases impact.')
    }
    if (!structure.hasBreaks) {
      issues.push('No break/breakdown detected.')
      suggestions.push('A break strips back energy and makes the returning drop feel much heavier.')
    }
    if (structure.dropCount === 0) {
      issues.push('No clear drop/peak section.')
      suggestions.push('Boost energy by bringing all elements in simultaneously for the main hook.')
    }
    if (structure.dropCount > 4) {
      suggestions.push('Many energy peaks detected — one fewer drop may improve flow and contrast.')
    }
  }

  // ── Track variety ─────────────────────────────────────────────────────────
  if (tracks.length < 4) {
    suggestions.push('Fewer than 4 tracks — adding percussion or a pad layer will add depth.')
  }
  if (tracks.length > 12) {
    suggestions.push('Many tracks active — group elements into busses to simplify the mix.')
  }

  return { issues, suggestions, score: scoreIssues(issues.length) }
}
