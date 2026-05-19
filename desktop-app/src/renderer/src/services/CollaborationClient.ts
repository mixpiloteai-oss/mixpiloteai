import {
  useCollaborationStore,
  type CollabOpType,
  type CollabOp,
  type ChatMessage,
  type TimelineComment,
} from '../store/collaborationStore'
import { config } from '../lib/config'

interface SSEMessage {
  type: 'op' | 'presence' | 'connected' | 'error'
  data: unknown
}

interface ConnectedPayload {
  rev: number
  recentOps?: CollabOp[]
}

export class CollaborationClient {
  private static instance: CollaborationClient | null = null

  static getInstance(): CollaborationClient {
    if (!CollaborationClient.instance) {
      CollaborationClient.instance = new CollaborationClient()
    }
    return CollaborationClient.instance
  }

  private es: EventSource | null = null
  private roomId: string | null = null
  private userId: string
  private userName: string
  private userColor: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectDelay = 3000
  private maxReconnectDelay = 30000

  constructor() {
    this.userId =
      localStorage.getItem('collab-userId') ??
      `user_${Math.random().toString(36).slice(2, 8)}`
    this.userName = localStorage.getItem('collab-userName') ?? 'Producer'
    this.userColor = localStorage.getItem('collab-color') ?? '#7c3aed'
    localStorage.setItem('collab-userId', this.userId)
  }

  connect(projectId: string): void {
    if (this.roomId === projectId && this.es?.readyState === EventSource.OPEN) {
      return
    }

    this.disconnect()
    this.roomId = projectId
    useCollaborationStore.getState().setProjectId(projectId)

    const params = new URLSearchParams({
      userId: this.userId,
      userName: this.userName,
      userColor: this.userColor,
    })

    const url = `${config.apiUrl}/api/collab/stream/${projectId}?${params.toString()}`
    this.es = new EventSource(url)

    this.es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as SSEMessage
        this.handleMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }

    this.es.onerror = () => {
      useCollaborationStore.getState().setConnected(false)
      this.scheduleReconnect()
    }

    // Heartbeat: update cursor to keep presence alive
    this.heartbeatTimer = setInterval(() => {
      if (this.es?.readyState === EventSource.OPEN) {
        this.updateCursor(0, '').catch(() => undefined)
      }
    }, 30_000)
  }

  private handleMessage(msg: SSEMessage): void {
    const store = useCollaborationStore.getState()

    switch (msg.type) {
      case 'op': {
        const op = msg.data as CollabOp
        store.applyOp(op)
        store.setRoomRev(op.committedRev ?? op.rev)
        store.removePendingOp(op.id)
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
        this.reconnectDelay = 3000 // reset backoff on successful connect
        if (Array.isArray(payload.recentOps)) {
          for (const op of payload.recentOps) {
            store.applyOp(op)
          }
        }
        // Retry any pending ops
        this.retryPendingOps()
        break
      }
      default:
        break
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (!this.roomId) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.roomId) {
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        )
        this.connect(this.roomId)
      }
    }, this.reconnectDelay)
  }

  private async retryPendingOps(): Promise<void> {
    const pending = useCollaborationStore.getState().pendingOps
    for (const op of pending) {
      await this.postOp(op)
    }
  }

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
      this.es.onerror = null
      this.es.close()
      this.es = null
    }
    useCollaborationStore.getState().setConnected(false)
  }

  private makeOpId(): string {
    return `${this.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }

  private async postOp(op: CollabOp): Promise<void> {
    try {
      const res = await fetch(`${config.apiUrl}/api/collab/ops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      })
      if (res.ok) {
        useCollaborationStore.getState().removePendingOp(op.id)
      }
    } catch {
      // keep in pendingOps, will retry on reconnect
    }
  }

  async submitOp(
    type: CollabOpType,
    payload: Record<string, unknown>
  ): Promise<void> {
    const store = useCollaborationStore.getState()
    const op: CollabOp = {
      id: this.makeOpId(),
      roomId: this.roomId ?? '',
      userId: this.userId,
      userName: this.userName,
      userColor: this.userColor,
      type,
      payload,
      rev: store.roomRev,
      timestamp: Date.now(),
    }
    store.addPendingOp(op)

    try {
      const res = await fetch(`${config.apiUrl}/api/collab/ops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      })
      if (res.ok) {
        store.removePendingOp(op.id)
      } else {
        // One retry
        await this.postOp(op)
      }
    } catch {
      // Keep in pendingOps; will retry after reconnect
    }
  }

  async sendChat(text: string): Promise<void> {
    const msg: ChatMessage = {
      id: this.makeOpId(),
      userId: this.userId,
      userName: this.userName,
      userColor: this.userColor,
      text,
      timestamp: Date.now(),
    }
    // Optimistically add to store
    useCollaborationStore.getState().addChat(msg)

    await this.submitOp('chat-message', msg as unknown as Record<string, unknown>)
  }

  async addComment(
    bar: number,
    trackId: string | undefined,
    text: string
  ): Promise<void> {
    const comment: TimelineComment = {
      id: this.makeOpId(),
      userId: this.userId,
      userName: this.userName,
      userColor: this.userColor,
      bar,
      trackId,
      text,
      timestamp: Date.now(),
      resolved: false,
    }
    useCollaborationStore.getState().addComment(comment)

    await this.submitOp(
      'comment-add',
      comment as unknown as Record<string, unknown>
    )
  }

  async updateCursor(bar: number, track: string): Promise<void> {
    await this.submitOp('cursor-move', { bar, track })
  }

  setUserName(name: string): void {
    this.userName = name
    localStorage.setItem('collab-userName', name)
  }

  get myUserId(): string {
    return this.userId
  }

  get myUserName(): string {
    return this.userName
  }

  get myUserColor(): string {
    return this.userColor
  }
}

export const collaborationClient = CollaborationClient.getInstance()
