// ─── Renderer Stability Module ─────────────────────────────────────────────────
// Client-side health monitoring and recovery
//
// - Periodic heartbeats to main process
// - Operation tracking for deadlock detection
// - UI responsiveness monitoring
// - Crash recovery coordination

export interface RendererHealth {
  uptime: number
  memory?: number
  frameRate?: number
  isResponsive: boolean
}

class RendererStability {
  private _startTime = Date.now()
  private _heartbeatInterval: number | null = null
  private _lastHeartbeat = Date.now()
  private _pendingOps = new Map<string, number>()
  private _listeners: Array<(health: RendererHealth) => void> = []

  start(): void {
    // Heartbeat every 2 seconds
    this._heartbeatInterval = window.setInterval(() => this._sendHeartbeat(), 2_000)

    // Monitor for unresponsiveness
    window.addEventListener('beforeunload', () => this.stop())

    console.log('[stability] renderer stability monitor started')
  }

  stop(): void {
    if (this._heartbeatInterval !== null) {
      window.clearInterval(this._heartbeatInterval)
      this._heartbeatInterval = null
    }
    console.log('[stability] renderer stability monitor stopped')
  }

  private async _sendHeartbeat(): Promise<void> {
    try {
      const uptime = Date.now() - this._startTime
      await window.electronAPI?.(['stability-heartbeat', { uptime }] as any)
      this._lastHeartbeat = Date.now()
    } catch (err) {
      console.warn('[stability] heartbeat failed:', err)
    }
  }

  /**
   * Track a long-running operation to detect deadlocks/stalls
   */
  async trackOperation<T>(
    operationId: string,
    fn: () => Promise<T>,
    timeoutMs = 30_000,
  ): Promise<T> {
    this._pendingOps.set(operationId, Date.now())
    try {
      await window.electronAPI?.(['stability-track-operation', { opId: operationId }] as any)

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation ${operationId} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      )

      return await Promise.race([fn(), timeoutPromise])
    } finally {
      this._pendingOps.delete(operationId)
      try {
        await window.electronAPI?.(['stability-complete-operation', { opId: operationId }] as any)
      } catch { /* ignore */ }
    }
  }

  getHealth(): RendererHealth {
    return {
      uptime: Date.now() - this._startTime,
      isResponsive: Date.now() - this._lastHeartbeat < 10_000,
    }
  }

  onHealthChange(listener: (health: RendererHealth) => void): () => void {
    this._listeners.push(listener)
    return () => {
      const idx = this._listeners.indexOf(listener)
      if (idx >= 0) this._listeners.splice(idx, 1)
    }
  }

  private _notifyListeners(): void {
    const health = this.getHealth()
    for (const listener of this._listeners) {
      try {
        listener(health)
      } catch (err) {
        console.error('[stability] listener error:', err)
      }
    }
  }

  /**
   * Coordinate graceful shutdown
   */
  async prepareForShutdown(): Promise<void> {
    console.log('[stability] preparing for shutdown')
    // Give pending operations time to complete
    await new Promise(r => setTimeout(r, 500))
  }
}

export const rendererStability = new RendererStability()

// Auto-start on module load
if (typeof window !== 'undefined') {
  // Wait for next tick to ensure API is available
  Promise.resolve().then(() => rendererStability.start())
}
