import './admin.css'
import { useState } from 'react'

type Priority = 'low' | 'medium' | 'high' | 'urgent'
type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

interface Message {
  id: number
  author: string
  role: 'user' | 'admin'
  text: string
  time: string
}

interface Ticket {
  id: string
  subject: string
  userName: string
  userEmail: string
  userInitials: string
  avatarColor: string
  priority: Priority
  status: TicketStatus
  category: string
  createdAt: string
  updatedAt: string
  messages: Message[]
}

const TICKETS: Ticket[] = [
  {
    id: 'TKT-0041', subject: 'Cannot export WAV — processing stuck at 94%',
    userName: 'Jordan Lee', userEmail: 'jordan.lee@email.com', userInitials: 'JL', avatarColor: '#22d3ee',
    priority: 'urgent', status: 'open', category: 'Export', createdAt: '2026-05-19 08:14', updatedAt: '2026-05-19 08:14',
    messages: [
      { id: 1, author: 'Jordan Lee', role: 'user', text: "Export has been stuck at 94% for 20 minutes. I'm on macOS 14, Studio plan. The project is 32 tracks at 145 BPM.", time: '08:14' },
    ],
  },
  {
    id: 'TKT-0040', subject: 'Billing charged twice this month',
    userName: 'Sam Patel', userEmail: 'sam.patel@beatz.co', userInitials: 'SP', avatarColor: '#f59e0b',
    priority: 'urgent', status: 'in_progress', category: 'Billing', createdAt: '2026-05-18 21:30', updatedAt: '2026-05-19 09:00',
    messages: [
      { id: 1, author: 'Sam Patel', role: 'user', text: "I was charged $49 twice on May 18. Please refund ASAP.", time: '21:30' },
      { id: 2, author: 'support@neurotek.ai', role: 'admin', text: "Hi Sam, we see the duplicate charge — it was a Stripe retry. We've issued a full refund, ETA 3-5 business days.", time: '09:00' },
    ],
  },
  {
    id: 'TKT-0039', subject: 'AI Assistant not generating patterns',
    userName: 'Alex Rivera', userEmail: 'alex.rivera@email.com', userInitials: 'AR', avatarColor: '#8b5cf6',
    priority: 'high', status: 'open', category: 'AI', createdAt: '2026-05-18 16:45', updatedAt: '2026-05-18 16:45',
    messages: [
      { id: 1, author: 'Alex Rivera', role: 'user', text: "The AI Assistant tab just shows a spinner and never generates anything. Been like this for 2 days.", time: '16:45' },
    ],
  },
  {
    id: 'TKT-0038', subject: 'Collaboration invite link expired too quickly',
    userName: 'Taylor Kim', userEmail: 'taylor.kim@studio.net', userInitials: 'TK', avatarColor: '#8b5cf6',
    priority: 'medium', status: 'resolved', category: 'Collaboration', createdAt: '2026-05-17 11:20', updatedAt: '2026-05-17 14:00',
    messages: [
      { id: 1, author: 'Taylor Kim', role: 'user', text: "Sent a collab invite, team member clicked it 2 hours later and it said expired.", time: '11:20' },
      { id: 2, author: 'support@neurotek.ai', role: 'admin', text: "Invite links expire after 7 days. The link used was actually 8 days old from a previous attempt. Please resend.", time: '13:40' },
      { id: 3, author: 'Taylor Kim', role: 'user', text: "Oh I see, sorry! Resent and it works. Thanks!", time: '14:00' },
    ],
  },
  {
    id: 'TKT-0037', subject: 'Marketplace pack download fails on large files',
    userName: 'Blake Anderson', userEmail: 'blake.a@soundcloud.io', userInitials: 'BA', avatarColor: '#10b981',
    priority: 'high', status: 'open', category: 'Marketplace', createdAt: '2026-05-16 18:00', updatedAt: '2026-05-16 18:00',
    messages: [
      { id: 1, author: 'Blake Anderson', role: 'user', text: "Trying to download 'Dark Industrial Kicks Vol 2' (2.4GB). Download starts and fails at ~30%. Tried 3 times.", time: '18:00' },
    ],
  },
  {
    id: 'TKT-0036', subject: 'Cannot change subscription plan',
    userName: 'Drew Martinez', userEmail: 'drew.m@email.com', userInitials: 'DM', avatarColor: '#f59e0b',
    priority: 'medium', status: 'in_progress', category: 'Billing', createdAt: '2026-05-15 09:30', updatedAt: '2026-05-15 10:15',
    messages: [
      { id: 1, author: 'Drew Martinez', role: 'user', text: "The upgrade button on billing page shows error 'Payment method required'. I have a card saved.", time: '09:30' },
      { id: 2, author: 'support@neurotek.ai', role: 'admin', text: "Investigating — can you try removing and re-adding your card? Known intermittent issue with card tokenization.", time: '10:15' },
    ],
  },
  {
    id: 'TKT-0035', subject: 'Piano roll MIDI import broken',
    userName: 'Skyler Davis', userEmail: 'skyler.davis@daw.net', userInitials: 'SD', avatarColor: '#8b5cf6',
    priority: 'low', status: 'closed', category: 'App', createdAt: '2026-05-14 13:00', updatedAt: '2026-05-14 17:00',
    messages: [
      { id: 1, author: 'Skyler Davis', role: 'user', text: "Dragging a .mid file into piano roll does nothing.", time: '13:00' },
      { id: 2, author: 'support@neurotek.ai', role: 'admin', text: "MIDI import via drag-drop is planned for v2.1. For now, use File → Import MIDI. Closing as expected behavior.", time: '17:00' },
    ],
  },
  {
    id: 'TKT-0034', subject: 'Refund request — wrong plan purchased',
    userName: 'Morgan Chen', userEmail: 'morgan.chen@music.io', userInitials: 'MC', avatarColor: '#10b981',
    priority: 'medium', status: 'resolved', category: 'Billing', createdAt: '2026-05-13 14:00', updatedAt: '2026-05-14 09:00',
    messages: [
      { id: 1, author: 'Morgan Chen', role: 'user', text: "Accidentally purchased Studio instead of Pro. Can I get a refund and switch?", time: '14:00' },
      { id: 2, author: 'support@neurotek.ai', role: 'admin', text: "Refund issued for Studio, Pro plan activated. You should see the credit within 5 days. 😊", time: '09:00' },
    ],
  },
]

