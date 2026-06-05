// ─── AIContextSynchronizer.ts ─────────────────────────────────────────────────
// Keeps the AI context updated as the project changes. Debounced re-analysis.

import { musicContextEngine } from './MusicContextEngine'
import type { MusicContext, ProjectSnapshot } from './MusicContextEngine'

export type { ProjectSnapshot }

export interface SyncedContext {
  lastAnalyzedAt: number
  context: MusicContext | null
  isStale: boolean
  analysisInProgress: boolean
}

export class AIContextSynchronizer {
  private _context: SyncedContext = {
    lastAnalyzedAt: 0,
    context: null,
    isStale: true,
    analysisInProgress: false,
  }
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null
  private _listeners = new Set<(ctx: SyncedContext) => void>()
  private _getSnapshot: (() => ProjectSnapshot) | null = null
  private readonly DEBOUNCE_MS = 2000

  /**
   * Called when the project changes — marks context stale and schedules re-analysis.
   */
  markStale(): void {
    this._context = { ...this._context, isStale: true }
    this._scheduleReanalysis()
  }

  /**
   * Force immediate re-analysis using the provided snapshot getter.
   */
  async forceAnalyze(getSnapshot: () => ProjectSnapshot): Promise<SyncedContext> {
    this._context = { ...this._context, analysisInProgress: true }
    this._emit()

    try {
      const snapshot = getSnapshot()
      const context = await musicContextEngine.buildContext(snapshot)
      this._context = {
        lastAnalyzedAt: Date.now(),
        context,
        isStale: false,
        analysisInProgress: false,
      }
    } catch {
      this._context = { ...this._context, analysisInProgress: false }
    }

    this._emit()
    return { ...this._context }
  }

  /**
   * Subscribe to context updates. Returns unsubscribe function.
   */
  onContextUpdate(cb: (ctx: SyncedContext) => void): () => void {
    this._listeners.add(cb)
    return () => {
      this._listeners.delete(cb)
    }
  }

  getContext(): SyncedContext {
    return { ...this._context }
  }

  setSnapshotProvider(fn: () => ProjectSnapshot): void {
    this._getSnapshot = fn
  }

  private _scheduleReanalysis(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer)
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null
      if (this._getSnapshot) {
        void this.forceAnalyze(this._getSnapshot)
      }
    }, this.DEBOUNCE_MS)
  }

  private _emit(): void {
    const snapshot = { ...this._context }
    for (const listener of this._listeners) {
      listener(snapshot)
    }
  }
}

export const aiContextSync = new AIContextSynchronizer()
