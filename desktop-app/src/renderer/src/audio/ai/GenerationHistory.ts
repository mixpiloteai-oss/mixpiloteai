// ─── GenerationHistory.ts ─────────────────────────────────────────────────────
// Session-scoped history of AI generations (no localStorage).

import type { GeneratedPattern } from './PatternGenerator'
import type { AutomationCurve } from './AutomationGenerator'

export interface GenerationEntry {
  id:         string
  timestamp:  number
  label:      string
  pattern:    GeneratedPattern | null
  automation: AutomationCurve | null
  accepted:   boolean
}

export class GenerationHistory {
  private static readonly MAX_ENTRIES = 20
  private entries: GenerationEntry[] = []

  push(entry: Omit<GenerationEntry, 'id'>): GenerationEntry {
    const full: GenerationEntry = {
      ...entry,
      id: `gen-${Date.now()}-${Math.floor(entry.timestamp)}`,
    }
    this.entries.unshift(full)
    if (this.entries.length > GenerationHistory.MAX_ENTRIES) {
      this.entries = this.entries.slice(0, GenerationHistory.MAX_ENTRIES)
    }
    return full
  }

  accept(id: string): void {
    const entry = this.entries.find(e => e.id === id)
    if (entry) entry.accepted = true
  }

  reject(id: string): void {
    this.entries = this.entries.filter(e => e.id !== id)
  }

  list(): GenerationEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries = []
  }

  last(): GenerationEntry | null {
    return this.entries[0] ?? null
  }
}
