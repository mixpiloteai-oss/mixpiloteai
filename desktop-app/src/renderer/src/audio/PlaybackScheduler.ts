/**
 * PlaybackScheduler — real-time scheduling coordinator with drift metrics.
 *
 * Wraps ClipPlaybackCoordinator and AudioClipPlaybackEngine with:
 *   - Drift measurement: compares AudioContext.currentTime vs wall-clock expectation
 *   - Underrun detection: fires callback when AudioContext time stalls
 *   - Jitter tracking: rolling average of scheduler wake-up jitter
 *
 * Usage:
 *   const sched = new PlaybackScheduler(transport, trackManager, waveformLoader)
 *   sched.start()
 *   sched.onUnderrun(cb)
 *   console.log(sched.getJitterMs())
 */

import type { Transport }         from './Transport'
import type { TrackManager }      from './tracks/TrackManager'
import type { WaveformLoader }    from './WaveformLoader'
import { ClipPlaybackCoordinator } from './ClipPlaybackCoordinator'
import { AudioClipPlaybackEngine } from './AudioClipPlaybackEngine'

const UNDERRUN_THRESHOLD_MS = 20   // stall > 20ms considered an underrun
const JITTER_WINDOW         = 32   // rolling window for jitter average

export interface SchedulerMetrics {
  driftMs:        number   // current drift vs expected AudioContext time
  jitterMs:       number   // average scheduler wake-up jitter (rolling)
  underrunCount:  number   // total underrun events since last reset
  isPlaying:      boolean
}

export class PlaybackScheduler {
  private readonly _coordinator:   ClipPlaybackCoordinator
  private readonly _audioEngine:   AudioClipPlaybackEngine
  private readonly _transport:     Transport

  private _underrunCount  = 0
  private _underrunCbs:   ((count: number) => void)[] = []
  private _jitterSamples: number[] = []
  private _lastWakeTime   = 0
  private _rafId:         number | null = null
  private _isPlaying      = false

  constructor(transport: Transport, trackManager: TrackManager, waveformLoader: WaveformLoader) {
    this._transport  = transport
    this._coordinator = new ClipPlaybackCoordinator(transport, trackManager)
    this._audioEngine = new AudioClipPlaybackEngine(transport, trackManager, waveformLoader)
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  start(): void {
    if (this._isPlaying) return
    this._isPlaying    = true
    this._underrunCount = 0
    this._jitterSamples = []
    this._lastWakeTime  = performance.now()
    this._coordinator.start()
    this._audioEngine.start()
    this._startMonitor()
  }

  stop(): void {
    if (!this._isPlaying) return
    this._isPlaying = false
    this._coordinator.stop()
    this._audioEngine.stop()
    this._stopMonitor()
  }

  seek(bar: number): void {
    this._coordinator.seek(bar)
    this._audioEngine.seek(bar)
  }

  onUnderrun(cb: (count: number) => void): () => void {
    this._underrunCbs.push(cb)
    return () => { this._underrunCbs = this._underrunCbs.filter(c => c !== cb) }
  }

  getMetrics(): SchedulerMetrics {
    return {
      driftMs:       this._getDriftMs(),
      jitterMs:      this._getAvgJitterMs(),
      underrunCount: this._underrunCount,
      isPlaying:     this._isPlaying,
    }
  }

  getJitterMs(): number  { return this._getAvgJitterMs() }
  getDriftMs():  number  { return this._getDriftMs() }

  dispose(): void {
    this.stop()
    this._coordinator.dispose()
  }

  // ── Internal monitoring ──────────────────────────────────────────────────────

  private _startMonitor(): void {
    const check = () => {
      if (!this._isPlaying) return
      const now     = performance.now()
      const elapsed = now - this._lastWakeTime
      this._lastWakeTime = now

      // Jitter: deviation from expected 16.67ms RAF interval
      const expectedMs = 1000 / 60
      const jitter     = Math.abs(elapsed - expectedMs)
      this._jitterSamples.push(jitter)
      if (this._jitterSamples.length > JITTER_WINDOW) this._jitterSamples.shift()

      // Underrun: RAF was delayed more than UNDERRUN_THRESHOLD_MS beyond expected
      if (jitter > UNDERRUN_THRESHOLD_MS && this._isPlaying) {
        this._underrunCount++
        for (const cb of this._underrunCbs) cb(this._underrunCount)
      }

      this._rafId = requestAnimationFrame(check)
    }
    this._rafId = requestAnimationFrame(check)
  }

  private _stopMonitor(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  }

  private _getAvgJitterMs(): number {
    if (this._jitterSamples.length === 0) return 0
    return this._jitterSamples.reduce((a, b) => a + b, 0) / this._jitterSamples.length
  }

  private _getDriftMs(): number {
    if (!this._isPlaying) return 0
    // Compare AudioContext time vs position-derived expectation.
    // BeatPosition gives us bar+beat; convert to seconds via bpm.
    const clock = this._transport.clock as unknown as { engine: { ctx: AudioContext }; position: { bar: number; beat: number }; bpm: number }
    const ctx        = clock.engine.ctx
    const pos        = clock.position
    const bpm        = this._transport.bpm
    const tsTop      = this._transport.timeSigTop
    const beatIndex  = (pos.bar - 1) * tsTop + (pos.beat - 1)
    const expectedSec = beatIndex * (60 / bpm)
    const actualSec   = ctx.currentTime
    return (actualSec - expectedSec) * 1000
  }
}
