/**
 * KeybindingEngine — pure-TS key combo parsing and matching.
 * No DOM imports — can be tested in Node.js.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KeyCombo {
  key:   string    // normalized lowercase key name (e.g. 'z', 'space', 'arrowleft')
  ctrl:  boolean
  shift: boolean
  alt:   boolean
  meta:  boolean   // Cmd on macOS, Win key on Windows
}

/** Minimal event shape — avoids DOM dependency */
export interface KeyEventLike {
  key:      string
  ctrlKey:  boolean
  shiftKey: boolean
  altKey:   boolean
  metaKey:  boolean
}

// ─── Key aliases ──────────────────────────────────────────────────────────────

const KEY_ALIASES: Record<string, string> = {
  ' ':           'space',
  'spacebar':    'space',
  'arrowup':     'arrowup',
  'arrowdown':   'arrowdown',
  'arrowleft':   'arrowleft',
  'arrowright':  'arrowright',
  'up':          'arrowup',
  'down':        'arrowdown',
  'left':        'arrowleft',
  'right':       'arrowright',
  'esc':         'escape',
  'del':         'delete',
  'ins':         'insert',
  'pgup':        'pageup',
  'pgdn':        'pagedown',
  'return':      'enter',
  'plus':        '+',
  'minus':       '-',
  '=':           '=',
  '-':           '-',
}

export function normalizeKey(raw: string): string {
  const lower = raw.toLowerCase()
  // Look up exact lowercase before trimming (preserves single-space key ' ')
  if (Object.prototype.hasOwnProperty.call(KEY_ALIASES, lower)) {
    return KEY_ALIASES[lower]!
  }
  const trimmed = lower.trim()
  return KEY_ALIASES[trimmed] ?? trimmed
}

// ─── parseKeyCombo ────────────────────────────────────────────────────────────

/**
 * Parse a combo string like "Ctrl+Z", "Cmd+Shift+D", "Space", "Alt+Left".
 * Returns null for empty or unparseable strings.
 */
export function parseKeyCombo(str: string): KeyCombo | null {
  const s = str.trim()
  if (!s) return null

  const parts = s.split('+').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  let ctrl  = false
  let shift = false
  let alt   = false
  let meta  = false
  const keyParts: string[] = []

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') { ctrl  = true; continue }
    if (lower === 'shift')                        { shift = true; continue }
    if (lower === 'alt' || lower === 'option')    { alt   = true; continue }
    if (lower === 'cmd' || lower === 'meta' || lower === 'command' || lower === 'win') {
      meta = true; continue
    }
    keyParts.push(part)
  }

  if (keyParts.length !== 1) return null   // zero or multiple non-modifier keys
  const key = normalizeKey(keyParts[0]!)
  if (!key) return null

  return { key, ctrl, shift, alt, meta }
}

// ─── serializeKeyCombo ────────────────────────────────────────────────────────

export function serializeKeyCombo(combo: KeyCombo): string {
  const parts: string[] = []
  if (combo.ctrl)  parts.push('Ctrl')
  if (combo.alt)   parts.push('Alt')
  if (combo.shift) parts.push('Shift')
  if (combo.meta)  parts.push('Cmd')
  // Capitalize key for display
  const key = combo.key === 'space' ? 'Space'
    : combo.key.length === 1        ? combo.key.toUpperCase()
    : combo.key.charAt(0).toUpperCase() + combo.key.slice(1)
  parts.push(key)
  return parts.join('+')
}

// ─── matchesEvent ─────────────────────────────────────────────────────────────

export function matchesEvent(combo: KeyCombo, event: KeyEventLike): boolean {
  if (combo.ctrl  !== event.ctrlKey)  return false
  if (combo.shift !== event.shiftKey) return false
  if (combo.alt   !== event.altKey)   return false
  if (combo.meta  !== event.metaKey)  return false
  const evKey = normalizeKey(event.key)
  return evKey === combo.key
}

// ─── Chord support ────────────────────────────────────────────────────────────

/** Parse a chord string like "G then B" → [KeyCombo, KeyCombo] */
export function parseChord(str: string): [KeyCombo, KeyCombo] | null {
  const lower = str.toLowerCase()
  const sepIdx = lower.indexOf(' then ')
  if (sepIdx === -1) return null

  const first  = parseKeyCombo(str.slice(0, sepIdx).trim())
  const second = parseKeyCombo(str.slice(sepIdx + 6).trim())
  if (!first || !second) return null
  return [first, second]
}

/** Track pending chord state */
export interface ChordState {
  firstCombo:  KeyCombo
  timestamp:   number
}

export const CHORD_TIMEOUT_MS = 1500
