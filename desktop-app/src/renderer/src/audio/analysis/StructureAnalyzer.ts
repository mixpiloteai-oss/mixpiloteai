// ─── Structure Analyzer ───────────────────────────────────────────────────────
// Detects song structure (intro / buildup / drop / break / outro) from either:
//  • waveformData  — 200-point normalized RMS array (from AudioCache)
//  • Arrangement   — clip coverage map from projectStore
//
// Pure computation — no AudioBuffer needed, no network calls, runs in <1 ms.

export type SectionLabel =
  | 'intro' | 'buildup' | 'drop' | 'break' | 'verse' | 'bridge' | 'outro'

export interface StructureSection {
  label:    SectionLabel
  startPct: number    // 0–100 % of total duration
  endPct:   number
  energy:   number    // 0–1 average RMS
}

export interface StructureAnalysis {
  sections:       StructureSection[]
  hasIntro:       boolean
  hasOutro:       boolean
  hasBuildups:    boolean
  hasBreaks:      boolean
  dropCount:      number
  longestSection: StructureSection | null
  suggestion:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function smooth(arr: number[], window: number): number[] {
  const out: number[] = []
  for (let i = 0; i < arr.length; i++) {
    let sum = 0, cnt = 0
    for (let j = Math.max(0, i - window); j <= Math.min(arr.length - 1, i + window); j++) {
      sum += arr[j]!; cnt++
    }
    out.push(sum / cnt)
  }
  return out
}

function normalize(arr: number[]): number[] {
  const max = Math.max(...arr, 1e-9)
  return arr.map(v => v / max)
}

function splitIntoSegments(data: number[], count: number): number[] {
  const size = Math.max(1, Math.floor(data.length / count))
  const segs: number[] = []
  for (let i = 0; i < count; i++) {
    const chunk = data.slice(i * size, (i + 1) * size)
    const rms   = Math.sqrt(chunk.reduce((s, v) => s + v * v, 0) / (chunk.length || 1))
    segs.push(rms)
  }
  return segs
}

// ── Label logic ───────────────────────────────────────────────────────────────

function labelSegment(
  energy: number,
  prev: number,
  _next: number,
  idx: number,
  total: number,
): SectionLabel {
  const rising  = energy - prev > 0.08
  const falling = prev - energy > 0.08
  const atStart = idx < total * 0.15
  const atEnd   = idx > total * 0.85
  const high    = energy > 0.65
  const low     = energy < 0.30

  if (atEnd && energy < 0.45)        return 'outro'
  if (atStart && energy < 0.35)      return 'intro'
  if (rising && !high)               return 'buildup'
  if (high)                          return 'drop'
  if (falling && low)                return 'break'
  if (low)                           return 'verse'
  return 'bridge'
}

// ── Main analysis ─────────────────────────────────────────────────────────────

export function analyzeStructure(waveformData: number[]): StructureAnalysis {
  if (!waveformData.length) return emptyAnalysis()

  const SEG_COUNT = 16
  const smoothed  = smooth(normalize(waveformData), 4)
  const segments  = splitIntoSegments(smoothed, SEG_COUNT)
  const segsNorm  = normalize(segments)

  // Build raw sections
  const raw: StructureSection[] = segsNorm.map((energy, i) => ({
    label:    labelSegment(
                energy,
                segsNorm[i - 1] ?? energy,
                segsNorm[i + 1] ?? energy,  // reserved for future look-ahead logic
                i, SEG_COUNT,
              ),
    startPct: (i / SEG_COUNT) * 100,
    endPct:   ((i + 1) / SEG_COUNT) * 100,
    energy,
  }))

  // Merge consecutive identical labels
  const sections: StructureSection[] = []
  for (const sec of raw) {
    const last = sections[sections.length - 1]
    if (last && last.label === sec.label) {
      last.endPct  = sec.endPct
      last.energy  = (last.energy + sec.energy) / 2
    } else {
      sections.push({ ...sec })
    }
  }

  const labels     = sections.map(s => s.label)
  const dropCount  = labels.filter(l => l === 'drop').length
  const hasBuildups = labels.includes('buildup')
  const hasBreaks  = labels.includes('break')
  const hasIntro   = labels[0] === 'intro'
  const hasOutro   = labels[labels.length - 1] === 'outro'

  const longest = sections.reduce<StructureSection | null>(
    (best, s) => (!best || (s.endPct - s.startPct) > (best.endPct - best.startPct) ? s : best),
    null,
  )

  const suggestion = buildSuggestion({ dropCount, hasBuildups, hasBreaks, hasIntro, hasOutro })

  return { sections, hasIntro, hasOutro, hasBuildups, hasBreaks, dropCount, longestSection: longest, suggestion }
}

/** Analyze structure from arrangement clip coverage (no audio needed) */
export function analyzeStructureFromClips(
  clipCoverage: number[],  // 1 per bar: 0 = silent, 1 = dense
): StructureAnalysis {
  return analyzeStructure(clipCoverage)
}

// ── Suggestion builder ────────────────────────────────────────────────────────

function buildSuggestion(s: {
  dropCount: number; hasBuildups: boolean; hasBreaks: boolean; hasIntro: boolean; hasOutro: boolean
}): string {
  const tips: string[] = []
  if (!s.hasIntro)    tips.push('Add an intro section (8–16 bars) to set the tone before the first element.')
  if (!s.hasBuildups) tips.push('A buildup (4–8 bars of rising energy) before drops increases impact.')
  if (!s.hasBreaks)   tips.push('A break or breakdown creates contrast and makes the drop hit harder.')
  if (!s.hasOutro)    tips.push('An outro (gradual energy decrease) gives the track a clean ending.')
  if (s.dropCount === 0) tips.push('No clear drop detected — try boosting energy in one section for the main hook.')
  if (s.dropCount > 3)   tips.push('Many peaks detected — consider removing one for more contrast.')
  return tips[0] ?? 'Structure looks well-balanced.'
}

function emptyAnalysis(): StructureAnalysis {
  return { sections: [], hasIntro: false, hasOutro: false, hasBuildups: false, hasBreaks: false, dropCount: 0, longestSection: null, suggestion: 'No audio data available.' }
}
