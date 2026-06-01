// ─── EconomyModeController ────────────────────────────────────────────────────
// Monitors FPS history and automatically enters/exits economy rendering mode.
// Economy mode reduces rendering quality (e.g. lower target FPS) when the
// system is under sustained load, and restores full quality when load drops.
//
// Usage:
//   economyModeController.ingestFps(fps)           // call with each new fps sample
//   economyModeController.isEconomy                // true when economy mode active
//   economyModeController.onChange(fn)             // subscribe to mode changes

export type EconomyListener = (isEconomy: boolean) => void

export interface EconomyModeOptions {
  /** Number of FPS samples to average before making a decision (default: 90 ≈ 1.5 s at 60fps) */
  windowSize?:      number
  /** FPS average below which economy mode is entered (default: 40) */
  enterThreshold?:  number
  /** FPS average above which economy mode is exited (default: 55) */
  exitThreshold?:   number
  /** FPS target while in economy mode — informational, consumers may act on it (default: 30) */
  economyTargetFps?: number
}

export class EconomyModeController {
  private _windowSize:       number
  private _enterThreshold:   number
  private _exitThreshold:    number
  readonly economyTargetFps: number

  private _history:     number[] = []
  private _economyMode  = false
  private _listeners:   Set<EconomyListener> = new Set()

  constructor(opts?: EconomyModeOptions) {
    this._windowSize      = opts?.windowSize      ?? 90
    this._enterThreshold  = opts?.enterThreshold  ?? 40
    this._exitThreshold   = opts?.exitThreshold   ?? 55
    this.economyTargetFps = opts?.economyTargetFps ?? 30
  }

  /**
   * Feed a new FPS sample into the controller.
   * Fires onChange listeners if mode transitions.
   */
  ingestFps(fps: number): void {
    this._history.push(fps)
    if (this._history.length > this._windowSize) {
      this._history.shift()
    }
    // Don't evaluate until window is full
    if (this._history.length < this._windowSize) return

    const avg = this._history.reduce((a, b) => a + b, 0) / this._history.length

    if (!this._economyMode && avg < this._enterThreshold) {
      this._economyMode = true
      this._notify(true)
    } else if (this._economyMode && avg > this._exitThreshold) {
      this._economyMode = false
      this._notify(false)
    }
  }

  /** Current economy mode state. */
  get isEconomy(): boolean { return this._economyMode }

  /** Current FPS average over the rolling window (0 if window not yet full). */
  get averageFps(): number {
    if (this._history.length === 0) return 0
    return this._history.reduce((a, b) => a + b, 0) / this._history.length
  }

  /** How full the sample window is (0..1). */
  get windowFill(): number { return this._history.length / this._windowSize }

  /**
   * Subscribe to economy mode transitions.
   * Returns an unsubscribe function.
   */
  onChange(fn: EconomyListener): () => void {
    this._listeners.add(fn)
    return () => this._listeners.delete(fn)
  }

  /** Reset all state — useful for tests. */
  reset(): void {
    this._history     = []
    this._economyMode = false
  }

  private _notify(isEconomy: boolean): void {
    for (const fn of this._listeners) fn(isEconomy)
  }
}

export const economyModeController = new EconomyModeController()
