import { useMemo } from 'react'
import type { Clip } from '../types/project'
import type { PRNote } from '../components/piano-roll/types'

export interface ViewportBounds {
  startBeat: number
  endBeat:   number
  startPitch?: number
  endPitch?:   number
}

/** Generic viewport culling hook: keeps only items whose time range overlaps the viewport. */
export function useViewportCulling<T>(
  items: T[],
  viewport: ViewportBounds,
  getRange: (item: T) => { start: number; end: number },
): T[] {
  return useMemo(() => {
    return items.filter(item => {
      const { start, end } = getRange(item)
      return end > viewport.startBeat && start < viewport.endBeat
    })
  }, [items, viewport.startBeat, viewport.endBeat, getRange])
}

const BEATS_PER_BAR = 4  // 4/4 default; callers can override via getRange

/** Clip culling: filter clips to those visible in the beat-range viewport. */
export function useClipCulling(
  clips: Clip[],
  scrollBeat: number,
  viewportBeats: number,
  beatsPerBar = BEATS_PER_BAR,
): Clip[] {
  return useMemo(() => {
    const viewEnd = scrollBeat + viewportBeats
    return clips.filter(c => {
      const clipStart = (c.startBar - 1) * beatsPerBar
      const clipEnd   = clipStart + c.lengthBars * beatsPerBar
      return clipEnd > scrollBeat && clipStart < viewEnd
    })
  }, [clips, scrollBeat, viewportBeats, beatsPerBar])
}

/** Note culling: filter piano-roll notes to those visible in beat + pitch range. */
export function useNoteCulling(
  notes: PRNote[],
  startBeat: number,
  endBeat: number,
  startPitch?: number,
  endPitch?: number,
): PRNote[] {
  return useMemo(() => {
    return notes.filter(n => {
      const noteEnd = n.startBeat + n.lengthBeats
      if (noteEnd <= startBeat || n.startBeat >= endBeat) return false
      if (startPitch !== undefined && n.pitch < startPitch) return false
      if (endPitch   !== undefined && n.pitch > endPitch)   return false
      return true
    })
  }, [notes, startBeat, endBeat, startPitch, endPitch])
}
