/**
 * TempoMap — multi-BPM timeline support
 *
 * Stores an ordered list of tempo events. Each event marks the bar at which a
 * new BPM takes effect. Bar 1 always has a tempo event (default 120 BPM).
 *
 * Used by Clock to dynamically update its BPM as the playhead advances,
 * enabling real tempo changes mid-timeline without restarting playback.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TempoEvent {
  /** 1-based bar where this BPM takes effect. */
  bar: number
  /** Tempo in beats per minute, clamped to [20, 300]. */
  bpm: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MIN_BPM_TEMPO = 20
const MAX_BPM_TEMPO = 300
const DEFAULT_BPM_TEMPO = 120

function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM_TEMPO, Math.min(MAX_BPM_TEMPO, bpm))
}

// ─── TempoMap ─────────────────────────────────────────────────────────────────

export class TempoMap {
  private _events: TempoEvent[] = [{ bar: 1, bpm: DEFAULT_BPM_TEMPO }]

  // ── Query ────────────────────────────────────────────────────────────────

  /**
   * Return the BPM in effect at a given bar position.
   * If bar is before bar 1 the first event's BPM is returned.
   */
  getBpmAtBar(bar: number): number {
    let bpm = this._events[0]!.bpm
    for (const event of this._events) {
      if (event.bar <= bar) {
        bpm = event.bpm
      } else {
        break
      }
    }
    return bpm
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  /**
   * Add or update a tempo event at the given bar.
   * Inserts in sorted order so the list stays ascending by bar number.
   */
  setTempo(bar: number, bpm: number): void {
    const clamped = clampBpm(bpm)
    const existing = this._events.find((e) => e.bar === bar)
    if (existing) {
      existing.bpm = clamped
      return
    }
    this._events.push({ bar, bpm: clamped })
    this._events.sort((a, b) => a.bar - b.bar)
  }

  /**
   * Remove the tempo event at the given bar.
   * Bar 1 cannot be removed — it always holds the default/initial tempo.
   */
  removeTempo(bar: number): void {
    if (bar === 1) return  // bar 1 is always present
    const idx = this._events.findIndex((e) => e.bar === bar)
    if (idx !== -1) this._events.splice(idx, 1)
  }

  // ── Conversion ───────────────────────────────────────────────────────────

  /**
   * Convert a bar position (1-based) to elapsed seconds from bar 1,
   * accounting for all tempo changes along the way.
   *
   * @param bar         - Target bar (1-based, fractional bars allowed)
   * @param timeSigTop  - Beats per bar (time signature numerator)
   */
  barToSeconds(bar: number, timeSigTop: number): number {
    if (bar <= 1) return 0

    let elapsed = 0
    let prevBar = 1
    let prevBpm = this._events[0]!.bpm

    for (const event of this._events) {
      if (event.bar <= 1) continue  // skip bar 1 (start)
      if (event.bar >= bar) break   // don't go past target

      // Accumulate seconds for segment [prevBar, event.bar)
      const segmentBars  = event.bar - prevBar
      const secondsPerBeat = 60.0 / prevBpm
      elapsed += segmentBars * timeSigTop * secondsPerBeat

      prevBar = event.bar
      prevBpm = event.bpm
    }

    // Final segment [prevBar, bar)
    const remainingBars  = bar - prevBar
    const secondsPerBeat = 60.0 / prevBpm
    elapsed += remainingBars * timeSigTop * secondsPerBeat

    return elapsed
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  toJSON(): TempoEvent[] {
    return this._events.map((e) => ({ ...e }))
  }

  fromJSON(events: TempoEvent[]): void {
    if (!Array.isArray(events) || events.length === 0) {
      this._events = [{ bar: 1, bpm: DEFAULT_BPM_TEMPO }]
      return
    }
    this._events = events
      .map((e) => ({ bar: e.bar, bpm: clampBpm(e.bpm) }))
      .sort((a, b) => a.bar - b.bar)

    // Ensure bar 1 is always present
    if (this._events[0]!.bar !== 1) {
      this._events.unshift({ bar: 1, bpm: DEFAULT_BPM_TEMPO })
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _tempoMap: TempoMap | null = null

export function getTempoMap(): TempoMap {
  if (!_tempoMap) _tempoMap = new TempoMap()
  return _tempoMap
}
