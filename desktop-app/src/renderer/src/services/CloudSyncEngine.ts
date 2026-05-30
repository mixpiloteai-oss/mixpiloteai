// ─── CloudSyncEngine ─────────────────────────────────────────────────────────
// Pure-TS service for project-to-cloud sync.
// Works in both browser and Node.js (for tests).

declare const window: { __APP_CONFIG__?: { apiUrl?: string } } | undefined

export type SyncStatus = 'idle' | 'syncing' | 'conflict' | 'error' | 'offline'

export interface SyncConflict {
  localVersion: number
  remoteVersion: number
  lastSyncAt: number
  projectId: string
}

export interface SyncOp {
  id: string
  type: string
  url: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  payload: unknown
  timestamp: number
  retryCount: number
}

export interface CloudSyncState {
  status: SyncStatus
  lastSyncAt: number | null
  pendingOps: SyncOp[]
  conflict: SyncConflict | null
  error: string | null
}

interface CloudSyncEngineOpts {
  apiUrl?: string
  maxRetries?: number
}

function makeOpId(): string {
  return `op-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`
}

export class CloudSyncEngine {
  private _apiUrl: string
  private _maxRetries: number
  private _authToken: string | null = null
  private _state: CloudSyncState = {
    status: 'idle',
    lastSyncAt: null,
    pendingOps: [],
    conflict: null,
    error: null,
  }
  private _subscribers: Array<(state: CloudSyncState) => void> = []

  constructor(opts?: CloudSyncEngineOpts) {
    const defaultUrl =
      typeof window !== 'undefined'
        ? (window.__APP_CONFIG__?.apiUrl ?? 'http://localhost:4000')
        : 'http://localhost:4000'
    this._apiUrl = opts?.apiUrl ?? defaultUrl
    this._maxRetries = opts?.maxRetries ?? 3
  }

  setAuthToken(token: string): void {
    this._authToken = token
  }

  async pushProjectVersion(
    projectId: string,
    data: unknown,
    label: string,
    type?: string,
  ): Promise<{ ok: boolean; versionId?: string; error?: string; conflict?: boolean }> {
    this._setState({ status: 'syncing', error: null })
    const url = `${this._apiUrl}/api/save/${projectId}/versions`
    try {
      const res = await this._fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label, data, type: type ?? 'auto' }),
      })
      if (res.status === 409) {
        this._setState({ status: 'conflict' })
        return { ok: false, conflict: true, error: 'Version conflict' }
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown error')
        this._setState({ status: 'error', error: errText })
        return { ok: false, error: errText }
      }
      const body = (await res.json()) as { data?: { id?: string } }
      const versionId = body.data?.id
      const now = Date.now()
      this._setState({ status: 'idle', lastSyncAt: now, error: null })
      return { ok: true, versionId }
    } catch (err) {
      // Network failure — queue the op
      const opPayload = { projectId, data, label, type: type ?? 'auto' }
      this.queueOp({
        type: 'push-version',
        url,
        method: 'POST',
        payload: opPayload,
        timestamp: Date.now(),
      })
      const errMsg = err instanceof Error ? err.message : 'Network error'
      this._setState({ status: 'offline', error: errMsg })
      return { ok: false, error: errMsg }
    }
  }

  async pullLatestVersion(
    projectId: string,
  ): Promise<{ ok: boolean; version?: unknown; error?: string }> {
    this._setState({ status: 'syncing', error: null })
    try {
      const listRes = await this._fetch(
        `${this._apiUrl}/api/save/${projectId}/versions`,
        { method: 'GET' },
      )
      if (!listRes.ok) {
        const errText = await listRes.text().catch(() => 'unknown error')
        this._setState({ status: 'error', error: errText })
        return { ok: false, error: errText }
      }
      const listBody = (await listRes.json()) as {
        data?: Array<{ id: string; createdAt: number }>
      }
      const versions = listBody.data ?? []
      if (versions.length === 0) {
        this._setState({ status: 'idle', error: null })
        return { ok: true, version: null }
      }
      // Sort descending and get latest
      const sorted = [...versions].sort((a, b) => b.createdAt - a.createdAt)
      const latestId = sorted[0]!.id
      const versionRes = await this._fetch(
        `${this._apiUrl}/api/save/${projectId}/versions/${latestId}`,
        { method: 'GET' },
      )
      if (!versionRes.ok) {
        const errText = await versionRes.text().catch(() => 'unknown error')
        this._setState({ status: 'error', error: errText })
        return { ok: false, error: errText }
      }
      const versionBody = (await versionRes.json()) as { data?: unknown }
      this._setState({ status: 'idle', lastSyncAt: Date.now(), error: null })
      return { ok: true, version: versionBody.data }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error'
      this._setState({ status: 'offline', error: errMsg })
      return { ok: false, error: errMsg }
    }
  }

  async pushOfflineQueue(): Promise<void> {
    const ops = [...this._state.pendingOps]
    if (ops.length === 0) return

    const remaining: SyncOp[] = []
    for (const op of ops) {
      try {
        const res = await this._fetch(op.url, {
          method: op.method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(op.payload),
        })
        if (!res.ok) {
          // Increment retry count
          const updated: SyncOp = { ...op, retryCount: op.retryCount + 1 }
          if (updated.retryCount < this._maxRetries) {
            remaining.push(updated)
          }
          // Drop if exceeded maxRetries
        }
        // Success — don't add to remaining (removes it)
      } catch {
        const updated: SyncOp = { ...op, retryCount: op.retryCount + 1 }
        if (updated.retryCount < this._maxRetries) {
          remaining.push(updated)
        }
      }
    }
    this._setState({ pendingOps: remaining, status: remaining.length > 0 ? 'offline' : 'idle' })
  }

  queueOp(op: Omit<SyncOp, 'id' | 'retryCount'>): void {
    const fullOp: SyncOp = { ...op, id: makeOpId(), retryCount: 0 }
    this._setState({ pendingOps: [...this._state.pendingOps, fullOp] })
  }

  getState(): CloudSyncState {
    return { ...this._state, pendingOps: [...this._state.pendingOps] }
  }

  onStateChange(cb: (state: CloudSyncState) => void): () => void {
    this._subscribers.push(cb)
    return () => {
      this._subscribers = this._subscribers.filter((s) => s !== cb)
    }
  }

  private _setState(patch: Partial<CloudSyncState>): void {
    this._state = { ...this._state, ...patch }
    this._emit()
  }

  private _emit(): void {
    const state = this.getState()
    for (const cb of this._subscribers) {
      cb(state)
    }
  }

  private async _fetch(url: string, opts: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      ...(opts.headers as Record<string, string> | undefined),
    }
    if (this._authToken) {
      headers['authorization'] = `Bearer ${this._authToken}`
    }
    return fetch(url, { ...opts, headers })
  }
}

// ── Module singleton ──────────────────────────────────────────────────────────
let _instance: CloudSyncEngine | null = null

export function getCloudSyncEngine(): CloudSyncEngine {
  if (!_instance) {
    _instance = new CloudSyncEngine()
  }
  return _instance
}
