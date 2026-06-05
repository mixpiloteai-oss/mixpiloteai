import { useState, useEffect, useCallback } from 'react'
import './admin.css'

const API = import.meta.env.VITE_API_URL ?? 'https://mixpiloteai-production.up.railway.app'

interface ErrorEvent {
  id:        string
  type:      string
  severity:  'info' | 'success' | 'warn' | 'error'
  message:   string
  userId?:   string
  email?:    string
  ip?:       string
  meta?:     Record<string, unknown>
  timestamp: number
}

export default function ErrorLogs() {
  const [events, setEvents] = useState<ErrorEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [severity, setSeverity] = useState<'all' | 'error' | 'warn'>('all')
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selected, setSelected] = useState<ErrorEvent | null>(null)

  const load = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin-jwt') ?? ''
      const res = await fetch(`${API}/api/admin/realtime/errors?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const { data } = await res.json()
        setEvents(data.events ?? [])
      }
    } catch (e) {
      console.error('[error-logs] fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    if (!autoRefresh) return
    const id = setInterval(load, 5_000)
    return () => clearInterval(id)
  }, [load, autoRefresh])

  const filtered = events.filter(e => {
    if (severity !== 'all' && e.severity !== severity) return false
    if (search) {
      const q = search.toLowerCase()
      const inMsg = e.message.toLowerCase().includes(q)
      const inEmail = e.email?.toLowerCase().includes(q)
      const inIp = e.ip?.toLowerCase().includes(q)
      if (!inMsg && !inEmail && !inIp) return false
    }
    return true
  })

  const errorCount = events.filter(e => e.severity === 'error').length
  const warnCount  = events.filter(e => e.severity === 'warn').length

  return (
    <div className="admin-fade-in" style={{ paddingBottom: 40 }}>
      <div className="admin-header">
        <div>
          <div className="admin-page-title">Error Logs</div>
          <div className="admin-page-sub">Centralized error and warning stream</div>
        </div>
        <div className="admin-header-actions">
          <label style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button className="admin-refresh-btn" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '0 28px', marginBottom: 24 }}>
        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#ef4444' }} />
          <div className="admin-stat-value" style={{ color: '#ef4444' }}>{errorCount}</div>
          <div className="admin-stat-label">Errors</div>
        </div>
        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#f59e0b' }} />
          <div className="admin-stat-value" style={{ color: '#f59e0b' }}>{warnCount}</div>
          <div className="admin-stat-label">Warnings</div>
        </div>
        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#94a3b8' }} />
          <div className="admin-stat-value" style={{ color: '#cbd5e1' }}>{events.length}</div>
          <div className="admin-stat-label">Total Events</div>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        {(['all', 'error', 'warn'] as const).map(s => (
          <button
            key={s}
            className={`admin-btn ${severity === s ? 'admin-btn-primary' : 'admin-btn-ghost'} admin-btn-sm`}
            onClick={() => setSeverity(s)}
          >
            {s.toUpperCase()}
          </button>
        ))}
        <input
          type="search"
          placeholder="Search by message, email, or IP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e2e8f0',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
      </div>

      {/* Event list */}
      <div style={{ padding: '0 28px' }}>
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            {loading ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#475569', fontSize: 12 }}>
                Loading events…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#475569', fontSize: 12 }}>
                No matching events
              </div>
            ) : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {filtered.map(e => (
                  <div
                    key={e.id}
                    onClick={() => setSelected(e)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '12px 100px 1fr 200px',
                      gap: 12,
                      padding: '10px 8px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: e.severity === 'error' ? '#ef4444' : '#f59e0b',
                    }} />
                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                      {e.type}
                    </span>
                    <div>
                      <div style={{ fontSize: 12, color: e.severity === 'error' ? '#fecaca' : '#fde68a' }}>
                        {e.message}
                      </div>
                      {(e.email || e.ip) && (
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                          {[e.email, e.ip].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', textAlign: 'right' }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: 24, maxWidth: 720, width: '100%',
              maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Event Details</div>
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setSelected(null)}
              >
                ✕ Close
              </button>
            </div>
            <pre style={{
              background: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 6,
              fontSize: 11, color: '#cbd5e1', overflowX: 'auto',
              fontFamily: 'monospace', whiteSpace: 'pre-wrap',
            }}>
              {JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
