/**
 * Transport — high-level playback controller
 *
 * Wraps Clock and exposes the API used by the transport store and UI.
 * Separates beat-scheduling concerns (Clock) from transport-state concerns.
 *
 *   Clock            — sample-accurate beat firing
 *   Transport        — play/stop/record/loop state + bar/beat display
 *   transportStore   — Zustand UI state driven by Transport events
 */

import type {
  TransportSnapshot, BeatPosition,
  BeatCallback, BarCallback, StateCallback, Unsubscribe,
} from './types'
import { DEFAULT_BPM } from './types'
import { AudioEngine } from './AudioEngine'
import { Clock } from './Clock'

// Coordinator interface — avoids circular import from ClipPlaybackCoordinator
interface ICoordinator {
  start(): void
  stop(): void
  seek(bar: number): void
  setSwing(amount: number): void
}

export class Transport {
  readonly clock: Clock

  private _playing   = false
  private _recording = false
  private _looping   = false

  private _loopStartBar = 1
  private _loopEndBar   = 9

  private _beatCallbacks:  Set<BeatCallback>  = new Set()
  private _barCallbacks:   Set<BarCallback>   = new Set()
  private _stateCallbacks: Set<StateCallback> = new Set()

  private _coordinator: ICoordinator | null = null

  private _clockUnsub: Unsubscribe

  /** Register the ClipPlaybackCoordinator (called from audio/index.ts after init). */
  setCoordinator(c: ICoordinator): void {
    this._coordinator = c
  }

  constructor(engine: AudioEngine) {
    this.clock  = new Clock(engine)
    this.clock.bpm = DEFAULT_BPM

    // Relay clock beats to transport subscribers
    this._clockUnsub = this.clock.onBeat((beatIdx, scheduledTime, pos) => {
      for (const cb of this._beatCallbacks) cb(beatIdx, scheduledTime, pos)

      // Fire bar event on beat 1 of each bar
      if (pos.beat === 1) {
        for (const cb of this._barCallbacks) cb(pos.bar, scheduledTime)
      }
    })
  }

  // ── Transport controls ───────────────────────────────────────────────────

  play(): void {
    if (this._playing) return
    this._playing = true
    this.clock.start(this._positionBeat())
    this._coordinator?.start()
    this._emitState()
  }

  stop(): void {
    if (!this._playing && !this._recording) return
    this._coordinator?.stop()
    this._playing   = false
    this._recording = false
    this.clock.stop()
    this._emitState()
  }

  seekToBar(bar: number): void {
    const wasPlaying = this._playing
    if (wasPlaying) {
      this._coordinator?.stop()
      this.clock.stop()
    }
    this.clock.seekToBar(bar)
    if (wasPlaying) {
      this.clock.start(this._absoluteBeat())
      this._coordinator?.seek(bar)
      this._coordinator?.start()
    } else {
      this._coordinator?.seek(bar)
    }
    this._emitState()
  }

  setSwing(amount: number): void {
    this.clock.setSwing(amount)
    this._coordinator?.setSwing(amount)
  }

  /** Pause: freeze position without resetting to bar 1. */
  pause(): void {
    if (!this._playing) return
    // Save beat position so resume starts from here
    const beat      = this._absoluteBeat()
    this._playing   = false
    this.clock.stop()
    // Rewind clock state to paused position
    this.clock.seekToBar(Math.floor(beat / this.clock.timeSigTop) + 1)
    this._emitState()
  }

  toggleRecord(): void {
    this._recording = !this._recording
    this._emitState()
  }

  toggleLoop(): void {
    this._looping = !this._looping
    this.clock.setLoop(this._looping, this._loopStartBar, this._loopEndBar)
    this._emitState()
  }

  setLoopRegion(startBar: number, endBar: number): void {
    this._loopStartBar = startBar
    this._loopEndBar   = endBar
    if (this._looping) {
      this.clock.setLoop(true, startBar, endBar)
    }
    this._emitState()
  }

  // ── BPM / time signature ─────────────────────────────────────────────────

  get bpm(): number { return this.clock.bpm }
  set bpm(v: number) { this.clock.bpm = v; this._emitState() }

  nudgeBpm(delta: number): void { this.clock.bpm += delta; this._emitState() }

  setTimeSignature(top: number, bottom: number): void {
    this.clock.setTimeSignature(top, bottom)
    this._emitState()
  }

  get timeSigTop():    number { return this.clock.timeSigTop }
  get timeSigBottom(): number { return this.clock.timeSigBottom }

  // ── State snapshot ───────────────────────────────────────────────────────

  get playing():   boolean { return this._playing }
  get recording(): boolean { return this._recording }
  get looping():   boolean { return this._looping }

  /** Live position — call from rAF loop, not from Zustand getter. */
  getPosition(): BeatPosition { return this.clock.position }

  snapshot(): TransportSnapshot {
    return {
      playing:            this._playing,
      recording:          this._recording,
      looping:            this._looping,
      bpm:                this.clock.bpm,
      timeSignatureTop:   this.clock.timeSigTop,
      timeSignatureBottom:this.clock.timeSigBottom,
      loopStartBar:       this._loopStartBar,
      loopEndBar:         this._loopEndBar,
      position:           this.clock.position,
    }
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

  onBeat(cb: BeatCallback): Unsubscribe {
    this._beatCallbacks.add(cb)
    return () => this._beatCallbacks.delete(cb)
  }

  onBar(cb: BarCallback): Unsubscribe {
    this._barCallbacks.add(cb)
    return () => this._barCallbacks.delete(cb)
  }

  onStateChange(cb: StateCallback): Unsubscribe {
    this._stateCallbacks.add(cb)
    return () => this._stateCallbacks.delete(cb)
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private _emitState(): void {
    const snap = this.snapshot()
    for (const cb of this._stateCallbacks) cb(snap)
  }

  private _absoluteBeat(): number {
    const pos = this.clock.position
    return (pos.bar - 1) * this.clock.timeSigTop + (pos.beat - 1)
  }

  private _positionBeat(): number {
    // When not playing, start from bar 1
    return this._playing ? this._absoluteBeat() : 0
  }

  dispose(): void {
    this._clockUnsub()
    this.clock.stop()
    this._beatCallbacks.clear()
    this._barCallbacks.clear()
    this._stateCallbacks.clear()
  }
}
