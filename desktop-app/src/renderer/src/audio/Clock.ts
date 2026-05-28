/**
 * Clock — high-precision beat scheduler
 *
 * Implements the "Chris Wilson Web Audio scheduler" pattern:
 *   - setInterval fires every SCHEDULER_MS (coarse timer, ~25 ms)
 *   - Each tick schedules all beats that fall within the next
 *     SCHEDULER_AHEAD seconds using AudioContext.currentTime
 *   - Callbacks receive the exact AudioContext timestamp so downstream
 *     nodes (metronome oscillators, sample triggers) are sample-accurate
 *
 * This architecture is used by every production Web Audio DAW/sequencer
 * because AudioContext.currentTime is monotonic and sample-accurate,
 * while JS timers are not.
 *
 * Future migration path to native engine:
 *   Replace setInterval with an IPC message from the Rust audio thread
 *   that already knows the next beat timestamp. The callback signature
 *   stays identical.
 */

import type { BeatPosition, BeatCallback, Unsubscribe } from './types'
import {
  MIN_BPM, MAX_BPM, DEFAULT_BPM,
  TICKS_PER_BEAT, SCHEDULER_AHEAD, SCHEDULER_MS,
} from './types'
import { AudioEngine } from './AudioEngine'

export class Clock {
  private readonly engine: AudioEngine

  // BPM / time signature
  private _bpm              = DEFAULT_BPM
  private _timeSigTop       = 4
  private _timeSigBottom    = 4

  // Scheduler state
  private _running          = false
  private _intervalId: ReturnType<typeof setInterval> | null = null
  private _nextBeatTime     = 0   // AudioContext.currentTime of next scheduled beat
  private _beatIndex        = 0   // absolute beat counter since last start/seek

  // AudioWorklet scheduler (replaces setInterval for lower jitter)
  private _workletNode: AudioWorkletNode | null = null
  private _workletSilencer: GainNode | null = null
  private _workletReady     = false

  // Loop region (in beats, 0-based)
  private _loopEnabled      = false
  private _loopStartBeat    = 0
  private _loopEndBeat      = 32  // 8 bars × 4 beats default

  // Start reference: AudioContext time when beat 0 occurred
  private _originTime       = 0

  private _beatCallbacks    = new Set<BeatCallback>()

  // Swing amount 0.0 = none, 0.5 = full triplet swing
  private _swing            = 0

  constructor(engine: AudioEngine) {
    this.engine = engine
  }

  // ── Getters / setters ────────────────────────────────────────────────────

