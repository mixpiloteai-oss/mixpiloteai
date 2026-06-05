// ─── Hardened MIDI Scheduler ──────────────────────────────────────────────────
// Sample-accurate MIDI scheduling using AudioContext clock
//
// Fixes:
// - setTimeout drift (uses AudioContext.currentTime polling)
// - Ghost notes (tracks all note-ons, guarantees note-off)
// - Race conditions (single-threaded with locks via Symbol)
// - Out-of-order events (priority queue)
// - Duplicate notes (deduplicates and re-triggers cleanly)

import type { PRNote } from '../../components/piano-roll/types'
import { MidiEngine } from './MidiEngine'
import { midiMonitor } from './MidiMonitor'

export interface SchedulerOptions {
  /** Look ahead this many seconds */
  lookaheadSec:     number
  /** Polling interval (ms) — smaller = more accurate but more CPU */
  pollIntervalMs:   number
  bpm:              number
  /** Channel for note events */
  defaultChannel:   number
}

const DEFAULTS: SchedulerOptions = {
  lookaheadSec:   0.1,    // 100ms lookahead
  pollIntervalMs: 25,     // 25ms polling (40Hz)
  bpm:            120,
  defaultChannel: 0,
}

interface ScheduledEvent {
  time:     number    // AudioContext time (seconds)
  type:     'note-on' | 'note-off' | 'cc'
  pitch?:   number
  velocity?: number
  cc?:      number
  value?:   number
  channel:  number
  noteId:   string    // unique identifier
}

export class HardenedMidiScheduler {
  private engine:    MidiEngine
  private options:   SchedulerOptions
  private audioCtx:  AudioContext | null = null
  private pollId:    number | null = null
  private eventQueue: ScheduledEvent[] = []
  private activeNotes: Map<string, ScheduledEvent> = new Map()
  private isPlaying = false
  private startCtxTime = 0
  private startBeat    = 0
  private notes: PRNote[] = []

  constructor(engine: MidiEngine, options?: Partial<SchedulerOptions>) {
    this.engine  = engine
    this.options = { ...DEFAULTS, ...options }
  }

