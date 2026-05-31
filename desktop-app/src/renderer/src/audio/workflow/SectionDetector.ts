// ─── SectionDetector ─────────────────────────────────────────────────────────
// Real music section detection from arrangement data. No random.

import type { Project } from '../../types/project'

export type SectionType =
  | 'intro' | 'verse' | 'chorus' | 'buildup' | 'drop'
  | 'breakdown' | 'bridge' | 'outro' | 'silence'

export interface ArrangementSection {
  type:       SectionType
  startBar:   number
  endBar:     number
  label:      string       // "Intro (bars 1–8)"
  trackCount: number       // active tracks in this section
  intensity:  number       // 0–1, normalized clip density
}

function classifyRegion(
  density: number,
  position: number,
  totalBars: number,
  prevDensity: number,
  nextDensity: number,
): SectionType {
  if (density === 0) return 'silence'
  if (density < 0.25) {
    if (position < totalBars * 0.2) return 'intro'
    if (position > totalBars * 0.8) return 'outro'
    return 'breakdown'
  }
  if (density < 0.5) return 'verse'
  if (density >= 0.5 && density > prevDensity + 0.1) return 'buildup'
  if (density >= 0.75 && density > nextDensity + 0.1) return 'drop'
  if (density >= 0.75) return 'chorus'
  return 'bridge'
}

function formatLabel(type: SectionType, startBar: number, endBar: number): string {
  const typeName = type.charAt(0).toUpperCase() + type.slice(1)
  return `${typeName} (bars ${startBar}–${endBar})`
}

export function detectSections(project: Project): ArrangementSection[] {
  const totalBars = project.totalBars
  if (totalBars <= 0) return []

  // Step 1: Build bar-by-bar density map
  const activeClipCount = new Array<number>(totalBars + 1).fill(0)

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const clipStart = clip.startBar
      const clipEnd = clip.startBar + clip.lengthBars
      for (let bar = clipStart; bar < clipEnd && bar <= totalBars; bar++) {
        if (bar >= 1) {
          activeClipCount[bar] = (activeClipCount[bar] ?? 0) + 1
        }
      }
    }
  }

  // Step 2: Normalize density
  let maxActiveClips = 0
  for (let bar = 1; bar <= totalBars; bar++) {
    const count = activeClipCount[bar] ?? 0
    if (count > maxActiveClips) maxActiveClips = count
  }

  const density = new Array<number>(totalBars + 1).fill(0)
  for (let bar = 1; bar <= totalBars; bar++) {
    density[bar] = (activeClipCount[bar] ?? 0) / Math.max(1, maxActiveClips)
  }

  // Step 3 & 4: Group consecutive bars with similar density (< 0.2 difference)
  interface Region {
    startBar: number
    endBar: number
    avgDensity: number
    trackCount: number
  }

  const regions: Region[] = []
  let regionStart = 1
  let regionDensitySum = density[1] ?? 0
  let regionLen = 1

  for (let bar = 2; bar <= totalBars; bar++) {
    const d = density[bar] ?? 0
    const prevD = density[bar - 1] ?? 0
    const change = Math.abs(d - prevD)

    if (change >= 0.2) {
      // Transition point — close current region
      const avgDensity = regionDensitySum / regionLen
      // Count active tracks in this region
      let trackCount = 0
      for (const track of project.tracks) {
        const hasClipInRegion = track.clips.some(clip => {
          const clipEnd = clip.startBar + clip.lengthBars
          return clip.startBar < bar && clipEnd > regionStart
        })
        if (hasClipInRegion) trackCount++
      }
      regions.push({ startBar: regionStart, endBar: bar - 1, avgDensity, trackCount })
      regionStart = bar
      regionDensitySum = d
      regionLen = 1
    } else {
      regionDensitySum += d
      regionLen++
    }
  }

  // Close last region
  if (regionStart <= totalBars) {
    const avgDensity = regionDensitySum / regionLen
    let trackCount = 0
    for (const track of project.tracks) {
      const hasClipInRegion = track.clips.some(clip => {
        const clipEnd = clip.startBar + clip.lengthBars
        return clip.startBar <= totalBars && clipEnd > regionStart
      })
      if (hasClipInRegion) trackCount++
    }
    regions.push({ startBar: regionStart, endBar: totalBars, avgDensity, trackCount })
  }

  // Step 5: Classify each region
  const sections: ArrangementSection[] = regions.map((region, i) => {
    const prevDensity = i > 0 ? (regions[i - 1]?.avgDensity ?? 0) : 0
    const nextDensity = i < regions.length - 1 ? (regions[i + 1]?.avgDensity ?? 0) : 0
    const midBar = (region.startBar + region.endBar) / 2

    const type = classifyRegion(
      region.avgDensity,
      midBar,
      totalBars,
      prevDensity,
      nextDensity,
    )

    return {
      type,
      startBar: region.startBar,
      endBar: region.endBar,
      label: formatLabel(type, region.startBar, region.endBar),
      trackCount: region.trackCount,
      intensity: Math.max(0, Math.min(1, region.avgDensity)),
    }
  })

  // Step 6: Return sorted by startBar
  return sections.sort((a, b) => a.startBar - b.startBar)
}

export function getSectionColor(type: SectionType): string {
  const colors: Record<SectionType, string> = {
    intro:     '#6b7280',
    verse:     '#3b82f6',
    chorus:    '#10b981',
    buildup:   '#f59e0b',
    drop:      '#ef4444',
    breakdown: '#7c3aed',
    bridge:    '#ec4899',
    outro:     '#6b7280',
    silence:   '#1f2937',
  }
  return colors[type]
}
