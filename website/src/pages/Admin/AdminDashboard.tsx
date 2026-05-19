import './admin.css'

// ── Mock Data ────────────────────────────────────────────────────────────────

const revenueWeek = [
  { day: 'Mon', value: 3120 },
  { day: 'Tue', value: 4380 },
  { day: 'Wed', value: 2950 },
  { day: 'Thu', value: 5210 },
  { day: 'Fri', value: 4870 },
  { day: 'Sat', value: 3640 },
  { day: 'Sun', value: 3247 },
]
const maxRevenue = Math.max(...revenueWeek.map(d => d.value))

const subBreakdown = [
  { plan: 'Free',   count: 4541, pct: 53.9, color: '#334155' },
  { plan: 'Pro',    count: 2418, pct: 28.7, color: '#8b5cf6' },
  { plan: 'Studio', count: 1092, pct: 12.9, color: '#22d3ee' },
  { plan: 'Label',  count:  381, pct:  4.5, color: '#10b981' },
]

const recentSignups = [
  { initials: 'JK', name: 'Jordan Kline',    plan: 'Pro',    time: '4m ago',  planColor: 'badge-purple' },
  { initials: 'MA', name: 'Mira Alvarez',    plan: 'Studio', time: '18m ago', planColor: 'badge-cyan' },
  { initials: 'TR', name: 'Tyler Rowe',      plan: 'Free',   time: '31m ago', planColor: 'badge-grey' },
  { initials: 'SN', name: 'Sophia Nakamura', plan: 'Label',  time: '1h ago',  planColor: 'badge-green' },
  { initials: 'DB', name: 'Devon Blake',     plan: 'Pro',    time: '2h ago',  planColor: 'badge-purple' },
]

const recentPayments = [
  { amount: '$29.00', user: 'Jordan Kline',    status: 'Paid',    statusClass: 'badge-green',  time: '4m ago' },
  { amount: '$79.00', user: 'Mira Alvarez',    status: 'Paid',    statusClass: 'badge-green',  time: '18m ago' },
  { amount: '$9.99',  user: 'Luis Carver',     status: 'Pending', statusClass: 'badge-orange', time: '44m ago' },
  { amount: '$199.00',user: 'Sophia Nakamura', status: 'Paid',    statusClass: 'badge-green',  time: '1h ago' },
  { amount: '$29.00', user: 'Kai Osei',        status: 'Refund',  statusClass: 'badge-red',    time: '3h ago' },
]

const systemServices = [
  { name: 'API Gateway',       status: 'dot-green',  latency: '42ms',  uptime: '99.98%' },
  { name: 'PostgreSQL',        status: 'dot-green',  latency: '8ms',   uptime: '99.99%' },
  { name: 'AI Inference',      status: 'dot-orange', latency: '312ms', uptime: '99.41%' },
  { name: 'Redis Cache',       status: 'dot-green',  latency: '2ms',   uptime: '100%' },
  { name: 'Storage S3',        status: 'dot-green',  latency: '65ms',  uptime: '99.97%' },
  { name: 'Email Service',     status: 'dot-orange', latency: '180ms', uptime: '98.82%' },
]

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  delta: string
  deltaDir: 'up' | 'down' | 'neutral'
  sub?: string
  glowColor: string
}

