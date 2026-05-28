/**
 * ClipPlaybackCoordinator — connects Transport beats to clip notes to MidiTrackNode
 *
 * This is the missing link that makes clips actually play audio:
 *   Transport (beat ticks) → ClipPlaybackCoordinator → MidiTrackNode.noteOn/noteOff
 *
 * Design:
 *   - Subscribes to Clock onBeat callbacks (same pattern as MetronomeEngine)
 *   - Each beat tick, scans all MIDI tracks for clips whose time range overlaps the
 *     current lookahead window
 *   - For each active clip, schedules notes via MidiTrackNode using absolute AudioContext times
 *   - Handles loop boundary truncation, note-off at clip end, flush on stop/seek
 *
 * Critical formulas (matching spec exactly):
 *   absoluteBeat      = (clip.startBar - 1) * timeSigNumerator + note.startBeat
 *   noteAudioTime     = audioCtx.currentTime + (absoluteBeat - currentAbsoluteBeat) / (bpm / 60)
 *   currentAbsoluteBeat = beatIdx (absolute beat counter from Clock)
 *   clipEndBeat       = (clip.startBar - 1) * timeSigNumerator + clip.lengthBars * timeSigNumerator
 *   effectiveDuration = min(note.lengthBeats, clipEndBeat - absoluteBeat)
 *   noteOffTime       = noteAudioTime + effectiveDuration / (bpm / 60)
 *
 * The coordinator uses a deduplication set so notes are only scheduled once per
 * note-ID even if beats overlap with the lookahead window multiple times.
 */

import type { Unsubscribe } from './types'
import { SCHEDULER_AHEAD }  from './types'
import type { Transport }   from './Transport'
import type { TrackManager } from './tracks/TrackManager'
import { MidiTrackNode }    from './tracks/MidiTrackNode'
import { useProjectStore }  from '../store/projectStore'

// ─── ClipPlaybackCoordinator ─────────────────────────────────────────────────

export class ClipPlaybackCoordinator {
  private readonly transport:    Transport
  private readonly trackManager: TrackManager

  // Beat subscription cleanup
  private _clockUnsub: Unsubscribe | null = null

  // Track which (noteId, trackId) combos have already been scheduled this
  // playback session to avoid duplicates in the lookahead window
  private _scheduled: Set<string> = new Set()

  // Notes currently sounding (for allNotesOff on flush)
  private _activeNoteIds: Map<string, { trackId: string; pitch: number }> = new Map()

  // Pending timeouts for cancellation
  private _pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set()

  // Swing amount (0.0 = none, 0.5 = full triplet)
  private _swingAmount = 0

