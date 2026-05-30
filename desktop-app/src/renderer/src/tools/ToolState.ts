/**
 * ToolState — active tool definitions and transitions.
 * Pure-TS, no DOM.
 */

export type ActiveTool = 'pointer' | 'pencil' | 'eraser' | 'split' | 'zoom'

export const TOOL_ORDER: ActiveTool[] = ['pointer', 'pencil', 'eraser', 'split', 'zoom']

export const TOOL_CURSORS: Record<ActiveTool, string> = {
  pointer: 'default',
  pencil:  'crosshair',
  eraser:  'cell',
  split:   'col-resize',
  zoom:    'zoom-in',
}

export const TOOL_LABELS: Record<ActiveTool, string> = {
  pointer: 'Pointer',
  pencil:  'Pencil',
  eraser:  'Eraser',
  split:   'Split',
  zoom:    'Zoom',
}

// ─── Tool cycling ─────────────────────────────────────────────────────────────

export function nextTool(current: ActiveTool, dir: 1 | -1): ActiveTool {
  const idx  = TOOL_ORDER.indexOf(current)
  const next = (idx + dir + TOOL_ORDER.length) % TOOL_ORDER.length
  return TOOL_ORDER[next]
}

// ─── Modifier-key tool override ───────────────────────────────────────────────

export interface ModifierState {
  alt:  boolean
  ctrl: boolean
}

export function getModifierTool(
  base: ActiveTool,
  mods: ModifierState,
): ActiveTool | null {
  if (mods.alt)  return 'eraser'
  if (mods.ctrl) return 'split'
  return null
}

// ─── Effective tool (considering modifier) ────────────────────────────────────

export function effectiveTool(base: ActiveTool, mods: ModifierState): ActiveTool {
  return getModifierTool(base, mods) ?? base
}
