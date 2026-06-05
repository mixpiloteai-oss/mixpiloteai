/**
 * UnderrunDetector — wraps PerformanceMonitor and emits notifications on
 * audio buffer underruns (dropouts).
 *
 * A dropout occurs when the audio clock advances less than 80% of the
 * expected interval between two consecutive rAF frames.
 *
 * After WARN_AFTER consecutive dropouts the detector emits a warning via
 * the toast store so the user can increase the buffer size.
 *
 * Usage:
 *   const udr = new UnderrunDetector(audioEngine)
 *   udr.start()
 *   udr.onUnderrun(count => console.log(`dropout #${count}`))
 *   udr.stop()
 */

import type { AudioEngine }          from './AudioEngine'
import { PerformanceMonitor }        from './PerformanceMonitor'
import type { AudioPerformanceSnapshot } from './PerformanceMonitor'
import { toast }                     from '../store/toastStore'

const WARN_AFTER = 3   // warn user after this many consecutive dropout events

export class UnderrunDetector {
  private readonly _monitor:         PerformanceMonitor
  private _callbacks:                ((totalCount: number) => void)[] = []
  private _lastDropoutCount          = 0
  private _consecutiveDropouts       = 0
  private _hasWarnedThisSession      = false
  private _unsubscribe:              (() => void) | null = null
  private _totalCount                = 0

  constructor(engine: AudioEngine) {
    this._monitor = new PerformanceMonitor(engine.ctx)
  }

  start(): void {
    if (this._unsubscribe) return
    this._lastDropoutCount       = 0
    this._consecutiveDropouts    = 0
    this._hasWarnedThisSession   = false
    this._totalCount             = 0
    this._monitor.start()
    this._unsubscribe = this._monitor.subscribe(snap => this._onSnapshot(snap))
  }

  stop(): void {
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }
    this._monitor.stop()
  }

  onUnderrun(cb: (count: number) => void): () => void {
    this._callbacks.push(cb)
    return () => { this._callbacks = this._callbacks.filter(c => c !== cb) }
  }

  getUnderrunCount(): number { return this._totalCount }

  reset(): void {
    this._lastDropoutCount    = this._totalCount
    this._consecutiveDropouts = 0
    this._hasWarnedThisSession = false
  }

  dispose(): void { this.stop() }

  private _onSnapshot(snap: AudioPerformanceSnapshot): void {
    if (snap.dropoutCount > this._lastDropoutCount) {
      const delta = snap.dropoutCount - this._lastDropoutCount
      this._consecutiveDropouts += delta
      this._totalCount          += delta
      this._lastDropoutCount     = snap.dropoutCount

      for (const cb of this._callbacks) cb(this._totalCount)

      if (this._consecutiveDropouts >= WARN_AFTER && !this._hasWarnedThisSession) {
        this._hasWarnedThisSession = true
        toast.warn(
          'Audio dropouts detected',
          `${this._totalCount} buffer underrun${this._totalCount > 1 ? 's' : ''} — try increasing buffer size in Settings → Audio`,
        )
      }
    } else {
      this._consecutiveDropouts = 0
    }
  }
}
