// Monitors for audio dropouts and attempts recovery via AudioContext resume.
// Also provides exponential-backoff buffer increase suggestion.
export class DropoutProtector {
  private _ctx: AudioContext
  private _dropoutCount = 0
  private _listeners = new Set<(count: number) => void>()
  private _rafId: number | null = null
  private _lastTime = 0
  private _lastWall = 0

  constructor(ctx: AudioContext) {
    this._ctx = ctx
  }

  start(): void {
    this._lastWall = performance.now()
    this._lastTime = this._ctx.currentTime
    this._check()
  }

  stop(): void {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId)
    this._rafId = null
  }

  get dropoutCount(): number { return this._dropoutCount }

  onDropout(fn: (count: number) => void): () => void {
    this._listeners.add(fn)
    return () => this._listeners.delete(fn)
  }

  private _check(): void {
    this._rafId = requestAnimationFrame(async () => {
      const now = performance.now()
      const wall = (now - this._lastWall) / 1000
      const ct = this._ctx.currentTime - this._lastTime
      this._lastWall = now
      this._lastTime = this._ctx.currentTime

      if (wall > 0.1 && ct < wall * 0.5) {
        this._dropoutCount++
        this._listeners.forEach(fn => fn(this._dropoutCount))
        // Recovery: if context suspended, resume it
        if (this._ctx.state === 'suspended') {
          await this._ctx.resume().catch(() => { /* ignore */ })
        }
      }
      this._check()
    })
  }
}
