import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useCollaboration } from '../../hooks/useCollaboration'
import type { TimelineComment } from '../../store/collaborationStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const COLOR_PALETTE = [
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Cyan',   value: '#06b6d4' },
  { label: 'Green',  value: '#10b981' },
  { label: 'Orange', value: '#f59e0b' },
  { label: 'Pink',   value: '#ec4899' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Indigo', value: '#6366f1' },
]

const OP_DESCRIPTIONS: Record<string, string> = {
  'param-change': 'changed a parameter',
  'clip-move':    'moved a clip',
  'clip-add':     'added a clip',
  'clip-delete':  'deleted a clip',
  'track-add':    'added a track',
  'track-delete': 'deleted a track',
  'comment-add':  'added a comment',
  'comment-resolve': 'resolved a comment',
  'chat-message': 'sent a message',
  'cursor-move':  'moved cursor',
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${color}33`,
        border: `2px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 700,
        color,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type TabId = 'live' | 'chat' | 'comments'

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'live',     label: 'Live'     },
    { id: 'chat',     label: 'Chat'     },
    { id: 'comments', label: 'Comments' },
  ]
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #1c1c2e', paddingLeft: 12, paddingRight: 12 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '10px 14px',
            fontSize: 12,
            fontWeight: 600,
            color: active === t.id ? '#a855f7' : '#475569',
            background: 'none',
            border: 'none',
            borderBottom: active === t.id ? '2px solid #7c3aed' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'color 0.15s',
            marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Live Tab ─────────────────────────────────────────────────────────────────