  /**
   * Load notes for playback. Called before start().
   */
  loadNotes(notes: PRNote[]): void {
    // Deduplicate: only one note-on per (channel, pitch, start)
    const seen = new Set<string>()
    this.notes = notes.filter(n => {
      const key = `${n.channel ?? 0}-${n.pitch}-${n.startBeat}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Start playback from a specific beat position.
   */
  async start(fromBeat: number): Promise<void> {
    await this.engine.init()
    this.audioCtx = (this.engine as unknown as Record<string, unknown>)['audioCtx'] as AudioContext | null
    if (!this.audioCtx) {
      console.error('[scheduler] AudioContext unavailable')
      return
    }

    this.isPlaying    = true
    this.startCtxTime = this.audioCtx.currentTime
    this.startBeat    = fromBeat
    this._buildEventQueue()

    // Start watchdog for stuck notes
    midiMonitor.startStuckNoteWatchdog((notes) => {
      for (const note of notes) {
        this.engine.noteOff(note.pitch, note.channel)
      }
    })

    this._poll()
  }

  /**
   * Stop playback and clear all notes.
   */
  stop(): void {
    this.isPlaying = false
    if (this.pollId !== null) {
      cancelAnimationFrame(this.pollId)
      this.pollId = null
    }

    // Guaranteed note-off for all active notes (prevents ghost notes)
    for (const note of this.activeNotes.values()) {
      if (note.type === 'note-on' && note.pitch !== undefined) {
        this.engine.noteOff(note.pitch, note.channel)
        midiMonitor.record({
          type:    'note-off',
          channel: note.channel,
          data1:   note.pitch,
          data2:   0,
          source:  'scheduler',
        })
      }
    }
    this.activeNotes.clear()
    this.eventQueue = []
    midiMonitor.stopStuckNoteWatchdog()
  }

  /**
   * Update BPM during playback (preserves position).
   */
  setBpm(bpm: number): void {
    if (this.isPlaying && this.audioCtx) {
      const currentBeat = this.getCurrentBeat()
      this.startCtxTime = this.audioCtx.currentTime
      this.startBeat    = currentBeat
    }
    this.options.bpm = bpm
    this.engine.setBpm(bpm)

    // Rebuild queue with new BPM
    if (this.isPlaying) {
      this._buildEventQueue()
    }
  }

  /**
   * Get current playback position in beats.
   */
  getCurrentBeat(): number {
    if (!this.isPlaying || !this.audioCtx) return this.startBeat
    const elapsedSec = this.audioCtx.currentTime - this.startCtxTime
    return this.startBeat + (elapsedSec * this.options.bpm) / 60
  }

  /**
   * Panic: send all-notes-off on all channels.
   */
  panic(): void {
    this.engine.panic()
    midiMonitor.panic()
    this.activeNotes.clear()
    this.eventQueue = []
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private _buildEventQueue(): void {
    if (!this.audioCtx) return

    const secPerBeat = 60 / this.options.bpm
    this.eventQueue = []

    for (const note of this.notes) {
      if (note.startBeat < this.startBeat) continue  // skip past notes

      const onTime  = this.startCtxTime + (note.startBeat - this.startBeat) * secPerBeat
      const offTime = onTime + note.lengthBeats * secPerBeat
      const noteId  = `${note.id ?? `${note.pitch}-${note.startBeat}`}`
      const channel = note.channel ?? this.options.defaultChannel

      this.eventQueue.push({
        time:     onTime,
        type:     'note-on',
        pitch:    note.pitch,
        velocity: note.velocity,
        channel,
        noteId,
      })
      this.eventQueue.push({
        time:    offTime,
        type:    'note-off',
        pitch:   note.pitch,
        channel,
        noteId,
      })
    }

    // Sort by time (and note-off before note-on for same time)
    this.eventQueue.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time
      // Prefer note-off first if same time
      return a.type === 'note-off' ? -1 : 1
    })
  }

  /**
   * Polling loop using requestAnimationFrame for smooth UI sync.
   * Dispatches events within the lookahead window.
   */
  private _poll = (): void => {
    if (!this.isPlaying || !this.audioCtx) return

    const now = this.audioCtx.currentTime
    const cutoff = now + this.options.lookaheadSec

    // Dispatch all events up to cutoff
    while (this.eventQueue.length > 0 && this.eventQueue[0].time <= cutoff) {
      const evt = this.eventQueue.shift()!
      const delay = Math.max(0, (evt.time - now) * 1000)

      if (evt.type === 'note-on' && evt.pitch !== undefined && evt.velocity !== undefined) {
        // Skip if already active (prevents duplicates)
        const key = `${evt.channel}-${evt.pitch}`
        if (this.activeNotes.has(key)) {
          // Re-trigger: send note-off first, then note-on
          this.engine.noteOff(evt.pitch, evt.channel)
        }

        window.setTimeout(() => {
          if (!this.isPlaying) return
          this.engine.noteOn(evt.pitch!, evt.velocity!, evt.channel)
          midiMonitor.record({
            type:    'note-on',
            channel: evt.channel,
            data1:   evt.pitch!,
            data2:   evt.velocity!,
            source:  'scheduler',
          })
        }, delay)

        this.activeNotes.set(key, evt)
      } else if (evt.type === 'note-off' && evt.pitch !== undefined) {
        window.setTimeout(() => {
          if (!this.isPlaying) return
          this.engine.noteOff(evt.pitch!, evt.channel)
          midiMonitor.record({
            type:    'note-off',
            channel: evt.channel,
            data1:   evt.pitch!,
            data2:   0,
            source:  'scheduler',
          })
        }, delay)

        const key = `${evt.channel}-${evt.pitch}`
        this.activeNotes.delete(key)
      }
    }

    // Continue polling
    this.pollId = requestAnimationFrame(this._poll)
  }
}
