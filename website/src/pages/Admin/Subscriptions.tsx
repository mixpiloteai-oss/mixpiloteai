import './admin.css'

interface SubEvent {
  id: number
  date: string
  userName: string
  eventType: 'created' | 'upgraded' | 'downgraded' | 'cancelled' | 'renewed'
  fromPlan: string
  toPlan: string
  amount: string
}

const EVENTS: SubEvent[] = [
  { id: 1, date: '2026-05-19', userName: 'Emery Nelson', eventType: 'created', fromPlan: '—', toPlan: 'Free', amount: '$0.00' },
  { id: 2, date: '2026-05-19', userName: 'Quinn Torres', eventType: 'created', fromPlan: '—', toPlan: 'Free', amount: '$0.00' },
  { id: 3, date: '2026-05-18', userName: 'Alex Rivera', eventType: 'renewed', fromPlan: 'Pro', toPlan: 'Pro', amount: '$19.00' },
  { id: 4, date: '2026-05-18', userName: 'Harley White', eventType: 'renewed', fromPlan: 'Studio', toPlan: 'Studio', amount: '$49.00' },
  { id: 5, date: '2026-05-17', userName: 'Morgan Chen', eventType: 'upgraded', fromPlan: 'Free', toPlan: 'Pro', amount: '$19.00' },
  { id: 6, date: '2026-05-17', userName: 'Blake Anderson', eventType: 'renewed', fromPlan: 'Studio', toPlan: 'Studio', amount: '$49.00' },
  { id: 7, date: '2026-05-16', userName: 'Parker Wilson', eventType: 'downgraded', fromPlan: 'Pro', toPlan: 'Free', amount: '$0.00' },
  { id: 8, date: '2026-05-16', userName: 'Taylor Kim', eventType: 'renewed', fromPlan: 'Studio', toPlan: 'Studio', amount: '$49.00' },
  { id: 9, date: '2026-05-15', userName: 'Skyler Davis', eventType: 'upgraded', fromPlan: 'Pro', toPlan: 'Studio', amount: '$49.00' },
  { id: 10, date: '2026-05-15', userName: 'Jamie Garcia', eventType: 'created', fromPlan: '—', toPlan: 'Free', amount: '$0.00' },
  { id: 11, date: '2026-05-14', userName: 'Drew Martinez', eventType: 'renewed', fromPlan: 'Pro', toPlan: 'Pro', amount: '$19.00' },
  { id: 12, date: '2026-05-13', userName: 'Robin Scott', eventType: 'cancelled', fromPlan: 'Free', toPlan: '—', amount: '$0.00' },
  { id: 13, date: '2026-05-12', userName: 'Finley Adams', eventType: 'renewed', fromPlan: 'Pro', toPlan: 'Pro', amount: '$19.00' },
  { id: 14, date: '2026-05-11', userName: 'Jordan Lee', eventType: 'upgraded', fromPlan: 'Studio', toPlan: 'Label', amount: '$199.00' },
  { id: 15, date: '2026-05-10', userName: 'Sam Patel', eventType: 'renewed', fromPlan: 'Label', toPlan: 'Label', amount: '$199.00' },
]

const EVENT_BADGE: Record<SubEvent['eventType'], string> = {
  created: 'badge-green',
  upgraded: 'badge-cyan',
  downgraded: 'badge-orange',
  cancelled: 'badge-red',
  renewed: 'badge-purple',
}

const PLAN_BARS = [
  { name: 'Free', users: 4541, pct: 53.8, color: '#475569' },
  { name: 'Pro', users: 2847, pct: 33.8, color: '#8b5cf6' },
  { name: 'Studio', users: 891, pct: 10.6, color: '#22d3ee' },
  { name: 'Label', users: 153, pct: 1.8, color: '#f59e0b' },
]

const RENEWAL_DAYS = [
  { date: 'May 20', users: 42, revenue: '$1,248' },
  { date: 'May 21', users: 38, revenue: '$1,102' },
  { date: 'May 22', users: 55, revenue: '$1,895' },
  { date: 'May 23', users: 29, revenue: '$864' },
  { date: 'May 24', users: 61, revenue: '$2,140' },
  { date: 'May 25', users: 47, revenue: '$1,562' },
  { date: 'May 26', users: 33, revenue: '$980' },
]

const CANCEL_REASONS = [
  { reason: 'Too expensive', pct: 38, color: '#ef4444' },
  { reason: 'Missing features', pct: 24, color: '#f59e0b' },
  { reason: 'Not using it', pct: 19, color: '#8b5cf6' },
  { reason: 'Switching tools', pct: 12, color: '#22d3ee' },
  { reason: 'Other', pct: 7, color: '#475569' },
]

export default function Subscriptions() {
  return (
    <div className="admin-fade-in" style={{ padding: '24px' }}>
      <div className="admin-header">
        <div>
          <h1 className="admin-page-title">Subscription Management</h1>
          <p className="admin-page-sub">Monitor plans, renewals, and churn</p>
        </div>
      </div>

      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-value">3,891</div>
          <div className="admin-stat-label">Total Subscribers</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-green)' }}>$48,720</div>
          <div className="admin-stat-label">MRR</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-orange)' }}>2.1%</div>
          <div className="admin-stat-label">Churn Rate</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">$284</div>
          <div className="admin-stat-label">Avg LTV</div>
        </div>
      </div>

      <div className="admin-grid-2" style={{ marginBottom: 24 }}>
        {/* Plan Breakdown */}
        <div className="admin-card">
          <div className="admin-card-body">
            <h3 className="admin-card-title">Plan Breakdown</h3>
            {PLAN_BARS.map(p => (
              <div key={p.name} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: 'var(--admin-muted)' }}>{p.users.toLocaleString()} users · {p.pct}%</span>
                </div>
                <div className="admin-progress-track">
                  <div className="admin-progress-fill" style={{ width: `${p.pct}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cancel Reasons */}
        <div className="admin-card">
          <div className="admin-card-body">
            <h3 className="admin-card-title">Cancellation Reasons</h3>
            {CANCEL_REASONS.map(r => (
              <div key={r.reason} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                  <span>{r.reason}</span>
                  <span style={{ color: r.color, fontWeight: 700 }}>{r.pct}%</span>
                </div>
                <div className="admin-progress-track">
                  <div className="admin-progress-fill" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Renewal Schedule */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="admin-card-body">
          <h3 className="admin-card-title">Renewal Schedule (Next 7 Days)</h3>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {RENEWAL_DAYS.map(d => (
              <div key={d.date} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 10, padding: '14px 18px', minWidth: 130, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 8 }}>{d.date}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--admin-purple)', marginBottom: 4 }}>{d.users}</div>
                <div style={{ fontSize: 11, color: 'var(--admin-muted)', marginBottom: 8 }}>renewals</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-green)' }}>{d.revenue}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="admin-card">
        <div className="admin-card-body">
          <h3 className="admin-card-title">Recent Subscription Events</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Event</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {EVENTS.map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{ev.date}</td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{ev.userName}</td>
                    <td><span className={`admin-badge ${EVENT_BADGE[ev.eventType]}`}>{ev.eventType}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--admin-muted)' }}>{ev.fromPlan}</td>
                    <td style={{ fontSize: 13 }}>{ev.toPlan}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: ev.amount === '$0.00' ? 'var(--admin-muted)' : 'var(--admin-green)' }}>{ev.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