function LiveTab() {
  const {
    connected, presence, myUserId, myUserName, myUserColor,
    setUserName,
  } = useCollaboration()
  const recentOps = useRef<{ name: string; type: string; ts: number }[]>([])

  const [editName, setEditName] = useState(myUserName)
  const [selectedColor, setSelectedColor] = useState(myUserColor)

  function handleNameBlur() {
    if (editName.trim()) setUserName(editName.trim())
  }

  function handleColorSelect(color: string) {
    setSelectedColor(color)
    localStorage.setItem('collab-color', color)
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Connection status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: '#0c0c14', border: '1px solid #1c1c2e',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: connected ? '#10b981' : '#ef4444',
          boxShadow: connected ? '0 0 6px #10b981' : '0 0 6px #ef4444',
        }} />
        <span style={{ fontSize: 12, color: connected ? '#10b981' : '#ef4444', fontWeight: 600 }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <span style={{ fontSize: 11, color: '#475569', marginLeft: 'auto' }}>
          demo-project
        </span>
      </div>

      {/* Your identity */}
      <div style={{ padding: 12, borderRadius: 10, background: '#0c0c14', border: '1px solid #1c1c2e' }}>
        <p style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Your Identity
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar name={editName || 'You'} color={selectedColor} size={32} />
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            style={{
              flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 8,
              background: '#0f0f1a', border: '1px solid #1c1c2e',
              color: '#e2e8f0', outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => handleColorSelect(c.value)}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: c.value, cursor: 'pointer',
                border: selectedColor === c.value ? '2px solid #fff' : '2px solid transparent',
                outline: 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Collaborators */}
      <div>
        <p style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Collaborators ({presence.length})
        </p>
        {presence.length === 0 ? (
          <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', padding: '12px 0' }}>
            No one else is here yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {presence.map((u) => (
              <div
                key={u.userId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  background: '#0c0c14', border: '1px solid #1c1c2e',
                  opacity: u.userId === myUserId ? 0.7 : 1,
                }}
              >
                <Avatar name={u.userName} color={u.userColor} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                    {u.userName} {u.userId === myUserId ? '(you)' : ''}
                  </p>
                  {u.cursor && (
                    <p style={{ fontSize: 10, color: '#475569' }}>
                      Bar {u.cursor.bar} · {u.cursor.track}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 10, color: '#334155' }}>
                  {relativeTime(u.lastSeen)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      {recentOps.current.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Recent Activity
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentOps.current.slice(-10).map((op, i) => (
              <div key={i} style={{ fontSize: 11, color: '#475569', padding: '4px 0' }}>
                <span style={{ color: '#a855f7', fontWeight: 600 }}>{op.name}</span>
                {' '}{OP_DESCRIPTIONS[op.type] ?? op.type}
                <span style={{ color: '#334155', marginLeft: 6 }}>{relativeTime(op.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────

function ChatTab() {
  const { chatMessages, myUserId, sendChat } = useCollaboration()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    sendChat(trimmed).catch(() => undefined)
    setText('')
    textareaRef.current?.focus()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {chatMessages.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 24 }}>
            No messages yet
          </p>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex', gap: 8,
                flexDirection: msg.userId === myUserId ? 'row-reverse' : 'row',
              }}
            >
              <Avatar name={msg.userName} color={msg.userColor} size={26} />
              <div style={{ maxWidth: '75%' }}>
                <div style={{
                  display: 'flex', gap: 6, alignItems: 'baseline',
                  flexDirection: msg.userId === myUserId ? 'row-reverse' : 'row',
                  marginBottom: 3,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: msg.userColor }}>
                    {msg.userName}
                  </span>
                  <span style={{ fontSize: 10, color: '#334155' }}>
                    {relativeTime(msg.timestamp)}
                  </span>
                </div>
                <div style={{
                  padding: '7px 10px', borderRadius: 10, fontSize: 12, color: '#e2e8f0',
                  background: msg.userId === myUserId ? 'rgba(124,58,237,0.18)' : '#0c0c14',
                  border: `1px solid ${msg.userId === myUserId ? 'rgba(124,58,237,0.3)' : '#1c1c2e'}`,
                  lineHeight: 1.5,
                }}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: 10, borderTop: '1px solid #1c1c2e', display: 'flex', gap: 8 }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Enter to send)"
          rows={2}
          style={{
            flex: 1, fontSize: 12, padding: '7px 10px',
            borderRadius: 8, resize: 'none',
            background: '#0f0f1a', border: '1px solid #1c1c2e',
            color: '#e2e8f0', outline: 'none', caretColor: '#7c3aed',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          style={{
            padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed',
            opacity: text.trim() ? 1 : 0.45, alignSelf: 'flex-end', height: 34,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ─── Comments Tab ─────────────────────────────────────────────────────────────

function CommentsTab() {
  const { comments, addComment, resolveComment } = useCollaboration()
  const [showResolved, setShowResolved] = useState(false)
  const [bar, setBar] = useState(1)
  const [track, setTrack] = useState('')
  const [commentText, setCommentText] = useState('')

  // Group comments by bar
  const filtered = showResolved ? comments : comments.filter((c) => !c.resolved)
  const grouped = filtered.reduce<Record<number, TimelineComment[]>>((acc, c) => {
    const arr = acc[c.bar] ?? []
    arr.push(c)
    acc[c.bar] = arr
    return acc
  }, {})
  const barKeys = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)

  function handleAdd() {
    if (!commentText.trim()) return
    addComment(bar, track.trim() || undefined, commentText.trim()).catch(() => undefined)
    setCommentText('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Comment list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {/* Show resolved toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            onClick={() => setShowResolved((v) => !v)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              background: showResolved ? 'rgba(124,58,237,0.18)' : '#0c0c14',
              border: `1px solid ${showResolved ? 'rgba(124,58,237,0.35)' : '#1c1c2e'}`,
              color: showResolved ? '#a855f7' : '#475569',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            {showResolved ? 'Hide Resolved' : 'Show Resolved'}
          </button>
        </div>

        {barKeys.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 24 }}>
            No comments yet
          </p>
        ) : (
          barKeys.map((b) => (
            <div key={b} style={{ marginBottom: 14 }}>
              {/* Bar header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#06b6d4',
                  background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)',
                  padding: '2px 7px', borderRadius: 5,
                }}>
                  Bar {b}
                </span>
                <div style={{ flex: 1, height: 1, background: '#1c1c2e' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grouped[b].map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', gap: 8,
                      padding: '8px 10px', borderRadius: 8,
                      background: '#0c0c14', border: '1px solid #1c1c2e',
                      opacity: c.resolved ? 0.5 : 1,
                    }}
                  >
                    <Avatar name={c.userName} color={c.userColor} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.userColor }}>
                          {c.userName}
                        </span>
                        {c.trackId && (
                          <span style={{ fontSize: 10, color: '#475569' }}>· {c.trackId}</span>
                        )}
                        <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>
                          {relativeTime(c.timestamp)}
                        </span>
                      </div>
                      <p style={{
                        fontSize: 12, color: '#e2e8f0', lineHeight: 1.5,
                        textDecoration: c.resolved ? 'line-through' : 'none',
                        margin: 0,
                      }}>
                        {c.text}
                      </p>
                    </div>
                    {!c.resolved && (
                      <button
                        onClick={() => resolveComment(c.id)}
                        title="Resolve"
                        style={{
                          fontSize: 14, background: 'none', border: 'none',
                          color: '#475569', cursor: 'pointer', alignSelf: 'flex-start',
                          padding: '0 2px',
                        }}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add comment form */}
      <div style={{ padding: 10, borderTop: '1px solid #1c1c2e', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 3 }}>Bar</label>
            <input
              type="number"
              min={1}
              value={bar}
              onChange={(e) => setBar(Math.max(1, Number(e.target.value)))}
              style={{
                width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 7,
                background: '#0f0f1a', border: '1px solid #1c1c2e',
                color: '#e2e8f0', outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 3 }}>Track (optional)</label>
            <input
              type="text"
              placeholder="e.g. Kick"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              style={{
                width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 7,
                background: '#0f0f1a', border: '1px solid #1c1c2e',
                color: '#e2e8f0', outline: 'none',
              }}
            />
          </div>
        </div>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          style={{
            fontSize: 12, padding: '7px 10px', borderRadius: 7, resize: 'none',
            background: '#0f0f1a', border: '1px solid #1c1c2e',
            color: '#e2e8f0', outline: 'none', caretColor: '#7c3aed',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!commentText.trim()}
          style={{
            fontSize: 12, fontWeight: 600, padding: '7px',
            borderRadius: 7, border: 'none', cursor: commentText.trim() ? 'pointer' : 'not-allowed',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', opacity: commentText.trim() ? 1 : 0.45,
          }}
        >
          Add Comment
        </button>
      </div>
    </div>
  )
}

// ─── CollabPanel ──────────────────────────────────────────────────────────────

export default function CollabPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('live')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#08080f', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1c1c2e', flexShrink: 0 }}>
        <h2 style={{
          fontSize: 15, fontWeight: 700, margin: 0,
          background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Collaboration
        </h2>
        <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>
          Live editing · Chat · Comments
        </p>
      </div>

      {/* Tabs */}
      <div style={{ flexShrink: 0 }}>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {activeTab === 'live'     && <LiveTab />}
        {activeTab === 'chat'     && <ChatTab />}
        {activeTab === 'comments' && <CommentsTab />}
      </div>
    </div>
  )
}
