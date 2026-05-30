/**
 * HotkeyManager — singleton orchestrator for the keybinding system.
 * Wires KeybindingMap + ActionRegistry with chord support and storage.
 * Pure-TS: no DOM imports at module level.
 */

import {
  parseKeyCombo,
  matchesEvent,
  serializeKeyCombo,
  normalizeKey,
  type KeyEventLike,
  type ChordState,
  CHORD_TIMEOUT_MS,
} from './KeybindingEngine.ts'
import { KeybindingMap } from './KeybindingMap.ts'
import { ActionRegistry } from './ActionRegistry.ts'
import { type PresetName, PRESETS } from './HotkeyPresets.ts'

// ─── Storage interface (localStorage-compatible) ──────────────────────────────

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'hotkeys-v1'

// ─── HotkeyManager ────────────────────────────────────────────────────────────

export class HotkeyManager {
  readonly map:      KeybindingMap   = new KeybindingMap()
  readonly registry: ActionRegistry  = new ActionRegistry()

  // Chord support: maps first-combo serialized string → second-combo string → actionId
  private _chords = new Map<string, Map<string, string>>()
  private _chordState: ChordState | null = null

  // ── Preset loading ────────────────────────────────────────────────────────

  loadPreset(preset: Record<string, string[]>): void {
    this.map.clear()
    this._chords.clear()
    this._chordState = null

    for (const [actionId, combos] of Object.entries(preset)) {
      for (const str of combos) {
        // Chord detection: "G then B"
        if (str.toLowerCase().includes(' then ')) {
          const [first, second] = str.split(/\s+then\s+/i)
          if (first && second) {
            const f = parseKeyCombo(first)
            const s = parseKeyCombo(second)
            if (f && s) {
              const fk = serializeKeyCombo(f)
              if (!this._chords.has(fk)) this._chords.set(fk, new Map())
              this._chords.get(fk)!.set(serializeKeyCombo(s), actionId)
            }
          }
        } else {
          const combo = parseKeyCombo(str)
          if (combo) this.map.bind(actionId, combo)
        }
      }
    }
  }

  applyCustom(overrides: Record<string, string[]>): void {
    for (const [actionId, combos] of Object.entries(overrides)) {
      this.map.unbindAction(actionId)
      for (const str of combos) {
        const combo = parseKeyCombo(str)
        if (combo) this.map.bind(actionId, combo)
      }
    }
  }

  resetToPreset(name: PresetName): void {
    this.loadPreset(PRESETS[name])
  }

  // ── Key event handling ────────────────────────────────────────────────────

  onKeyEvent(event: KeyEventLike & { target?: unknown }): boolean {
    // Skip when typing in form elements
    if (this._isInputTarget(event.target)) return false

    const combo = {
      key:   normalizeKey(event.key),
      ctrl:  event.ctrlKey,
      shift: event.shiftKey,
      alt:   event.altKey,
      meta:  event.metaKey,
    }

    // ── Chord resolution ────────────────────────────────────────────────────
    if (this._chordState) {
      const elapsed = Date.now() - this._chordState.timestamp
      if (elapsed < CHORD_TIMEOUT_MS) {
        // Try to resolve chord: first + current
        const firstKey  = serializeKeyCombo(this._chordState.firstCombo)
        const secondKey = serializeKeyCombo(combo)
        const chordMap  = this._chords.get(firstKey)
        const actionId  = chordMap?.get(secondKey)
        this._chordState = null   // chord consumed regardless

        if (actionId) {
          return this.registry.execute(actionId)
        }
        // Chord not found — fall through to single-key resolution
      } else {
        this._chordState = null   // timed out
      }
    }

    // ── Single combo resolution ─────────────────────────────────────────────
    // Check if this combo is the first key of any chord
    const comboSer = serializeKeyCombo(combo)
    if (this._chords.has(comboSer)) {
      this._chordState = { firstCombo: combo, timestamp: Date.now() }
      return false   // wait for second key (don't consume yet)
    }

    // Regular single binding
    const actionId = this.map.resolve(combo)
    if (!actionId) return false
    return this.registry.execute(actionId)
  }

  isChordPending(): boolean {
    if (!this._chordState) return false
    return Date.now() - this._chordState.timestamp < CHORD_TIMEOUT_MS
  }

  cancelChord(): void {
    this._chordState = null
  }

  // ── Conflict detection ────────────────────────────────────────────────────

  getConflicts(): Array<{ combo: string; actionIds: string[] }> {
    // In our KeybindingMap, last-bind-wins so there can be no real duplicates.
    // This checks whether the same action has the same combo twice (shouldn't happen).
    const seen = new Map<string, string[]>()
    for (const { actionId, combo } of this.map.allBindings()) {
      const k = serializeKeyCombo(combo)
      if (!seen.has(k)) seen.set(k, [])
      seen.get(k)!.push(actionId)
    }
    return [...seen.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([combo, actionIds]) => ({ combo, actionIds }))
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  saveToStorage(storage?: StorageAdapter): void {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    if (!store) return
    store.setItem(STORAGE_KEY, JSON.stringify(this.map.serialize()))
  }

  loadFromStorage(storage?: StorageAdapter): void {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    if (!store) return
    try {
      const raw = store.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Record<string, string[]>
      this.map.deserialize(data)
    } catch {
      // Corrupt storage — ignore and keep current bindings
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _isInputTarget(target: unknown): boolean {
    if (!target || typeof target !== 'object') return false
    const el = target as { tagName?: string; isContentEditable?: boolean }
    if (!el.tagName) return false
    const tag = el.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || el.isContentEditable === true
  }

  // ── Singleton ─────────────────────────────────────────────────────────────

  private static _instance: HotkeyManager | null = null

  static getInstance(): HotkeyManager {
    if (!HotkeyManager._instance) {
      HotkeyManager._instance = new HotkeyManager()
      HotkeyManager._instance.resetToPreset('default')
    }
    return HotkeyManager._instance
  }

  /** Reset singleton — for tests only */
  static _resetInstance(): void {
    HotkeyManager._instance = null
  }
}
