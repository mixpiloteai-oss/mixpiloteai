/**
 * DragEngine — pure-TS immutable drag state machine.
 * No DOM imports. All operations return new state objects.
 */

export type DragType =
  | 'move-clip'
  | 'resize-clip-start'
  | 'resize-clip-end'
  | 'select-rect'
  | 'pan-timeline'
  | 'none'

export interface DragState {
  active:  boolean
  type:    DragType
  startX:  number
  startY:  number
  lastX:   number
  lastY:   number
  deltaX:  number
  deltaY:  number
  payload: unknown
}

export const DRAG_IDLE: DragState = {
  active:  false,
  type:    'none',
  startX:  0,
  startY:  0,
  lastX:   0,
  lastY:   0,
  deltaX:  0,
  deltaY:  0,
  payload: null,
}

// ─── State transitions (all immutable) ───────────────────────────────────────

export function begin(type: DragType, x: number, y: number, payload: unknown = null): DragState {
  return {
    active:  true,
    type,
    startX:  x,
    startY:  y,
    lastX:   x,
    lastY:   y,
    deltaX:  0,
    deltaY:  0,
    payload,
  }
}

export function update(state: DragState, x: number, y: number): DragState {
  if (!state.active) return state
  return {
    ...state,
    lastX:  x,
    lastY:  y,
    deltaX: x - state.startX,
    deltaY: y - state.startY,
  }
}

export function end(_state: DragState): DragState {
  return DRAG_IDLE
}

// ─── Grid snapping ────────────────────────────────────────────────────────────

export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}

// ─── Clip-edge magnet ─────────────────────────────────────────────────────────

export interface ClipEdge {
  bar: number
}

export function magnetToClipEdges(
  bar:       number,
  clips:     ClipEdge[],
  threshold: number,
): number {
  let closest     = bar
  let closestDist = threshold

  for (const clip of clips) {
    const dist = Math.abs(clip.bar - bar)
    if (dist < closestDist) {
      closestDist = dist
      closest     = clip.bar
    }
  }

  return closest
}