function StatCard({ label, value, delta, deltaDir, sub, glowColor }: StatCardProps) {
  return (
    <div className="admin-card admin-card-glow admin-stat-card">
      <div
        className="admin-stat-glow"
        style={{ background: glowColor }}
      />
      <div className="admin-stat-value" style={{ color: glowColor }}>{value}</div>
      <div className="admin-stat-label">{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{sub}</div>}
      <div className={`admin-stat-delta ${deltaDir === 'up' ? 'admin-stat-delta-up' : deltaDir === 'down' ? 'admin-stat-delta-down' : ''}`}>
        {deltaDir === 'up' ? '↑' : deltaDir === 'down' ? '↓' : '•'} {delta}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  return (
    <div className="admin-fade-in" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="admin-header">
        <div>
          <div className="admin-page-title">Dashboard</div>
          <div className="admin-page-sub">NeuroTek AI — Platform Overview</div>
        </div>
        <div className="admin-header-actions">
          <span style={{ fontSize: 11, color: '#334155' }}>Last updated: just now</span>
          <button className="admin-btn admin-btn-primary admin-btn-sm">↻ Refresh</button>
        </div>
      </div>

      {/* ── Stat Cards (6, 3+3 on two rows if needed) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '0 28px', marginBottom: 24 }}>
        <StatCard
          label="Total Users"
          value="8,432"
          delta="+124 today"
          deltaDir="up"
          glowColor="#22d3ee"
        />
        <StatCard
          label="Active Subscriptions"
          value="3,891"
          delta="MRR: $48,720"
          deltaDir="up"
          glowColor="#8b5cf6"
        />
        <StatCard
          label="Revenue Today"
          value="$3,247"
          delta="+12% vs yesterday"
          deltaDir="up"
          glowColor="#10b981"
        />
        <StatCard
          label="API Requests / Day"
          value="142,830"
          delta="+8,200 vs yesterday"
          deltaDir="up"
          glowColor="#f59e0b"
        />
        <StatCard
          label="Open Tickets"
          value="12"
          sub="3 critical"
          delta="3 critical unresolved"
          deltaDir="down"
          glowColor="#ef4444"
        />
        <StatCard
          label="Storage Used"
          value="98 GB"
          delta="98 / 500 GB (19.6%)"
          deltaDir="neutral"
          glowColor="#64748b"
        />
      </div>

      {/* ── Quick Actions ── */}
      <div className="admin-toolbar" style={{ marginBottom: 24 }}>
        <button className="admin-btn admin-btn-danger">
          View Pending Moderation (5)
        </button>
        <button className="admin-btn admin-btn-danger">
          Review Critical Tickets (3)
        </button>
        <button className="admin-btn admin-btn-ghost">
          Process Refunds (2)
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
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
              {revenueWeek.map(d => {
                const pct = (d.value / maxRevenue) * 100
                return (
                  <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>${(d.value / 1000).toFixed(1)}k</div>
                    <div
                      style={{
                        width: '100%',
                        height: `${pct}%`,
                        borderRadius: '3px 3px 0 0',
                        background: 'linear-gradient(180deg, #8b5cf6 0%, rgba(139,92,246,0.4) 100%)',
                        minHeight: 4,
                      }}
                    />
                    <div className="admin-bar-label">{d.day}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Subscription Breakdown */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Subscription Breakdown</div>
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
          </div>
        </div>
      </div>

      {/* ── Bottom Row (3 columns) ── */}
      <div className="admin-grid-3">
        {/* Recent Signups */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Recent Signups</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentSignups.map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentSignups.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg, #1e1a2e, #0c1428)',
                    border: '1px solid #1a1a2e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#8b5cf6',
                  }}>
                    {u.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                    <div style={{ fontSize: 10, color: '#334155' }}>{u.time}</div>
                  </div>
                  <span className={`admin-badge ${u.planColor}`} style={{ fontSize: 10, padding: '2px 7px' }}>{u.plan}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Recent Payments</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentPayments.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentPayments.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: '#10b981', minWidth: 56 }}>
                    {p.amount}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.user}</div>
                    <div style={{ fontSize: 10, color: '#334155' }}>{p.time}</div>
                  </div>
                  <span className={`admin-badge ${p.statusClass}`} style={{ fontSize: 10, padding: '2px 7px' }}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">System Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {systemServices.map((svc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: i < systemServices.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <span className={`status-dot ${svc.status} dot-pulse`} />
                  <span style={{ flex: 1, fontSize: 12, color: '#94a3b8' }}>{svc.name}</span>
                  <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginRight: 10 }}>{svc.latency}</span>
                  <span style={{ fontSize: 10, color: '#334155' }}>{svc.uptime}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
