import './admin.css'
import { useState, useEffect } from 'react'
import { adminApi, type StripeOverview, type StripeCharge } from './services/adminApi'

function fmtUSD(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(epoch: number) {
  return new Date(epoch * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, string> = {
  succeeded: 'badge-green',
  paid:      'badge-green',
  failed:    'badge-red',
  refunded:  'badge-orange',
  pending:   'badge-grey',
}

interface RefundModal { charge: StripeCharge }

export default function Payments() {
  const [overview, setOverview]   = useState<StripeOverview | null>(null)
  const [charges, setCharges]     = useState<StripeCharge[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [refundModal, setRefundModal] = useState<RefundModal | null>(null)
  const [refundReason, setRefundReason] = useState('Not satisfied')
  const [refunding, setRefunding] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    async function load() {
      setError('')
      try {
        const [o, c] = await Promise.all([
          adminApi.stripeOverview(),
          adminApi.stripeCharges(25),
        ])
        setOverview(o.data)
        setCharges(c.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load payment data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleRefund() {
    if (!refundModal) return
    setRefunding(true)
    try {
      await adminApi.refund(refundModal.charge.id, refundReason)
      setCharges(prev => prev.map(c => c.id === refundModal.charge.id ? { ...c, refunded: true } : c))
      setRefundModal(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Refund failed')
    } finally {
      setRefunding(false)
    }
  }

  const filtered = statusFilter === 'All'
    ? charges
    : charges.filter(c => {
        if (statusFilter === 'Refunded') return c.refunded
        return c.status.toLowerCase() === statusFilter.toLowerCase()
      })

  const revenueWeek = overview?.revenue7d ?? []
  const maxBar = revenueWeek.length ? Math.max(...revenueWeek.map(d => d.amount), 1) : 1

  return (
    <div className="admin-fade-in" style={{ padding: '24px' }}>
      <div className="admin-header">
        <div>
          <h1 className="admin-page-title">Payment History</h1>
          <p className="admin-page-sub">Transactions, refunds, and revenue analytics</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          {error} — showing offline data
        </div>
      )}

      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          {loading ? <div className="admin-skeleton" style={{ height: 32, width: '60%' }} /> : (
            <div className="admin-stat-value">{overview ? fmtUSD(overview.totalRevenue) : '—'}</div>
          )}
          <div className="admin-stat-label">Total Revenue</div>
        </div>
        <div className="admin-stat-card">
          {loading ? <div className="admin-skeleton" style={{ height: 32, width: '60%' }} /> : (
            <div className="admin-stat-value" style={{ color: 'var(--admin-green)' }}>{overview ? fmtUSD(overview.mrr) : '—'}</div>
          )}
          <div className="admin-stat-label">MRR</div>
        </div>
        <div className="admin-stat-card">
          {loading ? <div className="admin-skeleton" style={{ height: 32, width: '60%' }} /> : (
            <div className="admin-stat-value" style={{ color: 'var(--admin-cyan)' }}>{overview ? fmtUSD(overview.arr) : '—'}</div>
          )}
          <div className="admin-stat-label">ARR</div>
        </div>
        <div className="admin-stat-card">
          {loading ? <div className="admin-skeleton" style={{ height: 32, width: '60%' }} /> : (
            <div className="admin-stat-value" style={{ color: overview && overview.successRate > 98 ? 'var(--admin-green)' : 'var(--admin-orange)' }}>
              {overview ? `${overview.successRate.toFixed(1)}%` : '—'}
            </div>
          )}
          <div className="admin-stat-label">Success Rate</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="admin-card-body">
          <h3 className="admin-card-title">Revenue — Last 7 Days</h3>
          {loading ? (
            <div className="admin-skeleton" style={{ height: 120 }} />
          ) : revenueWeek.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
                {revenueWeek.map((d, i) => {
                  const pct = (d.amount / maxBar) * 100
                  const label = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
                        {fmtUSD(d.amount)}
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: `${pct}%`,
                          background: 'linear-gradient(to top, #8b5cf6, #22d3ee)',
                          borderRadius: '3px 3px 0 0',
                          opacity: 0.85,
                          minHeight: 4,
                        }}
                        title={fmtUSD(d.amount)}
                      />
                      <div style={{ fontSize: 9, color: '#334155' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>
              No revenue data available
            </div>
          )}
        </div>
      </div>

      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <select className="admin-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option>Succeeded</option>
          <option>Failed</option>
          <option>Refunded</option>
          <option>Pending</option>
        </select>
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="admin-card-body">
          <h3 className="admin-card-title">Transactions</h3>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>Loading transactions…</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Charge ID</th>
                    <th>Customer</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{fmtDate(c.created)}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--admin-cyan)' }}>{c.id}</td>
                      <td style={{ fontSize: 13 }}>{c.customerEmail}</td>
                      <td style={{ fontSize: 12 }}>{c.description}</td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{fmtUSD(c.amount)}</td>
                      <td style={{ fontSize: 11, color: 'var(--admin-muted)', textTransform: 'uppercase' }}>{c.currency}</td>
                      <td>
                        <span className={`admin-badge ${c.refunded ? 'badge-orange' : (STATUS_BADGE[c.status] ?? 'badge-grey')}`}>
                          {c.refunded ? 'refunded' : c.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(c.status === 'succeeded' || c.status === 'paid') && !c.refunded && (
                            <button
                              className="admin-btn admin-btn-danger admin-btn-sm"
                              onClick={() => { setRefundModal({ charge: c }); setRefundReason('Not satisfied') }}
                            >Refund</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: '#334155' }}>No transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Refund Modal */}
      {refundModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="admin-card" style={{ width: 440, padding: 0 }}>
            <div className="admin-card-body">
              <h3 className="admin-card-title" style={{ color: 'var(--admin-orange)' }}>Process Refund</h3>
              <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 4 }}>Transaction</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-cyan)', marginBottom: 8 }}>{refundModal.charge.id}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{refundModal.charge.customerEmail} · {refundModal.charge.description}</span>
                  <span style={{ fontWeight: 700 }}>{fmtUSD(refundModal.charge.amount)}</span>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: 'var(--admin-muted)', display: 'block', marginBottom: 6 }}>Reason</label>
                <select className="admin-select" style={{ width: '100%' }} value={refundReason} onChange={e => setRefundReason(e.target.value)}>
                  <option>Duplicate</option>
                  <option>Not satisfied</option>
                  <option>Technical issue</option>
                  <option>Fraud</option>
                  <option>Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setRefundModal(null)}>Cancel</button>
                <button className="admin-btn admin-btn-primary" disabled={refunding} onClick={handleRefund}>
                  {refunding ? 'Processing…' : 'Process Refund'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
