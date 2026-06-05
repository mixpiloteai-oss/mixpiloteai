import './admin.css'
import { useState, useEffect } from 'react'
import { adminApi, type SupportTicket } from './services/adminApi'

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

const PRIO_COLORS: Record<string, string> = {
  urgent: 'badge-red', high: 'badge-orange', medium: 'badge-purple', low: 'badge-grey',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'badge-red', in_progress: 'badge-orange', resolved: 'badge-green', closed: 'badge-grey',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
}

export default function Support() {
  const [tickets, setTickets]   = useState<SupportTicket[]>([])
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [filter, setFilter]     = useState<'all' | TicketStatus>('all')
  const [reply, setReply]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState('')

  async function loadTickets(status?: string) {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.tickets(status && status !== 'all' ? status : undefined)
      setTickets(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets(filter !== 'all' ? filter : undefined)
  }, [filter])

  async function handleReply() {
    if (!selected || !reply.trim()) return
    setSending(true)
    try {
      await adminApi.replyTicket(selected.id, reply)
      setReply('')
      await loadTickets(filter !== 'all' ? filter : undefined)
      // Refresh selected ticket
      const updated = await adminApi.tickets(undefined)
      const refreshed = updated.data.find(t => t.id === selected.id)
      if (refreshed) setSelected(refreshed)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  async function handleUpdateStatus(ticketId: string, status: string) {
    try {
      await adminApi.updateTicket(ticketId, status)
      await loadTickets(filter !== 'all' ? filter : undefined)
      if (selected?.id === ticketId) {
        setSelected(prev => prev ? { ...prev, status } : null)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  const visible = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)
  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length

  return (
    <div className="admin-fade-in" style={{ padding: 28 }}>
      {/* Header */}
      <div className="admin-header" style={{ padding: 0, marginBottom: 24 }}>
        <div>
          <div className="admin-page-title">Support</div>
          <div className="admin-page-sub">{openCount} open tickets</div>
        </div>
        <div className="admin-header-actions">
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
            <button key={s} onClick={() => { setFilter(s); setSelected(null) }}
              className={`admin-btn admin-btn-sm ${filter === s ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '340px 1fr' : '1fr', gap: 20 }}>
        {/* Ticket list */}
        <div className="admin-card admin-card-glow" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#334155', fontSize: 13 }}>Loading tickets…</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#334155', fontSize: 13 }}>
              No tickets in this status.
            </div>
          ) : visible.map((t, i) => (
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
                <span className={`admin-badge ${PRIO_COLORS[t.priority] ?? 'badge-grey'}`} style={{ fontSize: 10 }}>{t.priority}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{t.subject}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: '#475569' }}>{t.userName}</div>
                <span className={`admin-badge ${STATUS_COLORS[t.status] ?? 'badge-grey'}`} style={{ fontSize: 10 }}>
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
              </div>
            </div>
          ))}
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
                      {selected.userName} · {selected.userEmail}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`admin-badge ${PRIO_COLORS[selected.priority] ?? 'badge-grey'}`}>{selected.priority}</span>
                    <span className={`admin-badge ${STATUS_COLORS[selected.status] ?? 'badge-grey'}`}>{STATUS_LABELS[selected.status] ?? selected.status}</span>
                    <select
                      className="admin-select"
                      value={selected.status}
                      onChange={e => handleUpdateStatus(selected.id, e.target.value)}
                      style={{ fontSize: 11 }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {selected.messages?.map((msg, i) => (
                    <div key={i} style={{
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
                      onClick={handleReply}
                      disabled={!reply.trim() || sending}>
                      {sending ? 'Sending…' : 'Send Reply'}
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
