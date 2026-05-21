import { useEffect, useState, useCallback } from 'react'
import { adminApi, type StripeAnalytics, type StripeInvoice, type StripeCoupon, type StripeWebhookLog } from './services/adminApi'

function fmtCurrency(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

export default function StripeAdmin() {
  const [analytics, setAnalytics] = useState<StripeAnalytics | null>(null)
  const [invoices, setInvoices] = useState<StripeInvoice[]>([])
  const [coupons, setCoupons] = useState<StripeCoupon[]>([])
  const [webhookLogs, setWebhookLogs] = useState<StripeWebhookLog[]>([])
  const [tab, setTab] = useState<'overview' | 'invoices' | 'coupons' | 'webhooks'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [a, i, c, w] = await Promise.all([
        adminApi.stripeAnalytics().catch(() => null),
        adminApi.stripeInvoices(25).catch(() => ({ data: [] as StripeInvoice[] })),
        adminApi.stripeCoupons().catch(() => ({ data: [] as StripeCoupon[] })),
        adminApi.stripeWebhookLogs(100).catch(() => ({ data: [] as StripeWebhookLog[] })),
      ])
      if (a) setAnalytics(a.data)
      setInvoices(i.data ?? [])
      setCoupons(c.data ?? [])
      setWebhookLogs(w.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Stripe data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm(`Delete coupon ${id}?`)) return
    try {
      await adminApi.deleteStripeCoupon(id)
      setCoupons(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  const handleCreateCoupon = async () => {
    const name = prompt('Coupon name (e.g. LAUNCH20):')
    if (!name) return
    const pctRaw = prompt('Percent off (e.g. 20). Leave blank for amount-off coupons.', '20')
    const percentOff = pctRaw ? Number(pctRaw) : undefined
    const duration = (prompt('Duration: once | repeating | forever', 'once') ?? 'once') as 'once' | 'repeating' | 'forever'
    try {
      const r = await adminApi.createStripeCoupon({ name, percentOff, duration })
      setCoupons(prev => [r.data, ...prev])
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Stripe</h1>
          <p className="admin-page-sub">Revenue, subscriptions, invoices, coupons, webhook health.</p>
        </div>
        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={loadAll} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="admin-auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="admin-tabs" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
        {(['overview', 'invoices', 'coupons', 'webhooks'] as const).map(t => (
          <button key={t}
            className={`admin-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: tab === t ? '#0f172a' : '#64748b',
              borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'overview' && analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <StatCard label="MRR"               value={fmtCurrency(analytics.mrr)} sub={`ARR ${fmtCurrency(analytics.arr)}`} />
          <StatCard label="Today's revenue"   value={fmtCurrency(analytics.todayRevenue)} sub={`Total ${fmtCurrency(analytics.totalRevenue)}`} />
          <StatCard label="Active subs"       value={String(analytics.activeSubscriptions)} sub={`+${analytics.newThisMonth} this month`} />
          <StatCard label="Churn rate"        value={`${analytics.churnRate.toFixed(2)}%`} sub={`${analytics.canceledThisMonth} canceled`} />
          <StatCard label="Success rate"      value={`${analytics.successRate.toFixed(1)}%`} sub={`${analytics.failedPayments} failed`} />
          <StatCard label="Refunds"           value={String(analytics.refundCount)} sub={fmtCurrency(analytics.refundAmount)} />
          <StatCard label="ARPU"              value={fmtCurrency(analytics.avgRevenuePerUser)} sub="per active subscriber" />
          <StatCard label="Stripe balance"    value={fmtCurrency(analytics.balance)} sub="available" />
          <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>Revenue — last 7 days</div>
            <RevenueBars points={analytics.revenue7d} />
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <DataTable
          headers={['Customer', 'Amount', 'Status', 'Period', 'Created', 'Link']}
          rows={invoices.map(inv => [
            inv.customer_email || inv.customer,
            fmtCurrency(inv.amount_paid || inv.amount_due, inv.currency),
            inv.status,
            `${new Date(inv.period_start * 1000).toLocaleDateString()} → ${new Date(inv.period_end * 1000).toLocaleDateString()}`,
            fmtDate(inv.created),
            inv.hosted_invoice_url ? <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">View</a> : '—',
          ])}
          empty="No invoices."
        />
      )}

      {tab === 'coupons' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleCreateCoupon}>+ New coupon</button>
          </div>
          <DataTable
            headers={['Name', 'Discount', 'Duration', 'Redeemed', 'Valid', 'Created', '']}
            rows={coupons.map(c => [
              c.name || c.id,
              c.percent_off ? `${c.percent_off}% off` : c.amount_off ? fmtCurrency(c.amount_off, c.currency ?? 'usd') : '—',
              c.duration === 'repeating' ? `${c.duration_in_months}mo` : c.duration,
              `${c.times_redeemed}${c.max_redemptions ? ` / ${c.max_redemptions}` : ''}`,
              c.valid ? 'Yes' : 'No',
              fmtDate(c.created),
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => handleDeleteCoupon(c.id)}>Delete</button>,
            ])}
            empty="No coupons."
          />
        </>
      )}

      {tab === 'webhooks' && (
        <DataTable
          headers={['Type', 'Status', 'Mode', 'Created', 'Error']}
          rows={webhookLogs.map(w => [
            w.type,
            <span style={{ color: w.status === 'success' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{w.status}</span>,
            w.livemode ? 'live' : 'test',
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
      {points.map((p) => (
        <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div title={fmtCurrency(p.amount)} style={{
            width: '100%',
            height: `${(p.amount / max) * 100}%`,
            background: 'linear-gradient(180deg, #818cf8, #6366f1)',
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
