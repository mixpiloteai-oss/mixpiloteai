export class FpsThrottle {
  private _targetFps:   number
  private _minInterval: number
  private _lastTime:    number = 0
  private _rafId:       number | null = null

  constructor(targetFps = 60) {
    this._targetFps   = targetFps
    this._minInterval = 1000 / targetFps
  }

  setTargetFps(fps: number): void {
    this._targetFps   = fps
    this._minInterval = 1000 / fps
  }

  get targetFps(): number { return this._targetFps }
  get minIntervalMs(): number { return this._minInterval }

  /** Request a throttled animation frame. Returns a cancel function. */
  request(callback: (timestamp: number) => void): () => void {
    let active = true

    const rafCallback = (timestamp: number): void => {
      if (!active) return
      const elapsed = timestamp - this._lastTime
      if (elapsed >= this._minInterval) {
        this._lastTime = timestamp - (elapsed % this._minInterval)
        callback(timestamp)
      }
      this._rafId = requestAnimationFrame(rafCallback)
    }

    this._rafId = requestAnimationFrame(rafCallback)

    return () => {
      active = false
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId)
        this._rafId = null
      }
    }
  }

  dispose(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  }
}
