/**
 * AutoSaveEngine — non-blocking background autosave with IPC.
 *
 * The save function is injectable (default uses window.electronAPI.safetySave)
 * so tests can provide a mock without touching the real IPC.
 */

import { checksumObject } from './ProjectChecksum'
import { serializeProject } from './ProjectSerializer'
import type { ProjectStoreState } from './ProjectSerializer'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AutoSaveOptions {
  intervalMs: number
  maxBackups: number
  enabled: boolean
}

export interface SaveResult {
  success: boolean
  timestamp: number
  snapshotId: string
  isIncremental: boolean
}

type SavedCallback = (result: SaveResult) => void
type ErrorCallback = (error: string) => void
type SaveFn = (json: string, meta: { projectId: string; projectName: string }) => Promise<void>

// ── AutoSaveEngine ───────────────────────────────────────────────────────────

export class AutoSaveEngine {
  private options: AutoSaveOptions
  private _isRunning = false
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private getState: (() => ProjectStoreState) | null = null
  private lastChecksum = 0
  private _lastSaveTime = 0
  private _saveCount = 0
  private savedCallbacks: SavedCallback[] = []
  private errorCallbacks: ErrorCallback[] = []

  constructor(options?: Partial<AutoSaveOptions>) {
    this.options = {
      intervalMs: 30_000,
      maxBackups: 20,
      enabled: true,
      ...options,
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start(getState: () => ProjectStoreState, saveFn?: SaveFn): void {
    if (this._isRunning) this.stop()

    this.getState = getState
    this.lastChecksum = checksumObject(getState())
    this._isRunning = true

    const effectiveSaveFn: SaveFn = saveFn ?? this.defaultSaveFn

    this.intervalHandle = setInterval(() => {
      if (!this.options.enabled || !this.getState) return
      const state = this.getState()
      const current = checksumObject(state)
      if (current === this.lastChecksum) return

      const snapshot = serializeProject(state)
      const json = JSON.stringify(snapshot)

      // Fire-and-forget: we do not await
      void effectiveSaveFn(json, { projectId: snapshot.projectId, projectName: snapshot.projectName })
        .then(() => {
          this.lastChecksum = current
          this._lastSaveTime = Date.now()
          this._saveCount++
          const result: SaveResult = {
            success: true,
            timestamp: this._lastSaveTime,
            snapshotId: `${snapshot.projectId}_${this._lastSaveTime}`,
            isIncremental: true,
          }
          this.savedCallbacks.forEach(cb => cb(result))
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          this.errorCallbacks.forEach(cb => cb(msg))
        })
    }, this.options.intervalMs)
  }

  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    this._isRunning = false
  }

  async forceSave(getState: () => ProjectStoreState, saveFn?: SaveFn): Promise<SaveResult> {
    const effectiveSaveFn: SaveFn = saveFn ?? this.defaultSaveFn
    const state = getState()
    const snapshot = serializeProject(state)
    const json = JSON.stringify(snapshot)
    const timestamp = Date.now()

    try {
      await effectiveSaveFn(json, { projectId: snapshot.projectId, projectName: snapshot.projectName })
      this._lastSaveTime = timestamp
      this._saveCount++
      const result: SaveResult = {
        success: true,
        timestamp,
        snapshotId: `${snapshot.projectId}_${timestamp}`,
        isIncremental: false,
      }
      this.savedCallbacks.forEach(cb => cb(result))
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.errorCallbacks.forEach(cb => cb(msg))
      return {
        success: false,
        timestamp,
        snapshotId: '',
        isIncremental: false,
      }
    }
  }

  setInterval(ms: number): void {
    this.options.intervalMs = ms
  }

  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled
  }

  onSaved(cb: SavedCallback): () => void {
    this.savedCallbacks.push(cb)
    return () => {
      this.savedCallbacks = this.savedCallbacks.filter(x => x !== cb)
    }
  }

  onError(cb: ErrorCallback): () => void {
    this.errorCallbacks.push(cb)
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter(x => x !== cb)
    }
  }

  get isRunning(): boolean {
    return this._isRunning
  }

  get lastSaveTime(): number {
    return this._lastSaveTime
  }

  get saveCount(): number {
    return this._saveCount
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private defaultSaveFn: SaveFn = async (json, meta) => {
    const api = (globalThis as { window?: { electronAPI?: { safetySave?: (json: string, projectId: string, projectName: string) => Promise<unknown> } } }).window?.electronAPI
    if (api?.safetySave) {
      await api.safetySave(json, meta.projectId, meta.projectName)
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const autoSaveEngine = new AutoSaveEngine()
