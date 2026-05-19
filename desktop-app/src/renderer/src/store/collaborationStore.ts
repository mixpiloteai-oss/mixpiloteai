import { create } from 'zustand'

export type CollabOpType =
  | 'param-change'
  | 'clip-move'
  | 'clip-add'
  | 'clip-delete'
  | 'track-add'
  | 'track-delete'
  | 'comment-add'
  | 'comment-resolve'
  | 'chat-message'
  | 'cursor-move'

export interface CollabOp {
  id: string
  roomId: string
  userId: string
  userName: string
  userColor: string
  type: CollabOpType
  payload: Record<string, unknown>
  rev: number
  timestamp: number
  committedRev?: number
}

export interface UserPresence {
  userId: string
  userName: string
  userColor: string
  cursor?: { bar: number; track: string }
  lastSeen: number
}

export interface ChatMessage {
  id: string
  userId: string
  userName: string
  userColor: string
  text: string
  timestamp: number
}

export interface TimelineComment {
  id: string
  userId: string
  userName: string
  userColor: string
  bar: number
  trackId?: string
  text: string
  timestamp: number
  resolved: boolean
}

const COLOR_PALETTE = [
  '#7c3aed', // purple
  '#06b6d4', // cyan
  '#10b981', // green
  '#f59e0b', // orange
  '#ec4899', // pink
  '#ef4444', // red
  '#eab308', // yellow
  '#6366f1', // indigo
]

function getInitialColor(): string {
  const saved = localStorage.getItem('collab-color')
  if (saved) return saved
  const idx = Math.floor(Math.random() * COLOR_PALETTE.length)
  const color = COLOR_PALETTE[idx]
  localStorage.setItem('collab-color', color)
  return color
}

interface CollabStore {
  connected: boolean
  projectId: string | null
  roomRev: number
  presence: UserPresence[]
  recentOps: CollabOp[]       // last 100 applied ops
  chatMessages: ChatMessage[] // last 200
  comments: TimelineComment[]
  pendingOps: CollabOp[]      // local ops not yet acked
  myColor: string             // assigned user color

  // Actions
  setConnected: (v: boolean) => void
  setProjectId: (id: string | null) => void
  setPresence: (p: UserPresence[]) => void
  applyOp: (op: CollabOp) => void
  addChat: (msg: ChatMessage) => void
  addComment: (c: TimelineComment) => void
  resolveComment: (id: string) => void
  addPendingOp: (op: CollabOp) => void
  removePendingOp: (id: string) => void
  setRoomRev: (rev: number) => void
  reset: () => void
}

const initialState = {
  connected: false,
  projectId: null,
  roomRev: 0,
  presence: [] as UserPresence[],
  recentOps: [] as CollabOp[],
  chatMessages: [] as ChatMessage[],
  comments: [] as TimelineComment[],
  pendingOps: [] as CollabOp[],
  myColor: getInitialColor(),
}

export const useCollaborationStore = create<CollabStore>((set) => ({
  ...initialState,

  setConnected: (v) => set({ connected: v }),

  setProjectId: (id) => set({ projectId: id }),

  setPresence: (p) => set({ presence: p }),

  applyOp: (op) =>
    set((state) => {
      const recentOps = [...state.recentOps, op].slice(-100)

      if (op.type === 'chat-message') {
        const chatMessages = [...state.chatMessages, op.payload as unknown as ChatMessage].slice(-200)
        return { recentOps, chatMessages }
      }

      if (op.type === 'comment-add') {
        const comment = op.payload as unknown as TimelineComment
        return { recentOps, comments: [...state.comments, comment] }
      }

      if (op.type === 'comment-resolve') {
        const commentId = op.payload['commentId'] as string
        const comments = state.comments.map((c) =>
          c.id === commentId ? { ...c, resolved: true } : c
        )
        return { recentOps, comments }
      }

      return { recentOps }
    }),

  addChat: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, msg].slice(-200),
    })),

  addComment: (c) =>
    set((state) => ({
      comments: [...state.comments, c],
    })),

  resolveComment: (id) =>
    set((state) => ({
      comments: state.comments.map((c) =>
        c.id === id ? { ...c, resolved: true } : c
      ),
    })),

  addPendingOp: (op) =>
    set((state) => ({
      pendingOps: [...state.pendingOps, op],
    })),

  removePendingOp: (id) =>
    set((state) => ({
      pendingOps: state.pendingOps.filter((op) => op.id !== id),
    })),

  setRoomRev: (rev) => set({ roomRev: rev }),

  reset: () => set({ ...initialState, myColor: getInitialColor() }),
}))
