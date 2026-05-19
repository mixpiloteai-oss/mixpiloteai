import './admin.css'
import { useState, useMemo } from 'react'

type PaymentStatus = 'succeeded' | 'failed' | 'refunded' | 'pending'
type PaymentMethod = 'card' | 'paypal'
type PaymentType = 'subscription' | 'marketplace' | 'credits'

interface Transaction {
  id: number
  date: string
  txId: string
  user: string
  type: PaymentType
  product: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
}

const TRANSACTIONS: Transaction[] = [
  { id: 1, date: '2026-05-19', txId: 'ch_3PkT2A2eZvKYlo2C', user: 'Emery Nelson', type: 'subscription', product: 'Pro Monthly', amount: 19.00, method: 'card', status: 'succeeded' },
  { id: 2, date: '2026-05-19', txId: 'ch_3PkT1B2eZvKYlo2D', user: 'Sam Patel', type: 'subscription', product: 'Label Annual', amount: 1990.00, method: 'card', status: 'succeeded' },
  { id: 3, date: '2026-05-18', txId: 'ch_3PkS9A2eZvKYlo2E', user: 'Alex Rivera', type: 'marketplace', product: 'Trap Kit Vol.3', amount: 12.00, method: 'paypal', status: 'succeeded' },
  { id: 4, date: '2026-05-18', txId: 'ch_3PkS8C2eZvKYlo2F', user: 'Harley White', type: 'subscription', product: 'Studio Monthly', amount: 49.00, method: 'card', status: 'succeeded' },
  { id: 5, date: '2026-05-18', txId: 'ch_3PkS7D2eZvKYlo2G', user: 'Riley Johnson', type: 'credits', product: 'AI Credits 500', amount: 9.99, method: 'card', status: 'failed' },
  { id: 6, date: '2026-05-17', txId: 'ch_3PkR6E2eZvKYlo2H', user: 'Morgan Chen', type: 'subscription', product: 'Pro Monthly', amount: 19.00, method: 'card', status: 'succeeded' },
  { id: 7, date: '2026-05-17', txId: 'ch_3PkR5F2eZvKYlo2I', user: 'Blake Anderson', type: 'subscription', product: 'Studio Annual', amount: 490.00, method: 'paypal', status: 'succeeded' },
  { id: 8, date: '2026-05-17', txId: 'ch_3PkR4G2eZvKYlo2J', user: 'Quinn Torres', type: 'marketplace', product: 'Lo-Fi Presets', amount: 8.00, method: 'card', status: 'succeeded' },
  { id: 9, date: '2026-05-16', txId: 'ch_3PkQ3H2eZvKYlo2K', user: 'Taylor Kim', type: 'subscription', product: 'Studio Monthly', amount: 49.00, method: 'card', status: 'refunded' },
  { id: 10, date: '2026-05-16', txId: 'ch_3PkQ2I2eZvKYlo2L', user: 'Skyler Davis', type: 'credits', product: 'AI Credits 1000', amount: 18.99, method: 'card', status: 'succeeded' },
  { id: 11, date: '2026-05-15', txId: 'ch_3PkP1J2eZvKYlo2M', user: 'Jordan Lee', type: 'subscription', product: 'Label Annual', amount: 1990.00, method: 'card', status: 'succeeded' },
  { id: 12, date: '2026-05-15', txId: 'ch_3PkP0K2eZvKYlo2N', user: 'Drew Martinez', type: 'marketplace', product: 'Synth Samples Pack', amount: 24.00, method: 'paypal', status: 'succeeded' },
  { id: 13, date: '2026-05-14', txId: 'ch_3PkO9L2eZvKYlo2O', user: 'Avery Brown', type: 'subscription', product: 'Label Annual', amount: 1990.00, method: 'card', status: 'succeeded' },
  { id: 14, date: '2026-05-14', txId: 'ch_3PkO8M2eZvKYlo2P', user: 'Finley Adams', type: 'credits', product: 'AI Credits 250', amount: 4.99, method: 'card', status: 'pending' },
  { id: 15, date: '2026-05-13', txId: 'ch_3PkN7N2eZvKYlo2Q', user: 'Cameron Hall', type: 'subscription', product: 'Label Monthly', amount: 199.00, method: 'card', status: 'succeeded' },
  { id: 16, date: '2026-05-13', txId: 'ch_3PkN6O2eZvKYlo2R', user: 'Parker Wilson', type: 'marketplace', product: 'Drum Kit Bundle', amount: 35.00, method: 'paypal', status: 'failed' },
  { id: 17, date: '2026-05-12', txId: 'ch_3PkM5P2eZvKYlo2S', user: 'Robin Scott', type: 'credits', product: 'AI Credits 500', amount: 9.99, method: 'card', status: 'refunded' },
  { id: 18, date: '2026-05-12', txId: 'ch_3PkM4Q2eZvKYlo2T', user: 'Harley White', type: 'marketplace', product: 'Pro EQ Plugin', amount: 49.00, method: 'card', status: 'succeeded' },
  { id: 19, date: '2026-05-11', txId: 'ch_3PkL3R2eZvKYlo2U', user: 'Jordan Lee', type: 'credits', product: 'AI Credits 2000', amount: 34.99, method: 'card', status: 'succeeded' },
  { id: 20, date: '2026-05-11', txId: 'ch_3PkL2S2eZvKYlo2V', user: 'Sam Patel', type: 'marketplace', product: 'Mastering Suite', amount: 99.00, method: 'paypal', status: 'succeeded' },
  { id: 21, date: '2026-05-10', txId: 'ch_3PkK1T2eZvKYlo2W', user: 'Blake Anderson', type: 'subscription', product: 'Studio Annual', amount: 490.00, method: 'card', status: 'succeeded' },
  { id: 22, date: '2026-05-10', txId: 'ch_3PkK0U2eZvKYlo2X', user: 'Skyler Davis', type: 'marketplace', product: 'Vocal Chops Pack', amount: 15.00, method: 'card', status: 'succeeded' },
  { id: 23, date: '2026-05-09', txId: 'ch_3PkJ9V2eZvKYlo2Y', user: 'Cameron Hall', type: 'credits', product: 'AI Credits 5000', amount: 79.99, method: 'card', status: 'succeeded' },
  { id: 24, date: '2026-05-09', txId: 'ch_3PkJ8W2eZvKYlo2Z', user: 'Avery Brown', type: 'marketplace', product: 'Sample Bundle XL', amount: 149.00, method: 'paypal', status: 'succeeded' },
  { id: 25, date: '2026-05-08', txId: 'ch_3PkI7X2eZvKYlo2A', user: 'Taylor Kim', type: 'subscription', product: 'Studio Monthly', amount: 49.00, method: 'card', status: 'succeeded' },
]

