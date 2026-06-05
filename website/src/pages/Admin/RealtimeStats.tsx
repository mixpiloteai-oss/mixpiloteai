import { useState, useEffect, useRef, useCallback } from 'react'
import './admin.css'

const API = import.meta.env.VITE_API_URL ?? 'https://mixpiloteai-production.up.railway.app'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServerHealth {
  timestamp: number
  uptime:    { process: number; system: number }
  process:   {
    pid: number; version: string; platform: string; arch: string
    memory: { rssMB: number; heapUsedMB: number; heapTotalMB: number; externalMB: number }
  }
  system: {
    hostname: string; cpus: number; model: string
    load: { avg1m: number; avg5m: number; avg15m: number }
    memory: { totalMB: number; freeMB: number; usedPct: number }
  }
  requests: {
    uptimeSeconds: number; totalRequests: number; errorRate: string
    responseTime: { p50: number; p95: number; p99: number; samples: number }
  }
  authThrottle: { tracked: number; locked: number }
}

interface ActivityEvent {
  id: string; type: string; severity: 'info' | 'success' | 'warn' | 'error'
  message: string; userId?: string; email?: string; ip?: string
  meta?: Record<string, unknown>; timestamp: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUptime(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  if (sec < 86400) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${h}h ${m}m`
  }
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  return `${d}d ${h}h`
}

function fmtRelative(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000)
  if (diff < 5) return 'now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleString()
}

function sevColor(s: string): string {
  return s === 'error' ? '#ef4444'
    : s === 'warn'    ? '#f59e0b'
    : s === 'success' ? '#10b981'
    : '#22d3ee'
}

function typeIcon(t: string): string {
  return t === 'auth'        ? '🔐'
    : t === 'signup'         ? '✨'
    : t === 'payment'        ? '💳'
    : t === 'subscription'   ? '🎟️'
    : t === 'upload'         ? '⬆️'
    : t === 'ai_request'     ? '🤖'
    : t === 'admin_action'   ? '⚙️'
    : t === 'error'          ? '⚠️'
    : '•'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RealtimeStats() {
  const [health, setHealth] = useState<ServerHealth | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [paused, setPaused] = useState(false)
  const [streamConnected, setStreamConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const loadHealth = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin-jwt') ?? ''
      const res = await fetch(`${API}/api/admin/realtime/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const { data } = await res.json()
        setHealth(data)
      }
    } catch (e) {
      console.error('[realtime] health fetch failed:', e)
    }
  }, [])

  // Poll health every 3s
  useEffect(() => {
    loadHealth()
    const id = setInterval(loadHealth, 3_000)
    return () => clearInterval(id)
  }, [loadHealth])

  // SSE stream
  useEffect(() => {
    if (paused) return

    const token = localStorage.getItem('admin-jwt') ?? ''
    const es = new EventSource(`${API}/api/admin/realtime/stream?token=${encodeURIComponent(token)}`)
    esRef.current = es

    es.onopen = () => setStreamConnected(true)
    es.onerror = () => setStreamConnected(false)

    es.addEventListener('snapshot', (e) => {
      try {
        const snapshot = JSON.parse((e as MessageEvent).data) as ActivityEvent[]
        setEvents(snapshot)
      } catch { /* ignore */ }
    })

    es.addEventListener('activity', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as ActivityEvent
        setEvents(prev => [evt, ...prev].slice(0, 100))
      } catch { /* ignore */ }
    })

    return () => {
      es.close()
      esRef.current = null
      setStreamConnected(false)
    }
  }, [paused])

  const filtered = filter === 'all' ? events : events.filter(e => e.severity === filter || e.type === filter)

  return (
    <div className="admin-fade-in" style={{ paddingBottom: 40 }}>
      <div className="admin-header">
        <div>
          <div className="admin-page-title">Realtime Stats</div>
          <div className="admin-page-sub">Live server health and activity feed</div>
        </div>
        <div className="admin-header-actions">
          <span className="admin-live-dot" style={{
            background: streamConnected ? '#10b981' : '#ef4444',
            boxShadow: streamConnected ? '0 0 8px #10b981' : '0 0 8px #ef4444',
          }} />
          <span style={{ fontSize: 11, color: '#334155' }}>
            {streamConnected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => setPaused(p => !p)}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* Health cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '0 28px', marginBottom: 24 }}>
        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#22d3ee' }} />
          <div className="admin-stat-value" style={{ color: '#22d3ee' }}>
            {health ? fmtUptime(health.uptime.process) : '—'}
          </div>
          <div className="admin-stat-label">Process Uptime</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            System: {health ? fmtUptime(health.uptime.system) : '—'}
          </div>
        </div>

        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#8b5cf6' }} />
          <div className="admin-stat-value" style={{ color: '#8b5cf6' }}>
            {health ? `${health.process.memory.rssMB} MB` : '—'}
          </div>
          <div className="admin-stat-label">Process Memory (RSS)</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            Heap: {health ? `${health.process.memory.heapUsedMB}/${health.process.memory.heapTotalMB} MB` : '—'}
          </div>
        </div>

        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#10b981' }} />
          <div className="admin-stat-value" style={{ color: '#10b981' }}>
            {health ? health.requests.totalRequests.toLocaleString() : '—'}
          </div>
          <div className="admin-stat-label">Total Requests</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            Error rate: {health?.requests.errorRate ?? '—'}
          </div>
        </div>

        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#f59e0b' }} />
          <div className="admin-stat-value" style={{ color: '#f59e0b' }}>
            {health ? `${health.requests.responseTime.p95}ms` : '—'}
          </div>
          <div className="admin-stat-label">P95 Response Time</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            P50: {health?.requests.responseTime.p50 ?? '—'}ms · P99: {health?.requests.responseTime.p99 ?? '—'}ms
          </div>
        </div>
      </div>

      {/* System info */}
      <div className="admin-grid-2">
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">System</div>
            {health ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <Row label="Hostname"     value={health.system.hostname} />
                <Row label="CPUs"         value={`${health.system.cpus} × ${health.system.model.slice(0, 40)}`} />
                <Row label="Load Avg"     value={`${health.system.load.avg1m} / ${health.system.load.avg5m} / ${health.system.load.avg15m}`} />
                <Row label="System Memory" value={`${health.system.memory.totalMB - health.system.memory.freeMB} / ${health.system.memory.totalMB} MB (${health.system.memory.usedPct}%)`}
                  color={health.system.memory.usedPct > 85 ? '#ef4444' : '#94a3b8'} />
                <Row label="Node Version" value={health.process.version} />
                <Row label="Platform"     value={`${health.process.platform} (${health.process.arch})`} />
                <Row label="PID"          value={String(health.process.pid)} />
              </div>
            ) : (
              <div style={{ color: '#334155', fontSize: 12 }}>Loading…</div>
            )}
          </div>
        </div>

        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Auth Security</div>
            {health ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <Row label="Tracked accounts"     value={health.authThrottle.tracked.toLocaleString()} />
                <Row label="Locked accounts"      value={health.authThrottle.locked.toLocaleString()}
                  color={health.authThrottle.locked > 0 ? '#ef4444' : '#10b981'} />
                <Row label="Response samples"     value={health.requests.responseTime.samples.toLocaleString()} />
              </div>
            ) : (
              <div style={{ color: '#334155', fontSize: 12 }}>Loading…</div>
            )}
          </div>
        </div>
      </div>

      {/* Live activity feed */}
      <div style={{ padding: '0 28px' }}>
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="admin-card-title" style={{ margin: 0 }}>Live Activity</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'error', 'warn', 'auth', 'payment', 'admin_action'].map(f => (
                  <button
                    key={f}
                    className={`admin-btn admin-btn-sm ${filter === f ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#475569', fontSize: 12 }}>
                {streamConnected ? 'Waiting for events…' : 'Reconnecting…'}
              </div>
            ) : (
              <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {filtered.map(e => (
                  <div key={e.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr auto',
                    gap: 12,
                    padding: '8px 6px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 13 }}>{typeIcon(e.type)}</span>
                    <div>
                      <div style={{ fontSize: 12, color: sevColor(e.severity), fontWeight: 600 }}>
                        {e.message}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                        {[e.email, e.ip, e.meta?.route].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>
                      {fmtRelative(e.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <span style={{ color: '#475569' }}>{label}</span>
      <span style={{ color: color ?? '#cbd5e1', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
