// ============================================================
// NEUROTEK AI — Collab Presence Bar
// Shows live collaborators with cursor positions.
// Reconnect-resilient: restores from localStorage on page load.
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Collaborator {
  userId: string
  userName: string
  userColor: string
  cursor?: { bar: number; track: string }
  lastSeen: number
  isOnline: boolean
}

interface CollabPresenceBarProps {
  projectId: string
  currentUserId?: string
  maxAvatars?: number
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 5_000)   return 'just now'
  if (diff < 60_000)  return `${Math.floor(diff / 1_000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function CollabPresenceBar({
  projectId,
  currentUserId,
  maxAvatars = 5,
}: CollabPresenceBarProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [isConnected, setIsConnected]     = useState(false)
  const [showList, setShowList]           = useState(false)
  const storageKey = `collab-presence-${projectId}`
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelay = useRef(3_000)

  // Persist presence to localStorage for cross-refresh resilience
  function persistPresence(collabs: Collaborator[]): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(
        collabs.map(c => ({ ...c, isOnline: false }))
      ))
    } catch { /* ignore quota */ }
  }

  function loadPersistedPresence(): Collaborator[] {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return []
      return (JSON.parse(raw) as Collaborator[]).filter(
        c => Date.now() - c.lastSeen < 30 * 60 * 1000 // last 30 min
      )
    } catch { return [] }
  }

  function connect(): void {
    const token = localStorage.getItem('nt_access_token')
    if (!token) return
    const sinceRev = localStorage.getItem(`collab-rev-${projectId}`) ?? '0'
    const url = `/api/collab/stream/${projectId}?token=${token}&sinceRev=${sinceRev}`

    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('connected', () => {
      setIsConnected(true)
      reconnectDelay.current = 3_000
    })

    es.addEventListener('presence', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { presence: Collaborator[] }
        const updated = (data.presence ?? []).map(p => ({ ...p, isOnline: true }))
        setCollaborators(prev => {
          // Merge: update online users, keep offline users (last 30min) as greyed
          const map = new Map(prev.map(c => [c.userId, c]))
          for (const u of updated) { map.set(u.userId, u) }
          // Mark users not in update as offline
          for (const [id, c] of map) {
            if (!updated.find(u => u.userId === id)) {
              map.set(id, { ...c, isOnline: false })
            }
          }
          const result = [...map.values()]
            .filter(c => c.userId !== currentUserId)
            .sort((a, b) => Number(b.isOnline) - Number(a.isOnline))
          persistPresence(result)
          return result
        })
      } catch { /* ignore */ }
    })

    es.onerror = () => {
      setIsConnected(false)
      es.close()
      esRef.current = null
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, 60_000)
        connect()
      }, reconnectDelay.current * (0.8 + Math.random() * 0.4))
    }
  }

  useEffect(() => {
    // Load persisted presence immediately (before SSE connects)
    setCollaborators(loadPersistedPresence())
    connect()
    return () => {
      esRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const online  = collaborators.filter(c => c.isOnline)
  const offline = collaborators.filter(c => !c.isOnline)
  const visible = collaborators.slice(0, maxAvatars)
  const overflow = collaborators.length - maxAvatars

  return (
    <div className="relative flex items-center gap-2">
      {/* Connection indicator */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        isConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-600'
      }`} title={isConnected ? 'Connected' : 'Reconnecting...'} />

      {/* Avatar stack */}
      <div
        className="flex items-center cursor-pointer"
        style={{ gap: '-4px' }}
        onClick={() => setShowList(s => !s)}
      >
        <AnimatePresence>
          {visible.map((c, i) => (
            <motion.div
              key={c.userId}
              initial={{ opacity: 0, scale: 0.7, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ delay: i * 0.05 }}
              style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: visible.length - i }}
            >
              <div
                className={`w-8 h-8 rounded-full border-2 border-[#0d0d16] flex items-center justify-center text-xs font-bold text-white
                  ${c.isOnline ? 'ring-2 ring-green-400/60' : 'opacity-50'}`}
                style={{ backgroundColor: c.userColor }}
                title={`${c.userName}${c.cursor ? ` — Bar ${c.cursor.bar}` : ''} (${timeAgo(c.lastSeen)})`}
              >
                {getInitials(c.userName)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-[#0d0d16] bg-[#2d2d3d] flex items-center justify-center text-xs text-slate-300"
            style={{ marginLeft: '-8px', zIndex: 0 }}>
            +{overflow}
          </div>
        )}
        {collaborators.length === 0 && (
          <span className="text-slate-600 text-xs">No collaborators</span>
        )}
      </div>

      {/* Presence popover */}
      <AnimatePresence>
        {showList && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute top-10 left-0 z-50 w-64 bg-[#13131a] border border-[#2d2d3d] rounded-xl shadow-2xl p-3 space-y-1"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">
              Collaborators &middot; {online.length} online
            </p>
            {[...online, ...offline].map(c => (
              <div key={c.userId} className="flex items-center gap-2 py-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${c.isOnline ? '' : 'opacity-40'}`}
                  style={{ backgroundColor: c.userColor }}
                >
                  {getInitials(c.userName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${c.isOnline ? 'text-slate-100' : 'text-slate-500'}`}>
                    {c.userName}
                    {c.isOnline && <span className="ml-1 text-xs text-green-400">&#9679;</span>}
                  </p>
                  {c.cursor && c.isOnline && (
                    <p className="text-xs text-slate-600">Bar {c.cursor.bar} &middot; {c.cursor.track}</p>
                  )}
                  {!c.isOnline && (
                    <p className="text-xs text-slate-700">{timeAgo(c.lastSeen)}</p>
                  )}
                </div>
              </div>
            ))}
            {collaborators.length === 0 && (
              <p className="text-slate-600 text-xs py-2 text-center">No recent collaborators</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close popover on outside click */}
      {showList && (
        <div className="fixed inset-0 z-40" onClick={() => setShowList(false)} />
      )}
    </div>
  )
}
