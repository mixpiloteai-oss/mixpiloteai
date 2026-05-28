import type { Track } from '../../types/project'

export const AUTOMATION_LANE_H = 64

export interface TrackLayout {
  id: string
  y: number      // top of the entire slot (clip area + automation lane if expanded)
  h: number      // total height of the slot
  clipH: number  // height of the clip row only
  autoY: number  // top of the automation lane area (= y + clipH)
  autoH: number  // height of automation lane (0 if not expanded)
}

export function computeTrackLayout(
  tracks: Track[],
  scrollY: number,
  expandedAutomationTracks: Set<string> = new Set()
): TrackLayout[] {
  const layout: TrackLayout[] = []
  let y = -scrollY
  for (const track of tracks) {
    const autoH = expandedAutomationTracks.has(track.id) ? AUTOMATION_LANE_H : 0
    const h = track.height + autoH
    layout.push({ id: track.id, y, h, clipH: track.height, autoY: y + track.height, autoH })
    y += h + 1
  }
  return layout
}

export const SNAP_BEATS_MAP: Record<string, number> = {
  'off': 0, '1/32': 0.125, '1/16': 0.25, '1/8': 0.5,
  '1/4': 1, '1/2': 2, '1/1': 4, '2/1': 8, '4/1': 16,
}

export function snapBeat(beat: number, snap: string): number {
  const g = SNAP_BEATS_MAP[snap] ?? 0
  return g === 0 ? beat : Math.round(beat / g) * g
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
