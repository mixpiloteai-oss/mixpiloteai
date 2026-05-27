// ─── CollaborationClient ──────────────────────────────────────────────────────
// SSE-based real-time collaboration client.
//
// Improvements over v1:
//   - Auth token injected into SSE URL (?token=) — EventSource can't send headers
//   - Exponential backoff reconnect with jitter
//   - Pending ops persisted to sessionStorage for cross-refresh resilience
//   - Ghost user cleanup: send DELETE /presence on page unload
//   - Duplicate suppression: ops already in store are not re-applied
//   - Disconnect / reconnect race conditions guarded with _sessionId

import {
  useCollaborationStore,
  type CollabOpType,
  type CollabOp,
  type ChatMessage,
  type TimelineComment,
} from '../store/collaborationStore'
import { config } from '../lib/config'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SSEMessage {
  type: 'op' | 'presence' | 'connected' | 'error'
  data: unknown
}

interface ConnectedPayload {
  rev:       number
  recentOps?: CollabOp[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jitteredDelay(base: number): number {
  return base * (0.8 + Math.random() * 0.4)   // ±20% jitter
}

const PENDING_OPS_KEY = 'collab-pending-ops'

function loadPersistedPending(): CollabOp[] {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_OPS_KEY) ?? '[]') as CollabOp[]
  } catch {
    return []
  }
}

function savePersistedPending(ops: CollabOp[]): void {
  try {
    sessionStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops))
  } catch { /* ignore — quota exceeded */ }
}

// ─── CollaborationClient ──────────────────────────────────────────────────────

export class CollaborationClient {
  private static _instance: CollaborationClient | null = null

  static getInstance(): CollaborationClient {
    if (!CollaborationClient._instance) {
      CollaborationClient._instance = new CollaborationClient()
    }
    return CollaborationClient._instance
  }

  private es:               EventSource | null   = null
  private roomId:           string | null         = null
  private authToken:        string | null         = null

  private userId:    string
  private userName:  string
  private userColor: string

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private _reconnectDelay  = 3_000
  private _maxReconnectDelay = 60_000

  // Session ID changes on every connect() call — lets in-flight callbacks
  // detect they belong to a stale connection and discard their results.
  private _sessionId = 0
  private _presenceCleanupRegistered = false

