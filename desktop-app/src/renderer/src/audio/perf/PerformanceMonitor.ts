// ─── PerformanceMonitor ───────────────────────────────────────────────────────
// RAF-based FPS / memory / audio-latency monitor.
// Uses a ring buffer of the last 60 frame timestamps for precision.

export interface PerformanceSnapshot {
  fps:                number   // rolling average FPS over last 60 frames
  fpsMin:             number   // minimum FPS in last 60 frames
  frameTimeMs:        number   // average frame time in ms
  memoryMb:           number   // JS heap used (0 if performance.memory unavailable)
  memoryLimitMb:      number   // JS heap limit (0 if unavailable)
  audioLatencyMs:     number   // AudioContext.outputLatency * 1000 (0 if no ctx)
  audioBaseLatencyMs: number   // AudioContext.baseLatency * 1000 (0 if no ctx)
  timestamp:          number   // Date.now()
}

export type PerfListener = (snapshot: PerformanceSnapshot) => void

// Browser performance.memory type (non-standard, Chromium-only)
type PerfWithMemory = Performance & {
  memory?: {
    usedJSHeapSize:  number
    jsHeapSizeLimit: number
  }
}

const RING_SIZE = 60

export class PerformanceMonitor {
  private _timestamps = new Float64Array(RING_SIZE)
  private _head       = 0          // index of next write slot
  private _count      = 0          // how many slots have been filled
  private _rafId:     number | null = null
  private _listeners: Set<PerfListener> = new Set()
  private _audioCtx:  AudioContext | undefined

  start(audioCtx?: AudioContext): void {
    if (this._rafId !== null) return   // idempotent
    this._audioCtx = audioCtx
    this._head  = 0
    this._count = 0
    this._rafId = requestAnimationFrame((ts) => this._tick(ts))
  }

  stop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    this._head  = 0
    this._count = 0
  }

  onSnapshot(listener: PerfListener): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  getSnapshot(): PerformanceSnapshot {
    return this._buildSnapshot(performance.now())
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _tick(now: number): void {
    // Store timestamp in ring buffer
    this._timestamps[this._head] = now
    this._head  = (this._head + 1) % RING_SIZE
    this._count = Math.min(this._count + 1, RING_SIZE)

    const snap = this._buildSnapshot(now)
    for (const fn of this._listeners) fn(snap)

    this._rafId = requestAnimationFrame((ts) => this._tick(ts))
  }

  private _buildSnapshot(now: number): PerformanceSnapshot {
    const n = this._count
    if (n < 2) {
      return {
        fps: 0, fpsMin: 0, frameTimeMs: 0,
        memoryMb: this._memUsed(), memoryLimitMb: this._memLimit(),
        audioLatencyMs: this._outputLatency(), audioBaseLatencyMs: this._baseLatency(),
        timestamp: Date.now(),
      }
    }

    // Gather all timestamps in chronological order
    // Ring buffer: newest at (head - 1 + RING_SIZE) % RING_SIZE, oldest at head (when full)
    const windowMs = 1000
    let framesInWindow = 0
    let minFrameInstantFps = Infinity
    let totalFrameTime = 0
    let frameTimeCount = 0

    // Walk backwards from newest entry
    const newest = (this._head - 1 + RING_SIZE) % RING_SIZE
    let prev = this._timestamps[newest]

    for (let i = 1; i < n; i++) {
      const idx = (this._head - 1 - i + RING_SIZE * 2) % RING_SIZE
      const ts  = this._timestamps[idx]
      const delta = prev - ts
      if (delta > 0) {
        const instantFps = 1000 / delta
        if (instantFps < minFrameInstantFps) minFrameInstantFps = instantFps
        totalFrameTime += delta
        frameTimeCount++
      }
      if (now - ts <= windowMs) framesInWindow++
      prev = ts
    }

    const fps         = framesInWindow   // frames in last 1000ms ≈ FPS
    const frameTimeMs = frameTimeCount > 0 ? totalFrameTime / frameTimeCount : 0
    const fpsMin      = minFrameInstantFps === Infinity ? 0 : minFrameInstantFps

    return {
      fps,
      fpsMin,
      frameTimeMs,
      memoryMb:           this._memUsed(),
      memoryLimitMb:      this._memLimit(),
      audioLatencyMs:     this._outputLatency(),
      audioBaseLatencyMs: this._baseLatency(),
      timestamp:          Date.now(),
    }
  }

  private _memUsed(): number {
    const mem = (performance as PerfWithMemory).memory
    return mem ? mem.usedJSHeapSize / (1024 * 1024) : 0
  }

  private _memLimit(): number {
    const mem = (performance as PerfWithMemory).memory
    return mem ? mem.jsHeapSizeLimit / (1024 * 1024) : 0
  }

  private _outputLatency(): number {
    return (this._audioCtx?.outputLatency ?? 0) * 1000
  }

  private _baseLatency(): number {
    return (this._audioCtx?.baseLatency ?? 0) * 1000
  }
}

export const performanceMonitor = new PerformanceMonitor()
