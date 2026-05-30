// ─── Renderer Stability Module ─────────────────────────────────────────────────
// Client-side health monitoring and recovery.
//
// Features:
//   - Periodic heartbeats to main process (uses preload API — NOT raw ipcRenderer)
//   - Long-operation tracking with timeout + deadlock detection
//   - UI responsiveness monitoring via rAF gap detection
//   - Memory pressure reporting (performance.memory when available)
//   - Graceful shutdown coordination

export interface RendererHealth {
  uptime:       number
  memoryMB?:    number
  frameRate?:   number
  isResponsive: boolean
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ElectronAPIWithStability = Window['electronAPI'] & {
  stabilityHeartbeat?:        (uptime: number) => Promise<void>
  stabilityTrackOperation?:   (opId: string)   => Promise<void>
  stabilityCompleteOperation?:(opId: string)   => Promise<void>
}

// ─── RendererStability ────────────────────────────────────────────────────────

class RendererStability {
  private _startTime          = Date.now()
  private _heartbeatInterval: number | null = null
  private _rafWatchdog:       number | null = null
  private _lastRAF            = Date.now()
  private _frameDrops         = 0
  private _pendingOps         = new Map<string, number>()
  private _listeners:         Array<(health: RendererHealth) => void> = []
  private _api: ElectronAPIWithStability | null = null

  start(): void {
    if (this._heartbeatInterval !== null) return  // already started

    this._api = (window as unknown as { electronAPI?: ElectronAPIWithStability }).electronAPI ?? null

    // Heartbeat every 2s — tells main process the renderer is alive
    this._heartbeatInterval = window.setInterval(() => {
      void this._sendHeartbeat()
    }, 2_000)

    // rAF watchdog — detects frame drops (UI freeze / GC pause)
    const rafLoop = (): void => {
      const now = Date.now()
      const gap = now - this._lastRAF
      if (this._lastRAF > 0 && gap > 500) {
        // Frame dropped > 500ms — UI was frozen
        this._frameDrops++
        console.warn(`[stability] frame drop detected: ${gap}ms gap (total drops: ${this._frameDrops})`)
      }
      this._lastRAF = now
      this._rafWatchdog = requestAnimationFrame(rafLoop)
    }
    this._rafWatchdog = requestAnimationFrame(rafLoop)

    window.addEventListener('beforeunload', () => this.stop())

    console.log('[stability] renderer stability monitor started')
  }

  stop(): void {
    if (this._heartbeatInterval !== null) {
      window.clearInterval(this._heartbeatInterval)
      this._heartbeatInterval = null
    }
    if (this._rafWatchdog !== null) {
      cancelAnimationFrame(this._rafWatchdog)
      this._rafWatchdog = null
    }
    console.log('[stability] renderer stability monitor stopped')
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  private async _sendHeartbeat(): Promise<void> {
    if (!this._api?.stabilityHeartbeat) return
    try {
      const uptime = Date.now() - this._startTime
      await this._api.stabilityHeartbeat(uptime)
    } catch (err) {
      // Heartbeat failure is non-fatal — main process has a timeout guard
      console.warn('[stability] heartbeat failed:', err)
    }
  }

  // ── Operation tracking ────────────────────────────────────────────────────

  /**
   * Wrap a long-running operation with timeout + main-process tracking.
   * Main process will log a warning if the operation stalls.
   */
  async trackOperation<T>(
    operationId: string,
    fn: () => Promise<T>,
    timeoutMs = 30_000,
  ): Promise<T> {
    this._pendingOps.set(operationId, Date.now())

    try {
      await this._api?.stabilityTrackOperation?.(operationId)
    } catch { /* non-fatal */ }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation "${operationId}" timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    )

    try {
      return await Promise.race([fn(), timeoutPromise])
    } finally {
      this._pendingOps.delete(operationId)
      try {
        await this._api?.stabilityCompleteOperation?.(operationId)
      } catch { /* non-fatal */ }
    }
  }

  // ── Health ────────────────────────────────────────────────────────────────

  getHealth(): RendererHealth {
    // @ts-expect-error — performance.memory is non-standard (Blink only)
    const memoryMB = (performance.memory as { usedJSHeapSize?: number } | undefined)?.usedJSHeapSize
      ? // @ts-expect-error
        Math.round((performance.memory as { usedJSHeapSize: number }).usedJSHeapSize / 1024 / 1024)
      : undefined

    return {
      uptime:       Date.now() - this._startTime,
      memoryMB,
      isResponsive: Date.now() - this._lastRAF < 3_000,
      frameRate:    this._frameDrops,  // cumulative drops as proxy
    }
  }

  onHealthChange(listener: (health: RendererHealth) => void): () => void {
    this._listeners.push(listener)
    return () => {
      const idx = this._listeners.indexOf(listener)
      if (idx >= 0) this._listeners.splice(idx, 1)
    }
  }

  /**
   * How many rAF gaps > 500ms we've seen since start (UI freeze indicator).
   */
  get frameDropCount(): number {
    return this._frameDrops
  }

  /**
   * Coordinate graceful shutdown — give pending ops time to complete.
   */
  async prepareForShutdown(): Promise<void> {
    console.log('[stability] preparing for shutdown')
    if (this._pendingOps.size > 0) {
      console.log(`[stability] ${this._pendingOps.size} pending operations, waiting...`)
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const rendererStability = new RendererStability()

// Auto-start once the DOM + preload API are available
if (typeof window !== 'undefined') {
  // Use microtask queue: ensures preload script has run
  Promise.resolve().then(() => rendererStability.start())
}