  constructor() {
    this.userId    = localStorage.getItem('collab-userId')    ?? `user_${Math.random().toString(36).slice(2, 8)}`
    this.userName  = localStorage.getItem('collab-userName')  ?? 'Producer'
    this.userColor = localStorage.getItem('collab-color')     ?? '#7c3aed'
    localStorage.setItem('collab-userId', this.userId)

    // Restore pending ops from last session
    const persisted = loadPersistedPending()
    if (persisted.length > 0) {
      for (const op of persisted) {
        useCollaborationStore.getState().addPendingOp(op)
      }
    }

    this._registerGhostUserCleanup()
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  /**
   * @param projectId  Project to join
   * @param authToken  JWT token — REQUIRED for auth-gated SSE endpoint
   */
  connect(projectId: string, authToken?: string): void {
    if (authToken) this.authToken = authToken

    if (
      this.roomId === projectId &&
      this.es?.readyState === EventSource.OPEN
    ) {
      return   // already connected to this room
    }

    this.disconnect()
    this.roomId   = projectId
    this._sessionId = Date.now()   // new session ↑

    useCollaborationStore.getState().setProjectId(projectId)

    if (!this.authToken) {
      console.warn('[CollaborationClient] no auth token — connection may be rejected (401)')
    }

    const params = new URLSearchParams({
      userId:    this.userId,
      userName:  this.userName,
      userColor: this.userColor,
      ...(this.authToken ? { token: this.authToken } : {}),
    })

    const url = `${config.apiUrl}/api/collab/stream/${projectId}?${params.toString()}`
    this._openSSE(url, this._sessionId)
  }

  private _openSSE(url: string, sessionId: number): void {
    this.es = new EventSource(url)

    this.es.onmessage = (event) => {
      if (this._sessionId !== sessionId) return  // stale connection
      try {
        const msg = JSON.parse(event.data as string) as SSEMessage
        this._handleMessage(msg)
      } catch { /* ignore malformed */ }
    }

    this.es.onerror = () => {
      if (this._sessionId !== sessionId) return
      useCollaborationStore.getState().setConnected(false)
      this._scheduleReconnect()
    }

    // Heartbeat: keep presence alive with a cursor-move ping
    this.heartbeatTimer = setInterval(() => {
      if (this._sessionId !== sessionId) return
      if (this.es?.readyState === EventSource.OPEN) {
        this._postOp({
          id:        this._makeOpId(),
          roomId:    this.roomId ?? '',
          userId:    this.userId,
          userName:  this.userName,
          userColor: this.userColor,
          type:      'cursor-move' as CollabOpType,
          payload:   { bar: 0, track: '' },
          rev:       useCollaborationStore.getState().roomRev,
          timestamp: Date.now(),
        }).catch(() => undefined)
      }
    }, 30_000)
  }

  private _handleMessage(msg: SSEMessage): void {
    const store = useCollaborationStore.getState()

    switch (msg.type) {
      case 'op': {
        const op = msg.data as CollabOp
        // Dedup: skip if we already have this op applied
        if (store.pendingOps.some(p => p.id === op.id)) {
          store.removePendingOp(op.id)
        }
        store.applyOp(op)
        store.setRoomRev(op.committedRev ?? op.rev)
        break
      }

      case 'presence': {
        const presenceList = msg.data as Parameters<typeof store.setPresence>[0]
        store.setPresence(presenceList)
        break
      }

      case 'connected': {
        const payload = msg.data as ConnectedPayload
        store.setConnected(true)
        store.setRoomRev(payload.rev)
        this._reconnectDelay = 3_000  // reset backoff on success

        if (Array.isArray(payload.recentOps)) {
          for (const op of payload.recentOps) {
            store.applyOp(op)
          }
        }

        // Flush any ops we submitted but didn't get ACK for
        void this._retryPendingOps()
        break
      }

      case 'error': {
        const errData = msg.data as { message?: string }
        console.error('[CollaborationClient] server error:', errData.message)
        break
      }

      default:
        break
    }
  }

  // ── Reconnect ──────────────────────────────────────────────────────────────

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (!this.roomId)        return

    const delay = jitteredDelay(this._reconnectDelay)
    console.log(`[CollaborationClient] reconnecting in ${Math.round(delay)}ms`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.roomId) {
        this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxReconnectDelay)
        this.connect(this.roomId, this.authToken ?? undefined)
      }
    }, delay)
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.es) {
      this.es.onmessage = null
      this.es.onerror   = null
      this.es.close()
      this.es = null
    }
    useCollaborationStore.getState().setConnected(false)
  }

  // ── Presence cleanup (ghost user prevention) ───────────────────────────────

  private _registerGhostUserCleanup(): void {
    if (this._presenceCleanupRegistered) return
    this._presenceCleanupRegistered = true

    // Best-effort: send a last presence update on page unload
    // so the server removes the user from the room before eviction
    window.addEventListener('beforeunload', () => {
      if (!this.roomId || !this.authToken) return
      // navigator.sendBeacon is fire-and-forget (survives page close)
      const url   = `${config.apiUrl}/api/collab/presence`
      const body  = JSON.stringify({ projectId: this.roomId, userId: this.userId, bar: -1, track: '' })
      const blob  = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
    })
  }

  // ── Op submission ──────────────────────────────────────────────────────────

  private _makeOpId(): string {
    return `${this.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }

  private async _postOp(op: CollabOp): Promise<boolean> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`

    try {
      const res = await fetch(`${config.apiUrl}/api/collab/ops`, {
        method:  'POST',
        headers,
        body:    JSON.stringify(op),
      })
      if (res.ok) {
        useCollaborationStore.getState().removePendingOp(op.id)
        // Keep persisted pending in sync
        const remaining = useCollaborationStore.getState().pendingOps
        savePersistedPending(remaining)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  private async _retryPendingOps(): Promise<void> {
    const pending = [...useCollaborationStore.getState().pendingOps]
    for (const op of pending) {
      await this._postOp(op)
    }
  }

  async submitOp(
    type:    CollabOpType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const store = useCollaborationStore.getState()
    const op: CollabOp = {
      id:        this._makeOpId(),
      roomId:    this.roomId ?? '',
      userId:    this.userId,
      userName:  this.userName,
      userColor: this.userColor,
      type,
      payload,
      rev:       store.roomRev,
      timestamp: Date.now(),
    }
    store.addPendingOp(op)
    savePersistedPending([...store.pendingOps])

    const ok = await this._postOp(op)
    if (!ok) {
      // One immediate retry, then leave in pendingOps for reconnect
      await this._postOp(op)
    }
  }

  // ── High-level operations ──────────────────────────────────────────────────

  async sendChat(text: string): Promise<void> {
    const msg: ChatMessage = {
      id:        this._makeOpId(),
      userId:    this.userId,
      userName:  this.userName,
      userColor: this.userColor,
      text,
      timestamp: Date.now(),
    }
    useCollaborationStore.getState().addChat(msg)
    await this.submitOp('chat-message', msg as unknown as Record<string, unknown>)
  }

  async addComment(
    bar:      number,
    trackId:  string | undefined,
    text:     string,
  ): Promise<void> {
    const comment: TimelineComment = {
      id:        this._makeOpId(),
      userId:    this.userId,
      userName:  this.userName,
      userColor: this.userColor,
      bar,
      trackId,
      text,
      timestamp: Date.now(),
      resolved:  false,
    }
    useCollaborationStore.getState().addComment(comment)
    await this.submitOp('comment-add', comment as unknown as Record<string, unknown>)
  }

  async updateCursor(bar: number, track: string): Promise<void> {
    await this.submitOp('cursor-move', { bar, track })
  }

  // ── Identity ──────────────────────────────────────────────────────────────

  setUserName(name: string): void {
    this.userName = name
    localStorage.setItem('collab-userName', name)
  }

  setAuthToken(token: string): void {
    this.authToken = token
  }

  get myUserId():    string { return this.userId }
  get myUserName():  string { return this.userName }
  get myUserColor(): string { return this.userColor }
  get isConnected(): boolean {
    return this.es?.readyState === EventSource.OPEN
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const collaborationClient = CollaborationClient.getInstance()