  constructor(transport: Transport, trackManager: TrackManager) {
    this.transport    = transport
    this.trackManager = trackManager
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Subscribe to clock beats and begin scheduling notes. */
  start(): void {
    if (this._clockUnsub) return  // already running
    this._scheduled.clear()
    this._clockUnsub = this.transport.onBeat((beatIdx, scheduledTime, _pos) => {
      this._onBeat(beatIdx, scheduledTime)
    })
  }

  /** Flush all scheduled notes and unsubscribe from clock. */
  stop(): void {
    if (this._clockUnsub) {
      this._clockUnsub()
      this._clockUnsub = null
    }
    this._flush()
  }

  /** Flush and clear dedup state when playhead jumps. */
  seek(_bar: number): void {
    this._flush()
    this._scheduled.clear()
  }

  /** Set swing amount (0.0–1.0, where 0.5 = full triplet swing). */
  setSwing(amount: number): void {
    this._swingAmount = Math.max(0, Math.min(1, amount))
    this.transport.clock.setSwing(this._swingAmount)
  }

  // ── Internal: beat handler ────────────────────────────────────────────────

  /**
   * Called on every beat tick from the Clock.
   *
   * beatIdx        — absolute beat index since playback started (0-based)
   * scheduledTime  — exact AudioContext time when this beat fires (may be slightly ahead)
   *
   * We look ahead SCHEDULER_AHEAD seconds from scheduledTime and schedule
   * all notes in that window across all active clips.
   */
  private _onBeat(beatIdx: number, scheduledTime: number): void {
    const project  = useProjectStore.getState().project
    const bpm      = this.transport.bpm
    const tsTop    = this.transport.timeSigTop
    // Access AudioContext via clock engine (private field access — safe internal coupling)
    const engine   = (this.transport.clock as unknown as { engine: { ctx: AudioContext } }).engine
    const audioCtx = engine.ctx

    // Current absolute beat position corresponds to beatIdx
    const currentAbsoluteBeat = beatIdx

    // Convert the lookahead window from seconds to beats
    const secPerBeat     = 60 / bpm
    const lookaheadBeats = SCHEDULER_AHEAD / secPerBeat

    const windowStart = currentAbsoluteBeat
    const windowEnd   = currentAbsoluteBeat + lookaheadBeats

    for (const track of project.tracks) {
      if (track.type !== 'midi') continue
      if (track.muted) continue

      const node = this.trackManager.getTrack(track.id)
      if (!(node instanceof MidiTrackNode)) continue

      for (const clip of track.clips) {
        if (clip.muted) continue

        // Clip time range in absolute beats (bars are 1-indexed)
        // absoluteBeat = (clip.startBar - 1) * timeSigNumerator + note.startBeat
        const clipStartBeat = (clip.startBar - 1) * tsTop
        const clipEndBeat   = clipStartBeat + clip.lengthBars * tsTop

        // Skip clips entirely outside lookahead window
        if (clipEndBeat <= windowStart) continue
        if (clipStartBeat >= windowEnd) continue

        // Schedule notes within this clip that fall in the window
        for (const note of clip.notes) {
          // Note position in absolute beats
          const absoluteBeat = clipStartBeat + note.startBeat

          // Skip notes outside the lookahead window
          if (absoluteBeat < windowStart || absoluteBeat >= windowEnd) continue

          // Dedup: only schedule each note once per playback session
          const dedupKey = `${track.id}:${clip.id}:${note.id}:${Math.floor(absoluteBeat * 1000)}`
          if (this._scheduled.has(dedupKey)) continue
          this._scheduled.add(dedupKey)

          // Calculate exact AudioContext time for this note
          // noteAudioTime = audioCtx.currentTime + (absoluteBeat - currentAbsoluteBeat) / (bpm / 60)
          const beatOffset  = absoluteBeat - currentAbsoluteBeat
          const noteOnTime  = scheduledTime + beatOffset * secPerBeat

          // Clamp note-off to clip boundary
          // effectiveDuration = min(note.lengthBeats, clipEndBeat - absoluteBeat)
          const effectiveDuration = Math.min(note.lengthBeats, clipEndBeat - absoluteBeat)
          if (effectiveDuration <= 0) continue
          const noteOffTime = noteOnTime + effectiveDuration * secPerBeat

          // Skip if note is already past (safety check)
          const now = audioCtx.currentTime
          if (noteOffTime < now) continue

          // Schedule via MidiTrackNode using setTimeout-based scheduling
          this._scheduleNote(node, track.id, note.id, note.pitch, note.velocity, noteOnTime, noteOffTime, now)
        }
      }
    }
  }

  /** Schedule a single note-on + note-off via setTimeout. */
  private _scheduleNote(
    node:     MidiTrackNode,
    trackId:  string,
    noteId:   string,
    pitch:    number,
    velocity: number,
    onTime:   number,
    offTime:  number,
    now:      number,
  ): void {
    const onDelayMs  = Math.max(0, (onTime  - now) * 1000)
    const offDelayMs = Math.max(0, (offTime - now) * 1000)

    const activeKey = `${trackId}:${noteId}`

    const tOn = setTimeout(() => {
      node.noteOn(pitch, velocity)
      this._activeNoteIds.set(activeKey, { trackId, pitch })
      this._pendingTimeouts.delete(tOn)
    }, onDelayMs)

    const tOff = setTimeout(() => {
      node.noteOff(pitch)
      this._activeNoteIds.delete(activeKey)
      this._pendingTimeouts.delete(tOff)
    }, offDelayMs)

    // Store timeout IDs so we can cancel them on flush
    this._pendingTimeouts.add(tOn)
    this._pendingTimeouts.add(tOff)
  }

  /** Cancel all pending note events and send note-off to all active voices. */
  private _flush(): void {
    // Cancel all pending timeouts
    for (const t of this._pendingTimeouts) clearTimeout(t)
    this._pendingTimeouts.clear()

    // Send note-off to all currently active voices
    for (const [, { trackId, pitch }] of this._activeNoteIds) {
      const node = this.trackManager.getTrack(trackId)
      if (node instanceof MidiTrackNode) {
        node.noteOff(pitch)
      }
    }
    this._activeNoteIds.clear()
  }

  dispose(): void {
    this.stop()
  }
}

// ─── Preview playback (for Piano Roll) ───────────────────────────────────────

/**
 * Lightweight one-shot preview scheduler for piano roll.
 * Schedules the provided notes starting immediately and plays them once.
 */
export class PreviewScheduler {
  private _node:             MidiTrackNode
  private _pendingTimeouts:  Set<ReturnType<typeof setTimeout>> = new Set()
  private _activeVoices:     Set<number>   = new Set()   // pitches currently on
  private _running           = false

  constructor(node: MidiTrackNode) {
    this._node = node
  }

  /**
   * Schedule all notes starting from audioCtx.currentTime.
   * bpm and timeSigTop are needed to convert beat positions to seconds.
   */
  play(
    notes:    Array<{ pitch: number; velocity: number; startBeat: number; lengthBeats: number }>,
    bpm:      number,
  ): void {
    this.stop()
    this._running = true
    const secPerBeat = 60 / bpm

    for (const note of notes) {
      const onDelayMs  = note.startBeat * secPerBeat * 1000
      const offDelayMs = (note.startBeat + note.lengthBeats) * secPerBeat * 1000

      const tOn = setTimeout(() => {
        if (!this._running) return
        this._node.noteOn(note.pitch, note.velocity)
        this._activeVoices.add(note.pitch)
        this._pendingTimeouts.delete(tOn)
      }, onDelayMs)

      const tOff = setTimeout(() => {
        if (!this._running) return
        this._node.noteOff(note.pitch)
        this._activeVoices.delete(note.pitch)
        this._pendingTimeouts.delete(tOff)
      }, offDelayMs)

      this._pendingTimeouts.add(tOn)
      this._pendingTimeouts.add(tOff)
    }
  }

  stop(): void {
    this._running = false
    for (const t of this._pendingTimeouts) clearTimeout(t)
    this._pendingTimeouts.clear()
    for (const pitch of this._activeVoices) this._node.noteOff(pitch)
    this._activeVoices.clear()
  }

  get isPlaying(): boolean { return this._running && this._pendingTimeouts.size > 0 }

  dispose(): void { this.stop() }
}
