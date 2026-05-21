import './admin.css'
import { useState, useEffect, useCallback } from 'react'
import { adminApi, type PlatformStats, type StripeOverview, type StripeAnalytics, type PayPalAnalytics } from './services/adminApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function timeAgo(d: Date) {
  const secs = Math.round((Date.now() - d.getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w, h, style }: { w?: number | string; h?: number | string; style?: React.CSSProperties }) {
  return (
    <div
      className="admin-skeleton"
      style={{ width: w ?? '100%', height: h ?? 20, ...style }}
    />
  )
}

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  delta: string
  deltaDir: 'up' | 'down' | 'neutral'
  sub?: string
  glowColor: string
  loading?: boolean
}

function StatCard({ label, value, delta, deltaDir, sub, glowColor, loading }: StatCardProps) {
  return (
    <div className="admin-card admin-card-glow admin-stat-card">
      <div className="admin-stat-glow" style={{ background: glowColor }} />
      {loading ? (
        <>
          <Skeleton h={32} w="60%" style={{ marginBottom: 8 }} />
          <Skeleton h={14} w="80%" style={{ marginBottom: 6 }} />
          <Skeleton h={12} w="50%" />
        </>
      ) : (
        <>
          <div className="admin-stat-value" style={{ color: glowColor }}>{value}</div>
          <div className="admin-stat-label">{label}</div>
          {sub && <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{sub}</div>}
          <div className={`admin-stat-delta ${deltaDir === 'up' ? 'admin-stat-delta-up' : deltaDir === 'down' ? 'admin-stat-delta-down' : ''}`}>
            {deltaDir === 'up' ? '↑' : deltaDir === 'down' ? '↓' : '•'} {delta}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [stripe, setStripe] = useState<StripeOverview | null>(null)
  const [analytics, setAnalytics] = useState<StripeAnalytics | null>(null)
  const [paypal, setPaypal] = useState<PayPalAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [, setTick] = useState(0)

  const loadData = useCallback(async () => {
    try {
      const [statsRes, stripeRes, analyticsRes, paypalRes] = await Promise.all([
        adminApi.stats(),
        adminApi.stripeOverview(),
        adminApi.stripeAnalytics().catch(() => null),
        adminApi.paypalAnalytics().catch(() => null),
      ])
      setStats(statsRes.data)
      setStripe(stripeRes.data)
      if (analyticsRes) setAnalytics(analyticsRes.data)
      if (paypalRes) setPaypal(paypalRes.data)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60_000)
    return () => clearInterval(interval)
  }, [loadData])

  // Tick every 15s to update "X ago" display
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])

  // SSE live connection
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL ?? 'https://mixpiloteai-production.up.railway.app'
    const token = localStorage.getItem('admin-jwt') ?? localStorage.getItem('admin-key') ?? ''
    const es = new EventSource(`${API_URL}/api/admin/live?token=${encodeURIComponent(token)}`)
    es.addEventListener('stats', (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data)
        setStats(d)
        setLastUpdated(new Date())
      } catch { /* ignore */ }
    })
    es.onerror = () => { /* reconnect handled by browser */ }
    return () => es.close()
  }, [])

  // Derive sub breakdown from stats
  const subBreakdown = stats ? [
    { plan: 'Free',   count: stats.subscriptions.free,   pct: stats.users.total > 0 ? +(stats.subscriptions.free / stats.users.total * 100).toFixed(1) : 0,   color: '#334155' },
    { plan: 'Pro',    count: stats.subscriptions.pro,    pct: stats.users.total > 0 ? +(stats.subscriptions.pro / stats.users.total * 100).toFixed(1) : 0,    color: '#8b5cf6' },
    { plan: 'Studio', count: stats.subscriptions.studio, pct: stats.users.total > 0 ? +(stats.subscriptions.studio / stats.users.total * 100).toFixed(1) : 0, color: '#22d3ee' },
    { plan: 'Label',  count: stats.subscriptions.label,  pct: stats.users.total > 0 ? +(stats.subscriptions.label / stats.users.total * 100).toFixed(1) : 0,  color: '#10b981' },
  ] : []

  const revenueWeek = stripe?.revenue7d ?? []
  const maxRevenue = revenueWeek.length ? Math.max(...revenueWeek.map(d => d.amount), 1) : 1

  return (
    <div className="admin-fade-in" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="admin-header">
        <div>
          <div className="admin-page-title">Dashboard</div>
          <div className="admin-page-sub">NeuroTek AI — Platform Overview</div>
        </div>
        <div className="admin-header-actions">
          <span className="admin-live-dot" />
          <span style={{ fontSize: 11, color: '#334155' }}>
            Updated {timeAgo(lastUpdated)}
          </span>
          <button className="admin-refresh-btn" onClick={loadData}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '0 28px', marginBottom: 24 }}>
        <StatCard
          label="Total Users"
          value={stats ? stats.users.total.toLocaleString() : '—'}
          delta={stats ? `+${stats.users.newToday} today` : '…'}
          deltaDir="up"
          glowColor="#22d3ee"
          loading={loading}
        />
        <StatCard
          label="Active (30d)"
          value={stats ? stats.users.active30d.toLocaleString() : '—'}
          delta={stripe ? `MRR: ${fmtUSD(stripe.mrr)}` : '…'}
          deltaDir="up"
          glowColor="#8b5cf6"
          loading={loading}
        />
        <StatCard
          label="Revenue Today"
          value={stripe ? fmtUSD(stripe.todayRevenue) : '—'}
          delta={stats ? `Total: ${fmtUSD(stats.payments.totalRevenue)}` : '…'}
          deltaDir="up"
          glowColor="#10b981"
          loading={loading}
        />
        <StatCard
          label="API Requests / Day"
          value={stats ? stats.ai.requestsToday.toLocaleString() : '—'}
          delta={stats ? `${stats.ai.requestsMonth.toLocaleString()} this month` : '…'}
          deltaDir="up"
          glowColor="#f59e0b"
          loading={loading}
        />
        <StatCard
          label="Open Tickets"
          value={stats ? String(stats.support.open) : '—'}
          delta="open support tickets"
          deltaDir="down"
          glowColor="#ef4444"
          loading={loading}
        />
        <StatCard
          label="MRR"
          value={analytics ? fmtUSD(analytics.mrr) : stripe ? fmtUSD(stripe.mrr) : '—'}
          delta={analytics ? `ARR ${fmtUSD(analytics.arr)}` : '…'}
          deltaDir="up"
          glowColor="#6366f1"
          loading={loading}
        />
        <StatCard
          label="Churn rate"
          value={analytics ? `${analytics.churnRate.toFixed(2)}%` : '—'}
          delta={analytics ? `${analytics.canceledThisMonth} canceled / ${analytics.newThisMonth} new` : '…'}
          deltaDir={analytics && analytics.churnRate > 5 ? 'down' : 'up'}
          glowColor="#ec4899"
          loading={loading}
        />
        <StatCard
          label="PayPal revenue"
          value={paypal ? fmtUSD(paypal.todayRevenue) : '—'}
          delta={paypal ? `${paypal.activeSubscriptions} active subs` : '…'}
          deltaDir="up"
          glowColor="#0070ba"
          loading={loading}
        />
        <StatCard
          label="Storage Used"
          value={stats ? `${stats.storage.usedGB} GB` : '—'}
          delta={stats ? `${stats.storage.usedGB} / ${stats.storage.totalGB} GB (${stats.storage.usedPct}%)` : '…'}
          deltaDir="neutral"
          glowColor="#64748b"
          loading={loading}
        />
      </div>

      {/* ── Quick Actions ── */}
      <div className="admin-toolbar" style={{ marginBottom: 24 }}>
        <button className="admin-btn admin-btn-danger">
          View Pending Moderation {stats ? `(${stats.marketplace.pending})` : ''}
        </button>
        <button className="admin-btn admin-btn-danger">
          Review Open Tickets {stats ? `(${stats.support.open})` : ''}
        </button>
        <button className="admin-btn admin-btn-ghost">
          Process Refunds {stats ? `(${stats.payments.refundCount})` : ''}
        </button>
        <button className="admin-btn admin-btn-primary">
          Deploy Update
        </button>
      </div>

      {/* ── Revenue + Subscriptions row ── */}
      <div className="admin-grid-2">
        {/* Revenue Chart */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Revenue — Last 7 Days</div>
            {loading ? (
              <Skeleton h={130} />
            ) : revenueWeek.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
                {revenueWeek.map((d, i) => {
                  const pct = (d.amount / maxRevenue) * 100
                  const label = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>${(d.amount / 100000).toFixed(1)}k</div>
                      <div
                        style={{
                          width: '100%',
                          height: `${pct}%`,
                          borderRadius: '3px 3px 0 0',
                          background: 'linear-gradient(180deg, #8b5cf6 0%, rgba(139,92,246,0.4) 100%)',
                          minHeight: 4,
                        }}
                      />
                      <div className="admin-bar-label">{label}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>
                No revenue data available
              </div>
            )}
          </div>
        </div>

        {/* Subscription Breakdown */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Subscription Breakdown</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={36} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {subBreakdown.map(s => (
                  <div key={s.plan}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{s.plan}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>
                        {s.count.toLocaleString()} ({s.pct}%)
                      </span>
                    </div>
                    <div className="admin-progress-track">
                      <div
                        className="admin-progress-fill"
                        style={{ width: `${s.pct}%`, background: s.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Row (3 columns) ── */}
      <div className="admin-grid-3">
        {/* Platform KPIs */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Platform KPIs</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4,5].map(i => <Skeleton key={i} h={28} />)}
              </div>
            ) : stats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { label: 'Banned Users',      value: stats.users.banned.toLocaleString(),            color: '#ef4444' },
                  { label: 'Marketplace Items', value: stats.marketplace.totalProducts.toLocaleString(), color: '#94a3b8' },
                  { label: 'Flagged Content',   value: stats.marketplace.flagged.toLocaleString(),      color: '#f59e0b' },
                  { label: 'AI Avg Latency',    value: `${stats.ai.avgLatencyMs}ms`,                   color: stats.ai.avgLatencyMs > 500 ? '#ef4444' : '#10b981' },
                  { label: 'AI Error Rate',     value: `${stats.ai.errorRate}%`,                       color: stats.ai.errorRate > 1 ? '#ef4444' : '#10b981' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <span style={{ fontSize: 12, color: '#475569' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#334155', fontSize: 12 }}>No data</div>
            )}
          </div>
        </div>

        {/* Stripe Overview */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Stripe Overview</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4,5].map(i => <Skeleton key={i} h={28} />)}
              </div>
            ) : stripe ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { label: 'MRR',                  value: fmtUSD(stripe.mrr),           color: '#10b981' },
                  { label: 'ARR',                  value: fmtUSD(stripe.arr),           color: '#10b981' },
                  { label: 'Total Revenue',         value: fmtUSD(stripe.totalRevenue),  color: '#94a3b8' },
                  { label: 'Active Subscriptions',  value: stripe.activeSubscriptions.toLocaleString(), color: '#8b5cf6' },
                  { label: 'Payment Success Rate',  value: `${stripe.successRate.toFixed(1)}%`,         color: stripe.successRate > 98 ? '#10b981' : '#f59e0b' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <span style={{ fontSize: 12, color: '#475569' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#334155', fontSize: 12 }}>No data</div>
            )}
          </div>
        </div>

        {/* Storage */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Storage & Support</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4,5].map(i => <Skeleton key={i} h={28} />)}
              </div>
            ) : stats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Storage</span>
                    <span style={{ fontSize: 11, color: '#475569' }}>{stats.storage.usedGB} / {stats.storage.totalGB} GB</span>
                  </div>
                  <div className="admin-progress-track">
                    <div className="admin-progress-fill" style={{ width: `${stats.storage.usedPct}%`, background: stats.storage.usedPct > 80 ? '#ef4444' : '#64748b' }} />
                  </div>
                </div>
                {[
                  { label: 'Open Tickets',      value: stats.support.open,                       color: '#ef4444' },
                  { label: 'Resolved Tickets',  value: stats.support.resolved,                   color: '#10b981' },
                  { label: 'Avg Response',      value: `${stats.support.avgResponseHours}h`,     color: '#94a3b8' },
                  { label: 'Downloads',         value: stats.marketplace.totalDownloads.toLocaleString(), color: '#22d3ee' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <span style={{ fontSize: 12, color: '#475569' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#334155', fontSize: 12 }}>No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
