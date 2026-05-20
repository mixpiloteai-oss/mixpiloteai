// ─── MIDI Real-time Monitor ───────────────────────────────────────────────────
// Real-time MIDI event monitoring and ghost-note prevention
//
// Features:
// - Active note tracking (prevents stuck/ghost notes)
// - Real-time event stream with circular buffer
// - All-notes-off panic button
// - MIDI activity metrics (notes/sec, channels used)
// - Event filtering and inspection

export interface MidiMonitorEvent {
  timestamp: number       // performance.now()
  type:      'note-on' | 'note-off' | 'cc' | 'pitch-bend' | 'program' | 'aftertouch'
  channel:   number
  data1:     number       // pitch/cc#/program
  data2:     number       // velocity/value
  source:    string       // device name or 'internal'
}

export interface MidiMetrics {
  totalEvents:    number
  notesPerSecond: number
  activeNotes:    number
  channelsActive: number[]
  lastEventAge:   number  // ms since last event
}

interface ActiveNote {
  pitch:     number
  channel:   number
  velocity:  number
  timestamp: number
  source:    string
}

const EVENT_BUFFER_SIZE = 1000
const STUCK_NOTE_TIMEOUT = 10_000  // 10 seconds

export class MidiMonitor {
  private events: MidiMonitorEvent[] = []
  private activeNotes: Map<string, ActiveNote> = new Map()
  private eventCount = 0
  private rateWindow: number[] = []  // timestamps of recent note events
  private lastEventTime = 0
  private listeners: Array<(evt: MidiMonitorEvent) => void> = []
  private stuckNoteInterval: number | null = null

  /**
   * Record a MIDI event. Returns the event for chaining.
   */
  record(evt: Omit<MidiMonitorEvent, 'timestamp'>): MidiMonitorEvent {
    const event: MidiMonitorEvent = {
      ...evt,
      timestamp: performance.now(),
    }

    this.events.push(event)
    if (this.events.length > EVENT_BUFFER_SIZE) {
      this.events.shift()
    }

    this.eventCount++
    this.lastEventTime = event.timestamp

    // Track active notes for ghost-note prevention
    if (event.type === 'note-on' && event.data2 > 0) {
      const key = `${event.channel}-${event.data1}`
      this.activeNotes.set(key, {
        pitch:     event.data1,
        channel:   event.channel,
        velocity:  event.data2,
        timestamp: event.timestamp,
        source:    event.source,
      })
      this.rateWindow.push(event.timestamp)
      this._pruneRateWindow()
    } else if (event.type === 'note-off' || (event.type === 'note-on' && event.data2 === 0)) {
      const key = `${event.channel}-${event.data1}`
      this.activeNotes.delete(key)
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try { listener(event) } catch { /* ignore */ }
    }

    return event
  }

  /**
   * Get all currently active (held) notes.
   */
  getActiveNotes(): ActiveNote[] {
    return Array.from(this.activeNotes.values())
  }

  /**
   * Check for stuck notes (held longer than timeout).
   * Returns the stuck notes for note-off issuing.
   */
  detectStuckNotes(timeoutMs = STUCK_NOTE_TIMEOUT): ActiveNote[] {
    const now = performance.now()
    const stuck: ActiveNote[] = []
    for (const note of this.activeNotes.values()) {
      if (now - note.timestamp > timeoutMs) {
        stuck.push(note)
      }
    }
    return stuck
  }

  /**
   * Clear stuck notes (call after issuing note-off messages).
   */
  clearStuckNotes(): number {
    const stuck = this.detectStuckNotes()
    for (const note of stuck) {
      const key = `${note.channel}-${note.pitch}`
      this.activeNotes.delete(key)
    }
    return stuck.length
  }

  /**
   * Start automatic stuck-note detection (runs every 5 seconds).
   */
  startStuckNoteWatchdog(
    onStuckNotes: (notes: ActiveNote[]) => void,
    intervalMs = 5_000,
  ): void {
    if (this.stuckNoteInterval !== null) return
    this.stuckNoteInterval = window.setInterval(() => {
      const stuck = this.detectStuckNotes()
      if (stuck.length > 0) {
        console.warn(`[midi-monitor] ${stuck.length} stuck note(s) detected`)
        onStuckNotes(stuck)
        this.clearStuckNotes()
      }
    }, intervalMs)
  }

  stopStuckNoteWatchdog(): void {
    if (this.stuckNoteInterval !== null) {
      clearInterval(this.stuckNoteInterval)
      this.stuckNoteInterval = null
    }
  }

  /**
   * Panic: clear all active notes (for emergency all-notes-off).
   */
  panic(): ActiveNote[] {
    const notes = Array.from(this.activeNotes.values())
    this.activeNotes.clear()
    return notes
  }

  /**
   * Get recent events (newest last).
   */
  getRecentEvents(limit = 50): MidiMonitorEvent[] {
    return this.events.slice(-limit)
  }

  /**
   * Filter events by type/channel.
   */
  filterEvents(filter: {
    types?: MidiMonitorEvent['type'][]
    channels?: number[]
    sinceMs?: number
  }): MidiMonitorEvent[] {
    const now = performance.now()
    return this.events.filter(e => {
      if (filter.types && !filter.types.includes(e.type)) return false
      if (filter.channels && !filter.channels.includes(e.channel)) return false
      if (filter.sinceMs && now - e.timestamp > filter.sinceMs) return false
      return true
    })
  }

  /**
   * Get monitoring metrics.
   */
  getMetrics(): MidiMetrics {
    this._pruneRateWindow()
    const channels = new Set<number>()
    for (const note of this.activeNotes.values()) {
      channels.add(note.channel)
    }

    return {
      totalEvents:    this.eventCount,
      notesPerSecond: this.rateWindow.length,
      activeNotes:    this.activeNotes.size,
      channelsActive: Array.from(channels).sort((a, b) => a - b),
      lastEventAge:   performance.now() - this.lastEventTime,
    }
  }

  /**
   * Subscribe to real-time events.
   */
  subscribe(listener: (evt: MidiMonitorEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  /**
   * Clear all event history (keep active notes).
   */
  clearHistory(): void {
    this.events = []
    this.eventCount = 0
    this.rateWindow = []
  }

  private _pruneRateWindow(): void {
    const cutoff = performance.now() - 1000  // last second
    this.rateWindow = this.rateWindow.filter(t => t > cutoff)
  }
}

export const midiMonitor = new MidiMonitor()
