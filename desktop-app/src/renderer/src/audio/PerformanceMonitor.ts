export interface AudioPerformanceSnapshot {
  baseLatencyMs: number       // AudioContext.baseLatency in ms
  outputLatencyMs: number     // AudioContext.outputLatency in ms
  currentTime: number         // AudioContext.currentTime
  sampleRate: number
  state: AudioContextState
  cpuEstimateMs: number       // Estimated callback duration (beat scheduling)
  dropoutCount: number        // Number of detected dropouts since start
  lastDropoutAt: number       // AudioContext.currentTime of last dropout
}

export class PerformanceMonitor {
  private _ctx: AudioContext
  private _dropoutCount = 0
  private _lastDropoutAt = 0
  private _lastCurrentTime = 0
  private _lastWallTime = 0
  private _cpuSamples: number[] = []
  private _maxSamples = 60
  private _subscribers = new Set<(snap: AudioPerformanceSnapshot) => void>()
  private _rafId: number | null = null

  constructor(ctx: AudioContext) {
    this._ctx = ctx
  }

  start(): void {
    this._lastWallTime = performance.now()
    this._lastCurrentTime = this._ctx.currentTime
    this._tick()
  }

  stop(): void {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId)
    this._rafId = null
  }

  recordCallbackDuration(ms: number): void {
    this._cpuSamples.push(ms)
    if (this._cpuSamples.length > this._maxSamples) this._cpuSamples.shift()
  }

  subscribe(fn: (snap: AudioPerformanceSnapshot) => void): () => void {
    this._subscribers.add(fn)
    return () => this._subscribers.delete(fn)
  }

  private _tick(): void {
    this._rafId = requestAnimationFrame(() => {
      const now = performance.now()
      const ctNow = this._ctx.currentTime
      const wallElapsed = (now - this._lastWallTime) / 1000
      const ctElapsed = ctNow - this._lastCurrentTime

      // Dropout detection: if audio clock advanced < 80% of expected → dropout
      if (this._lastCurrentTime > 0 && ctElapsed < wallElapsed * 0.8 && wallElapsed > 0.05) {
        this._dropoutCount++
        this._lastDropoutAt = ctNow
      }

      this._lastWallTime = now
      this._lastCurrentTime = ctNow

      const avg = this._cpuSamples.length
        ? this._cpuSamples.reduce((a, b) => a + b, 0) / this._cpuSamples.length
        : 0

      const snap: AudioPerformanceSnapshot = {
        baseLatencyMs: ((this._ctx as AudioContext & { baseLatency?: number }).baseLatency ?? 0) * 1000,
        outputLatencyMs: ((this._ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0) * 1000,
        currentTime: ctNow,
        sampleRate: this._ctx.sampleRate,
        state: this._ctx.state,
        cpuEstimateMs: avg,
        dropoutCount: this._dropoutCount,
        lastDropoutAt: this._lastDropoutAt,
      }

      this._subscribers.forEach(fn => fn(snap))
      this._tick()
    })
  }
}