const STATUS_BADGE: Record<PaymentStatus, string> = {
  succeeded: 'badge-green',
  failed: 'badge-red',
  refunded: 'badge-orange',
  pending: 'badge-grey',
}

const TOP_USERS = [
  { initials: 'CB', color: '#10b981', name: 'Cameron Hall', total: '$4,829', txns: 28, lastPayment: '2026-05-13', plan: 'Label' },
  { initials: 'AB', color: '#8b5cf6', name: 'Avery Brown', total: '$4,210', txns: 24, lastPayment: '2026-05-14', plan: 'Label' },
  { initials: 'SP', color: '#f59e0b', name: 'Sam Patel', total: '$3,890', txns: 22, lastPayment: '2026-05-19', plan: 'Label' },
  { initials: 'JL', color: '#22d3ee', name: 'Jordan Lee', total: '$2,740', txns: 18, lastPayment: '2026-05-15', plan: 'Label' },
  { initials: 'BA', color: '#10b981', name: 'Blake Anderson', total: '$1,820', txns: 12, lastPayment: '2026-05-21', plan: 'Studio' },
  { initials: 'HW', color: '#22d3ee', name: 'Harley White', total: '$1,240', txns: 9, lastPayment: '2026-05-18', plan: 'Studio' },
  { initials: 'TK', color: '#8b5cf6', name: 'Taylor Kim', total: '$980', txns: 8, lastPayment: '2026-05-16', plan: 'Studio' },
  { initials: 'SD', color: '#8b5cf6', name: 'Skyler Davis', total: '$620', txns: 6, lastPayment: '2026-05-16', plan: 'Pro' },
  { initials: 'DM', color: '#f59e0b', name: 'Drew Martinez', total: '$498', txns: 5, lastPayment: '2026-05-14', plan: 'Pro' },
  { initials: 'FA', color: '#f59e0b', name: 'Finley Adams', total: '$320', txns: 4, lastPayment: '2026-05-13', plan: 'Pro' },
]

const PLAN_BADGE: Record<string, string> = { Free: 'badge-grey', Pro: 'badge-purple', Studio: 'badge-cyan', Label: 'badge-orange' }

// 30 daily revenue bars
const DAILY_BARS = [
  1200, 1450, 980, 1820, 2100, 1650, 1380, 1900, 2300, 1750,
  1600, 2450, 1980, 2100, 1700, 2800, 2200, 1850, 2600, 2100,
  1920, 2400, 1780, 2050, 2380, 1960, 2700, 2100, 2850, 2640,
]
const maxBar = Math.max(...DAILY_BARS)

interface RefundModal {
  tx: Transaction
}

