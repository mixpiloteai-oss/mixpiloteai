export class RenderBatcher {
  private _pending:   Array<() => void> = []
  private _keyedIdx:  Map<string, number> = new Map()
  private _rafId:     number | null = null
  private _flushing = false

  /** Schedule a callback to run in the next animation frame */
  schedule(fn: () => void): void {
    this._pending.push(fn)
    this._ensureScheduled()
  }

  /**
   * Schedule with a deduplication key — only the latest callback per key runs.
   * Useful for batching rapid state updates (e.g. scroll position changes).
   */
  scheduleKeyed(key: string, fn: () => void): void {
    const existing = this._keyedIdx.get(key)
    if (existing !== undefined) {
      // Replace with no-op so the slot count stays stable
      this._pending[existing] = () => {}
    }
    const newIdx = this._pending.length
    this._keyedIdx.set(key, newIdx)
    this._pending.push(() => {
      this._keyedIdx.delete(key)
      fn()
    })
    this._ensureScheduled()
  }

  get pendingCount(): number { return this._pending.length }
  get isFlushing():   boolean { return this._flushing }

  dispose(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    this._pending   = []
    this._keyedIdx.clear()
  }

  private _ensureScheduled(): void {
    if (this._rafId === null) {
      this._rafId = requestAnimationFrame(() => this._flush())
    }
  }

  private _flush(): void {
    this._rafId   = null
    this._flushing = true
    const toRun   = this._pending.splice(0)
    this._keyedIdx.clear()
    for (const fn of toRun) fn()
    this._flushing = false
  }
}

export const renderBatcher = new RenderBatcher()
