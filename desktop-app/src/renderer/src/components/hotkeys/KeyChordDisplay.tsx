/**
 * KeyChordDisplay — renders a key combo as styled keyboard chips.
 * macOS: ⌘⌥⇧⌃ symbols. Other platforms: text labels.
 */

import React from 'react'
import { type KeyCombo, serializeKeyCombo } from '../../hotkeys/KeybindingEngine.ts'

interface KeyChordDisplayProps {
  combo:   KeyCombo
  /** Force macOS symbol rendering regardless of platform */
  macOS?:  boolean
  className?: string
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

function modifierKeys(combo: KeyCombo, useMac: boolean): string[] {
  const mods: string[] = []
  if (combo.ctrl)  mods.push(useMac ? '⌃' : 'Ctrl')
  if (combo.alt)   mods.push(useMac ? '⌥' : 'Alt')
  if (combo.shift) mods.push(useMac ? '⇧' : 'Shift')
  if (combo.meta)  mods.push(useMac ? '⌘' : 'Meta')
  return mods
}

function displayKey(key: string): string {
  const aliases: Record<string, string> = {
    arrowup:    '↑',
    arrowdown:  '↓',
    arrowleft:  '←',
    arrowright: '→',
    escape:     'Esc',
    backspace:  '⌫',
    delete:     'Del',
    enter:      '↩',
    tab:        '⇥',
    space:      '␣',
    home:       'Home',
    end:        'End',
    pageup:     'PgUp',
    pagedown:   'PgDn',
  }
  const lower = key.toLowerCase()
  return aliases[lower] ?? key.toUpperCase()
}

export function KeyChordDisplay({ combo, macOS, className = '' }: KeyChordDisplayProps): React.ReactElement {
  const useMac = macOS ?? isMac
  const mods   = modifierKeys(combo, useMac)
  const key    = displayKey(combo.key)
  const chips  = [...mods, key]

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs ${className}`}
      aria-label={serializeKeyCombo(combo)}
    >
      {chips.map((chip, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 rounded border border-neutral-600 bg-neutral-800 text-neutral-200 leading-none"
        >
          {chip}
        </kbd>
      ))}
    </span>
  )
}