export default function Payments() {
  const [dateRange, setDateRange] = useState('30d')
  const [methodFilter, setMethodFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [refundModal, setRefundModal] = useState<RefundModal | null>(null)
  const [refundReason, setRefundReason] = useState('Not satisfied')
  const [refundAmount, setRefundAmount] = useState('')

  const filtered = useMemo(() => {
    let list = [...TRANSACTIONS]
    if (methodFilter !== 'All') list = list.filter(t => t.method === methodFilter.toLowerCase())
    if (statusFilter !== 'All') list = list.filter(t => t.status === statusFilter.toLowerCase())
    return list
  }, [methodFilter, statusFilter])

  const openRefund = (tx: Transaction) => {
    setRefundModal({ tx })
    setRefundAmount(tx.amount.toFixed(2))
    setRefundReason('Not satisfied')
  }

  return (
    <div className="admin-fade-in" style={{ padding: '24px' }}>
      <div className="admin-header">
        <div>
          <h1 className="admin-page-title">Payment History</h1>
          <p className="admin-page-sub">Transactions, refunds, and revenue analytics</p>
        </div>
      </div>

      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-value">$284,920</div>
          <div className="admin-stat-label">Total Revenue</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-green)' }}>$48,720</div>
          <div className="admin-stat-label">This Month</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-red)' }}>$2,340</div>
          <div className="admin-stat-label">Refunds</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-green)' }}>99.1%</div>
          <div className="admin-stat-label">Success Rate</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="admin-card-body">
          <h3 className="admin-card-title">Daily Revenue (Last 30 Days)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '0 4px' }}>
            {DAILY_BARS.map((val, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${(val / maxBar) * 100}%`,
                  background: 'linear-gradient(to top, #8b5cf6, #22d3ee)',
                  borderRadius: '3px 3px 0 0',
                  opacity: 0.85,
                  minWidth: 0,
                }}
                title={`$${val.toLocaleString()}`}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--admin-muted)', marginTop: 6 }}>
            <span>Apr 20</span><span>May 4</span><span>May 19</span>
          </div>
        </div>
      </div>

      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <select className="admin-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
          <option value="7d">Last 7d</option>
          <option value="30d">Last 30d</option>
          <option value="90d">Last 90d</option>
        </select>
        <select className="admin-select" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
          <option>All</option>
          <option>Stripe</option>
          <option>PayPal</option>
        </select>
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
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction ID</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{tx.date}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--admin-cyan)' }}>{tx.txId}</td>
                    <td style={{ fontSize: 13 }}>{tx.user}</td>
                    <td><span className={`admin-badge ${tx.type === 'subscription' ? 'badge-purple' : tx.type === 'marketplace' ? 'badge-cyan' : 'badge-orange'}`}>{tx.type}</span></td>
                    <td style={{ fontSize: 12 }}>{tx.product}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>${tx.amount.toFixed(2)}</td>
                    <td>
                      {tx.method === 'card'
                        ? <span style={{ fontSize: 12 }}>💳 Card</span>
                        : <span style={{ fontSize: 12 }}>🅿 PayPal</span>
                      }
                    </td>
                    <td><span className={`admin-badge ${STATUS_BADGE[tx.status]}`}>{tx.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="admin-btn admin-btn-ghost admin-btn-sm">Invoice</button>
                        {tx.status === 'succeeded' && (
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => openRefund(tx)}>Refund</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Revenue Users */}
      <div className="admin-card">
        <div className="admin-card-body">
          <h3 className="admin-card-title">Top Revenue Users</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Total Spent</th>
                  <th>Transactions</th>
                  <th>Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {TOP_USERS.map((u, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{u.initials}</div>
                        <span style={{ fontSize: 13 }}>{u.name}</span>
                      </div>
                    </td>
                    <td><span className={`admin-badge ${PLAN_BADGE[u.plan]}`}>{u.plan}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--admin-green)' }}>{u.total}</td>
                    <td style={{ fontSize: 13 }}>{u.txns}</td>
                    <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{u.lastPayment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-cyan)', marginBottom: 8 }}>{refundModal.tx.txId}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{refundModal.tx.user} · {refundModal.tx.product}</span>
                  <span style={{ fontWeight: 700 }}>${refundModal.tx.amount.toFixed(2)}</span>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--admin-muted)', display: 'block', marginBottom: 6 }}>Reason</label>
                <select className="admin-select" style={{ width: '100%' }} value={refundReason} onChange={e => setRefundReason(e.target.value)}>
                  <option>Duplicate</option>
                  <option>Not satisfied</option>
                  <option>Technical issue</option>
                  <option>Fraud</option>
                  <option>Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: 'var(--admin-muted)', display: 'block', marginBottom: 6 }}>Refund Amount</label>
                <input className="admin-search" style={{ width: '100%' }} value={refundAmount} onChange={e => setRefundAmount(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setRefundModal(null)}>Cancel</button>
                <button className="admin-btn admin-btn-primary" onClick={() => setRefundModal(null)}>Process Refund</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
