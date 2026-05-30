import { useEffect, useState, useCallback } from 'react'
import {
  adminApi,
  type PayPalAnalytics,
  type PayPalTransaction,
  type PayPalSubscriptionRow,
  type PayPalWebhookLog,
} from './services/adminApi'

function fmtCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}
function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

const STATUS_LABEL: Record<string, string> = {
  S: 'Success', D: 'Denied', F: 'Failed', V: 'Refunded', P: 'Pending',
}

export default function PayPalAdmin() {
  const [analytics, setAnalytics] = useState<PayPalAnalytics | null>(null)
  const [txns, setTxns] = useState<PayPalTransaction[]>([])
  const [subs, setSubs] = useState<PayPalSubscriptionRow[]>([])
  const [webhooks, setWebhooks] = useState<PayPalWebhookLog[]>([])
  const [tab, setTab] = useState<'overview' | 'transactions' | 'subscriptions' | 'webhooks'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [a, t, s, w] = await Promise.all([
        adminApi.paypalAnalytics().catch(() => null),
        adminApi.paypalTransactions(50).catch(() => ({ data: [] as PayPalTransaction[] })),
        adminApi.paypalSubscriptions(50).catch(() => ({ data: [] as PayPalSubscriptionRow[] })),
        adminApi.paypalWebhookLogs(100).catch(() => ({ data: [] as PayPalWebhookLog[] })),
      ])
      if (a) setAnalytics(a.data)
      setTxns(t.data ?? [])
      setSubs(s.data ?? [])
      setWebhooks(w.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PayPal data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleRefund = async (t: PayPalTransaction) => {
    if (!t.capture_id) { alert('No capture ID on this transaction'); return }
    const amount = prompt(`Refund amount (full = ${(t.amount / 100).toFixed(2)} ${t.currency}). Leave blank for full refund.`)
    const note = prompt('Note to payer (optional):') ?? undefined
    try {
      await adminApi.paypalRefund(t.capture_id, amount || undefined, t.currency, note)
      alert('Refund requested. Refresh in a moment to see the new status.')
      loadAll()
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">PayPal</h1>
          <p className="admin-page-sub">Revenue, transactions, subscriptions, webhook health.</p>
        </div>
        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={loadAll} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="admin-auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="admin-tabs" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
        {(['overview', 'transactions', 'subscriptions', 'webhooks'] as const).map(t => (
          <button key={t}
            className={`admin-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: tab === t ? '#0f172a' : '#64748b',
              borderBottom: tab === t ? '2px solid #003087' : '2px solid transparent',
            }}
          >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'overview' && analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <StatCard label="Today's revenue"  value={fmtCurrency(analytics.todayRevenue)} sub={`Total ${fmtCurrency(analytics.totalRevenue)}`} />
          <StatCard label="Month revenue"    value={fmtCurrency(analytics.monthRevenue)} sub="last 30 days" />
          <StatCard label="Active subs"      value={String(analytics.activeSubscriptions)} sub={`+${analytics.newThisMonth} new / ${analytics.canceledThisMonth} canceled`} />
          <StatCard label="Success rate"     value={`${analytics.successRate.toFixed(1)}%`} sub={`${analytics.failedPayments} failed`} />
          <StatCard label="Refunds"          value={String(analytics.refundCount)} sub={fmtCurrency(analytics.refundAmount)} />
          <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>Revenue — last 7 days</div>
            <RevenueBars points={analytics.revenue7d} />
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <DataTable
          headers={['Payer', 'Description', 'Amount', 'Status', 'Created', '']}
          rows={txns.map(t => [
            t.payer_email,
            t.description,
            fmtCurrency(t.amount, t.currency),
            <span style={{ fontWeight: 600, color: t.status === 'S' ? '#16a34a' : t.status === 'V' ? '#f59e0b' : '#dc2626' }}>
              {STATUS_LABEL[t.status] ?? t.status}
            </span>,
            fmtDate(t.created),
            t.status === 'S' && !t.refunded && t.capture_id
              ? <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => handleRefund(t)}>Refund</button>
              : '—',
          ])}
          empty="No transactions in the last 31 days."
        />
      )}

      {tab === 'subscriptions' && (
        <DataTable
          headers={['Subscriber', 'Plan', 'Amount', 'Status', 'Next billing', 'Created']}
          rows={subs.map(s => [
            s.payer_email,
            s.plan_id,
            fmtCurrency(s.amount, s.currency),
            <span style={{ fontWeight: 600, color: s.status === 'ACTIVE' ? '#16a34a' : s.status === 'SUSPENDED' ? '#f59e0b' : '#64748b' }}>
              {s.status}
            </span>,
            s.next_billing ? fmtDate(s.next_billing) : '—',
            fmtDate(s.created),
          ])}
          empty="No subscriptions found."
        />
      )}

      {tab === 'webhooks' && (
        <DataTable
          headers={['Event type', 'Status', 'Resource', 'Created', 'Error']}
          rows={webhooks.map(w => [
            w.event_type,
            <span style={{ color: w.status === 'success' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{w.status}</span>,
            w.resource_type ?? '—',
            fmtDate(w.created),
            w.error ?? '—',
          ])}
          empty="No webhook events recorded."
        />
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function RevenueBars({ points }: { points: Array<{ date: string; amount: number }> }) {
  const max = Math.max(1, ...points.map(p => p.amount))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
      {points.map(p => (
        <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div title={fmtCurrency(p.amount)} style={{
            width: '100%',
            height: `${(p.amount / max) * 100}%`,
            background: 'linear-gradient(180deg, #0070ba, #003087)',
            borderRadius: 6,
            minHeight: 4,
          }} />
          <div style={{ fontSize: 11, color: '#64748b' }}>{p.date.slice(5)}</div>
        </div>
      ))}
    </div>
  )
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>{empty}</div>
  }
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {headers.map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
              {r.map((cell, j) => (
                <td key={j} style={{ padding: '12px 16px', color: '#0f172a' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
