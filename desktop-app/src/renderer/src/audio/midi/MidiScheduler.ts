import type { PRNote } from '../../components/piano-roll/types'
import { MidiEngine } from './MidiEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchedulerOptions {
  lookaheadMs:    number   // default 50
  scheduleAheadMs: number  // default 100
  bpm:            number
  timeSigTop:     number
}

const DEFAULTS: SchedulerOptions = {
  lookaheadMs:     50,
  scheduleAheadMs: 100,
  bpm:             120,
  timeSigTop:      4,
}

// ─── MidiScheduler ────────────────────────────────────────────────────────────

export class MidiScheduler {
  private engine:         MidiEngine
  private options:        SchedulerOptions
  private intervalId:     ReturnType<typeof setInterval> | null = null
  private notes:          PRNote[] = []
  private scheduledIds:   Set<string> = new Set()
  private isPlaying:      boolean = false
  private startAudioTime: number  = 0
  private startBeat:      number  = 0

  // Cache AudioContext reference via engine for timing
  private audioCtx: AudioContext | null = null

  constructor(engine: MidiEngine, options?: Partial<SchedulerOptions>) {
    this.engine  = engine
    this.options = { ...DEFAULTS, ...options }
  }

  loadNotes(notes: PRNote[]): void {
    this.notes = notes
  }

  async start(fromBeat: number, audioContextTime: number): Promise<void> {
    await this.engine.init()
    // grab AudioContext via a one-off preview to get the shared ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.audioCtx = (this.engine as unknown as Record<string, unknown>)['audioCtx'] as AudioContext | null

    this.isPlaying      = true
    this.startBeat      = fromBeat
    this.startAudioTime = audioContextTime
    this.scheduledIds.clear()

    this.intervalId = setInterval(() => this._tick(), this.options.lookaheadMs)
    this._tick()  // immediate first tick
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isPlaying = false
    this.engine.cancelScheduled()
    this.scheduledIds.clear()
  }

  setBpm(bpm: number): void {
    this.options.bpm = bpm
    this.engine.setBpm(bpm)
  }

  getCurrentBeat(): number {
    if (!this.isPlaying || !this.audioCtx) return this.startBeat
    const elapsed = this.audioCtx.currentTime - this.startAudioTime
    return this.startBeat + elapsed * (this.options.bpm / 60)
  }

  private _tick(): void {
    if (!this.isPlaying || !this.audioCtx) return
    const { bpm, scheduleAheadMs } = this.options
    const secondsPerBeat    = 60 / bpm
    const scheduleAheadSec  = scheduleAheadMs / 1000
    const currentAudioTime  = this.audioCtx.currentTime
    const currentBeat       = this.startBeat + (currentAudioTime - this.startAudioTime) / secondsPerBeat
    const lookaheadEnd      = currentBeat + scheduleAheadSec / secondsPerBeat

    for (const note of this.notes) {
      if (this.scheduledIds.has(note.id)) continue
      if (note.startBeat < currentBeat - 0.001) continue  // already past
      if (note.startBeat >= lookaheadEnd) continue         // too far ahead

      const noteOnTime  = this.startAudioTime + (note.startBeat - this.startBeat) * secondsPerBeat
      const noteOffTime = noteOnTime + note.lengthBeats * secondsPerBeat
      const channel     = note.channel ?? 0

      const onDelay  = Math.max(0, noteOnTime  - currentAudioTime) * 1000
      const offDelay = Math.max(0, noteOffTime - currentAudioTime) * 1000

      this.scheduledIds.add(note.id)

      setTimeout(() => this.engine.noteOn(note.pitch, note.velocity, channel), onDelay)
      setTimeout(() => this.engine.noteOff(note.pitch, channel),               offDelay)
    }
  }
}