const PRIO_COLORS: Record<Priority, string> = {
  urgent: 'badge-red', high: 'badge-orange', medium: 'badge-purple', low: 'badge-grey',
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'badge-red', in_progress: 'badge-orange', resolved: 'badge-green', closed: 'badge-grey',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
}

export default function Support() {
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [filter, setFilter] = useState<'all' | TicketStatus>('all')
  const [reply, setReply] = useState('')

  const visible = filter === 'all' ? TICKETS : TICKETS.filter(t => t.status === filter)

  return (
    <div className="admin-fade-in" style={{ padding: 28 }}>
      {/* Header */}
      <div className="admin-header" style={{ padding: 0, marginBottom: 24 }}>
        <div>
          <div className="admin-page-title">Support</div>
          <div className="admin-page-sub">{TICKETS.filter(t => t.status === 'open' || t.status === 'in_progress').length} open tickets</div>
        </div>
        <div className="admin-header-actions">
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`admin-btn admin-btn-sm ${filter === s ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '340px 1fr' : '1fr', gap: 20 }}>
        {/* Ticket list */}
        <div className="admin-card admin-card-glow" style={{ overflow: 'hidden' }}>
          {visible.map((t, i) => (
            <div key={t.id}
              onClick={() => setSelected(selected?.id === t.id ? null : t)}
              style={{
                padding: '14px 16px', cursor: 'pointer', borderBottom: i < visible.length - 1 ? '1px solid #1a1a2e' : 'none',
                background: selected?.id === t.id ? 'rgba(139,92,246,0.08)' : 'transparent',
                borderLeft: selected?.id === t.id ? '2px solid #8b5cf6' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{t.id}</div>
                <span className={`admin-badge ${PRIO_COLORS[t.priority]}`} style={{ fontSize: 10 }}>{t.priority}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{t.subject}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: '#475569' }}>{t.userName} · {t.category}</div>
                <span className={`admin-badge ${STATUS_COLORS[t.status]}`} style={{ fontSize: 10 }}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#334155', fontSize: 13 }}>
              No tickets in this status.
            </div>
          )}
        </div>

        {/* Ticket Detail */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="admin-card admin-card-glow">
              <div className="admin-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginBottom: 4 }}>{selected.id}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{selected.subject}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                      {selected.userName} · {selected.userEmail} · {selected.category}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className={`admin-badge ${PRIO_COLORS[selected.priority]}`}>{selected.priority}</span>
                    <span className={`admin-badge ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {selected.messages.map(msg => (
                    <div key={msg.id} style={{
                      padding: '12px 16px', borderRadius: 10,
                      background: msg.role === 'admin' ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${msg.role === 'admin' ? 'rgba(139,92,246,0.15)' : '#1a1a2e'}`,
                      alignSelf: msg.role === 'admin' ? 'flex-end' : 'flex-start',
                      maxWidth: '90%',
                    }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: msg.role === 'admin' ? '#8b5cf6' : '#22d3ee' }}>
                          {msg.author}
                        </span>
                        <span style={{ fontSize: 11, color: '#334155' }}>{msg.time}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{msg.text}</div>
                    </div>
                  ))}
                </div>

                {/* Reply */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Write a reply..."
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8, resize: 'vertical',
                      background: '#0c0c18', border: '1px solid #1a1a2e', color: '#e2e8f0',
                      fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="admin-btn admin-btn-ghost admin-btn-sm"
                      onClick={() => setSelected(null)}>Close</button>
                    <button className="admin-btn admin-btn-primary admin-btn-sm"
                      onClick={() => setReply('')} disabled={!reply.trim()}>
                      Send Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