  get bpm(): number { return this._bpm }
  set bpm(v: number) {
    this._bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, v))
    // Don't reset _nextBeatTime; drift correction happens naturally
  }

  get timeSigTop(): number { return this._timeSigTop }
  get timeSigBottom(): number { return this._timeSigBottom }

  setTimeSignature(top: number, bottom: number): void {
    this._timeSigTop    = top
    this._timeSigBottom = bottom
  }

  get isRunning(): boolean { return this._running }

  /** Seconds per beat at current BPM. */
  get secondsPerBeat(): number { return 60.0 / this._bpm }

  /**
   * Elapsed seconds since playback started (or since seek point).
   * Safe to call from requestAnimationFrame.
   */
  get positionSec(): number {
    if (!this._running) return 0
    return Math.max(0, this.engine.currentTime - this._originTime)
  }

  /** Current bar/beat/tick derived from positionSec (for display). */
  get position(): BeatPosition {
    const totalBeats = this.positionSec / this.secondsPerBeat
    const bar        = Math.floor(totalBeats / this._timeSigTop)
    const beatInBar  = Math.floor(totalBeats % this._timeSigTop)
    const fracBeat   = totalBeats - Math.floor(totalBeats)
    const tick       = Math.floor(fracBeat * TICKS_PER_BEAT)
    return { bar: bar + 1, beat: beatInBar + 1, tick }
  }

  // ── Control ──────────────────────────────────────────────────────────────

  start(fromBeat = 0): void {
    if (this._running) return
    this._beatIndex   = fromBeat
    this._originTime  = this.engine.currentTime - fromBeat * this.secondsPerBeat
    this._nextBeatTime = this.engine.currentTime
    this._running     = true
    this.engine.resume()

    // Always start setInterval as fallback; worklet init may clear it
    this._intervalId = setInterval(() => this._tick(), SCHEDULER_MS)

    // Attempt to upgrade to AudioWorklet scheduler (non-blocking)
    this._initWorklet().catch(() => { /* keep setInterval fallback */ })
  }

  stop(): void {
    this._running = false
    if (this._intervalId !== null) {
      clearInterval(this._intervalId)
      this._intervalId = null
    }
    if (this._workletNode) {
      this._workletNode.port.postMessage({ type: 'reset' })
    }
    this._beatIndex    = 0
    this._nextBeatTime = 0
    this._originTime   = 0
  }

  /** Seek to a specific bar (1-based) while stopped. */
  seekToBar(bar: number): void {
    if (this._running) return   // seek only when stopped
    const beat       = (bar - 1) * this._timeSigTop
    this._beatIndex  = beat
    this._originTime = 0
  }

  /**
   * Set swing amount.
   * amount = 0.0: straight timing (no swing)
   * amount = 0.33: light swing (~light triplet feel)
   * amount = 0.5: full triplet swing (beat delayed by half a beat-subdivision)
   *
   * Off-beats (beat indices where beatIndex % 2 !== 0) are shifted forward
   * by `amount * secondsPerBeat / 2`. This creates the classic "long-short"
   * swing feel.
   */
  setSwing(amount: number): void {
    this._swing = Math.max(0, Math.min(1, amount))
  }

  get swing(): number { return this._swing }

  setLoop(enabled: boolean, startBar: number, endBar: number): void {
    this._loopEnabled   = enabled
    this._loopStartBeat = (startBar - 1) * this._timeSigTop
    this._loopEndBeat   = (endBar - 1)   * this._timeSigTop
  }

  // ── Callbacks ────────────────────────────────────────────────────────────

  onBeat(cb: BeatCallback): Unsubscribe {
    this._beatCallbacks.add(cb)
    return () => this._beatCallbacks.delete(cb)
  }

  // ── AudioWorklet initialisation ──────────────────────────────────────────

  private async _initWorklet(): Promise<void> {
    if (this._workletReady) return
    const ctx = this.engine.ctx

    // Build URL for the processor file via Vite's import.meta.url pattern
    const schedulerUrl = new URL('./worklets/scheduler-processor.js', import.meta.url).href
    await ctx.audioWorklet.addModule(schedulerUrl)

    this._workletNode = new AudioWorkletNode(ctx, 'scheduler-processor', {
      processorOptions: { intervalMs: SCHEDULER_MS },
    })

    // Connect through a silent gain node to keep the worklet alive
    this._workletSilencer = ctx.createGain()
    this._workletSilencer.gain.value = 0
    this._workletNode.connect(this._workletSilencer)
    this._workletSilencer.connect(ctx.destination)

    this._workletNode.port.onmessage = (e) => {
      if (e.data?.type === 'tick') this._onWorkletTick()
    }

    // Worklet ready — clear the setInterval fallback
    this._workletReady = true
    console.info('[Clock] AudioWorklet scheduler active — setInterval fallback disabled')
    if (this._intervalId !== null) {
      clearInterval(this._intervalId)
      this._intervalId = null
    }
  }

  /** Called from AudioWorklet message (high-precision path). */
  private _onWorkletTick(): void {
    if (!this._running) return
    this._tick()
  }

  // ── Internal scheduler ───────────────────────────────────────────────────

  private _tick(): void {
    const horizon = this.engine.currentTime + SCHEDULER_AHEAD

    while (this._nextBeatTime < horizon) {
      this._fireBeat(this._beatIndex, this._nextBeatTime)
      this._advance()
    }
  }

  private _fireBeat(beatIndex: number, scheduledTime: number): void {
    const bar       = Math.floor(beatIndex / this._timeSigTop)
    const beatInBar = beatIndex % this._timeSigTop
    const pos: BeatPosition = { bar: bar + 1, beat: beatInBar + 1, tick: 0 }

    // Apply swing: delay off-beats (odd beat index) by swingAmount * halfBeat
    const isOffBeat    = beatIndex % 2 !== 0
    const swingOffset  = isOffBeat ? this._swing * this.secondsPerBeat * 0.5 : 0
    const swungTime    = scheduledTime + swingOffset

    for (const cb of this._beatCallbacks) {
      try { cb(beatIndex, swungTime, pos) }
      catch (err) { console.error('[Clock] beat callback threw:', err) }
    }
  }

  private _advance(): void {
    this._nextBeatTime += this.secondsPerBeat
    this._beatIndex++

    // Loop wrap
    if (this._loopEnabled && this._beatIndex >= this._loopEndBeat) {
      const loopLenBeats = this._loopEndBeat - this._loopStartBeat
      this._beatIndex    = this._loopStartBeat

      // Reset timing reference so display position wraps correctly
      this._originTime   = this._nextBeatTime - this._loopStartBeat * this.secondsPerBeat

      // Note: _nextBeatTime keeps advancing monotonically in AudioContext
      // time — we don't reset it. The origin shift handles display.
      // This prevents audio clicks from source node restarts.
      void loopLenBeats
    }
  }
}
