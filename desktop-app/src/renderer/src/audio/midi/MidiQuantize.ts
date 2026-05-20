// ─── Advanced MIDI Quantize ───────────────────────────────────────────────────
// Snap notes to a grid with adjustable strength and swing
//
// Features:
// - Grid quantization (1/4, 1/8, 1/16, 1/32, triplets)
// - Swing (delay every other note)
// - Strength (partial quantization for natural feel)
// - Groove templates (extract groove from existing pattern)
// - End-point quantization (length quantize)

import type { PRNote } from '../../components/piano-roll/types'

export type GridDivision =
  | '1/4' | '1/8' | '1/16' | '1/32'
  | '1/4t' | '1/8t' | '1/16t'
  | '1/4d' | '1/8d' | '1/16d'

export interface QuantizeOptions {
  /** Grid resolution */
  grid: GridDivision
  /** Strength 0-1 (0=no change, 1=full snap) */
  strength: number
  /** Swing amount 0-1 (delays every other note) */
  swing: number
  /** Quantize note start */
  quantizeStart: boolean
  /** Quantize note end (length quantize) */
  quantizeEnd: boolean
  /** Apply only to selected notes */
  selectedOnly?: boolean
  /** Ticks per quarter note */
  ppqn: number
}

const DEFAULTS: QuantizeOptions = {
  grid:           '1/16',
  strength:       1.0,
  swing:          0,
  quantizeStart:  true,
  quantizeEnd:    false,
  ppqn:           480,
}

// ─── Grid → ticks ─────────────────────────────────────────────────────────────

function gridToTicks(grid: GridDivision, ppqn: number): number {
  const base: Record<string, number> = {
    '1/4':   ppqn,
    '1/8':   ppqn / 2,
    '1/16':  ppqn / 4,
    '1/32':  ppqn / 8,
    '1/4t':  ppqn * 2 / 3,    // triplet
    '1/8t':  ppqn / 3,
    '1/16t': ppqn / 6,
    '1/4d':  ppqn * 1.5,       // dotted
    '1/8d':  ppqn * 0.75,
    '1/16d': ppqn * 0.375,
  }
  return base[grid] ?? ppqn / 4
}

// ─── Quantize engine ──────────────────────────────────────────────────────────

export class MidiQuantize {
  /**
   * Quantize notes to a grid with strength and swing.
   */
  static apply(notes: PRNote[], options?: Partial<QuantizeOptions>): PRNote[] {
    const opts = { ...DEFAULTS, ...options }
    const tickGrid = gridToTicks(opts.grid, opts.ppqn)

    return notes.map(note => {
      if (opts.selectedOnly && !note.selected) return note

      let newStart    = note.start
      let newDuration = note.duration

      if (opts.quantizeStart) {
        // Find nearest grid position
        const gridIndex = Math.round(note.start / tickGrid)
        let snapped = gridIndex * tickGrid

        // Apply swing: delay every other (odd) grid position
        if (opts.swing > 0 && gridIndex % 2 === 1) {
          snapped += tickGrid * opts.swing * 0.5
        }

        // Apply strength (interpolate between original and snapped)
        newStart = note.start + (snapped - note.start) * opts.strength
      }

      if (opts.quantizeEnd) {
        const noteEnd = note.start + note.duration
        const endGrid = Math.round(noteEnd / tickGrid) * tickGrid
        const snappedEnd = noteEnd + (endGrid - noteEnd) * opts.strength
        newDuration = Math.max(1, snappedEnd - newStart)
      }

      return {
        ...note,
        start:    Math.max(0, newStart),
        duration: newDuration,
      }
    })
  }

  /**
   * Extract groove template from notes — captures timing offsets.
   * Can be applied to other notes to transfer the "feel".
   */
  static extractGroove(notes: PRNote[], ppqn = 480, gridDiv: GridDivision = '1/16'): number[] {
    const gridTicks = gridToTicks(gridDiv, ppqn)
    const offsets: number[] = []
    const slots = 16  // One bar of 16th notes

    for (let i = 0; i < slots; i++) {
      const targetTick = i * gridTicks
      const closest = notes.reduce((best, n) => {
        const distBest = Math.abs(best.start - targetTick)
        const distN    = Math.abs(n.start    - targetTick)
        return distN < distBest ? n : best
      }, notes[0] ?? { start: targetTick, pitch: 0, velocity: 0, duration: 0 })
      offsets.push(closest.start - targetTick)
    }

    return offsets
  }

  /**
   * Apply previously extracted groove template to notes.
   */
  static applyGroove(
    notes: PRNote[],
    groove: number[],
    strength: number,
    ppqn = 480,
    gridDiv: GridDivision = '1/16',
  ): PRNote[] {
    const gridTicks = gridToTicks(gridDiv, ppqn)

    return notes.map(note => {
      const slotIndex = Math.round(note.start / gridTicks) % groove.length
      const offset = groove[slotIndex] ?? 0
      return {
        ...note,
        start: Math.max(0, note.start + offset * strength),
      }
    })
  }
}
