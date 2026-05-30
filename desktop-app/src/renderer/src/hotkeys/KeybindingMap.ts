/**
 * KeybindingMap — maps key combos to action IDs.
 * One combo → at most one action (last bind wins).
 * One action → multiple combos supported.
 */

import {
  type KeyCombo,
  parseKeyCombo,
  serializeKeyCombo,
} from './KeybindingEngine.ts'

// ─── Stable string key for a combo ───────────────────────────────────────────

function comboKey(combo: KeyCombo): string {
  return [
    combo.ctrl  ? 'C' : '_',
    combo.alt   ? 'A' : '_',
    combo.shift ? 'S' : '_',
    combo.meta  ? 'M' : '_',
    combo.key,
  ].join('|')
}

// ─── KeybindingMap ────────────────────────────────────────────────────────────

export class KeybindingMap {
  // comboKey → actionId
  private _forward = new Map<string, string>()
  // actionId → Set<comboKey>
  private _reverse = new Map<string, Set<string>>()
  // comboKey → original KeyCombo (for serialization)
  private _combos  = new Map<string, KeyCombo>()

  bind(actionId: string, combo: KeyCombo): void {
    const k = comboKey(combo)
    // Remove old action for this combo if any
    const existing = this._forward.get(k)
    if (existing) this._reverse.get(existing)?.delete(k)

    this._forward.set(k, actionId)
    this._combos.set(k, combo)
    if (!this._reverse.has(actionId)) this._reverse.set(actionId, new Set())
    this._reverse.get(actionId)!.add(k)
  }

  unbind(combo: KeyCombo): void {
    const k = comboKey(combo)
    const actionId = this._forward.get(k)
    if (actionId) this._reverse.get(actionId)?.delete(k)
    this._forward.delete(k)
    this._combos.delete(k)
  }

  unbindAction(actionId: string): void {
    const keys = this._reverse.get(actionId)
    if (!keys) return
    for (const k of keys) {
      this._forward.delete(k)
      this._combos.delete(k)
    }
    this._reverse.delete(actionId)
  }

  resolve(combo: KeyCombo): string | null {
    return this._forward.get(comboKey(combo)) ?? null
  }

  getBindingsFor(actionId: string): KeyCombo[] {
    const keys = this._reverse.get(actionId)
    if (!keys) return []
    return [...keys].map((k) => this._combos.get(k)!).filter(Boolean)
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  serialize(): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const [actionId, keys] of this._reverse) {
      out[actionId] = [...keys]
        .map((k) => this._combos.get(k))
        .filter(Boolean)
        .map((c) => serializeKeyCombo(c!))
    }
    return out
  }

  deserialize(data: Record<string, string[]>): void {
    this._forward.clear()
    this._reverse.clear()
    this._combos.clear()
    for (const [actionId, comboStrs] of Object.entries(data)) {
      for (const str of comboStrs) {
        const combo = parseKeyCombo(str)
        if (combo) this.bind(actionId, combo)
      }
    }
  }

  clone(): KeybindingMap {
    const copy = new KeybindingMap()
    copy.deserialize(this.serialize())
    return copy
  }

  clear(): void {
    this._forward.clear()
    this._reverse.clear()
    this._combos.clear()
  }

  allBindings(): Array<{ actionId: string; combo: KeyCombo }> {
    const result: Array<{ actionId: string; combo: KeyCombo }> = []
    for (const [k, actionId] of this._forward) {
      const combo = this._combos.get(k)
      if (combo) result.push({ actionId, combo })
    }
    return result
  }
}
