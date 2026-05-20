import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authTokens, isTokenExpired, apiGet } from '../lib/api'
import './Billing.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingTab = 'plan' | 'payment' | 'invoices' | 'credits' | 'history'

interface Invoice {
  id: string
  date: string
  description: string
  amount: number
  vat: number
  total: number
  status: 'paid' | 'pending' | 'overdue'
}

interface PaymentMethodItem {
  id: string
  type: 'card' | 'paypal'
  label: string
  detail: string
  isDefault: boolean
}

interface HistoryEntry {
  id: string
  date: string
  event: 'payment_succeeded' | 'payment_failed' | 'refund_issued' | 'subscription_created' | 'subscription_cancelled'
  description: string
  amount: number
  method: string
  status: 'completed' | 'failed' | 'pending'
  eligible_refund: boolean
}

interface CreditActivity {
  id: string
  date: string
  action: 'purchased' | 'used' | 'expired'
  amount: number
  note: string
}

// ─── API types ────────────────────────────────────────────────────────────────

interface SubData {
  planId: string
  status: string
  renewsAt?: number
  cancelAtPeriodEnd?: boolean
}

interface InvoiceItem {
  id: string
  number?: string
  totalCents: number
  currency?: string
  status: string
  createdAt: number
  paymentMethod?: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────


const MOCK_PAYMENT_METHODS: PaymentMethodItem[] = [
  { id: 'pm1', type: 'card',   label: 'Visa',     detail: '**** 4242 · exp 12/26', isDefault: true },
  { id: 'pm2', type: 'card',   label: 'Mastercard',detail: '**** 8210 · exp 03/27', isDefault: false },
  { id: 'pm3', type: 'paypal', label: 'PayPal',   detail: 'alex@email.com',        isDefault: false },
]

const MOCK_HISTORY: HistoryEntry[] = [
  { id: 'h1', date: 'May 1, 2025',  event: 'payment_succeeded',    description: 'Pro Plan — Monthly',  amount: 9.99,  method: 'Visa ****4242',     status: 'completed', eligible_refund: true  },
  { id: 'h2', date: 'Apr 1, 2025',  event: 'payment_succeeded',    description: 'Pro Plan — Monthly',  amount: 9.99,  method: 'Visa ****4242',     status: 'completed', eligible_refund: false },
  { id: 'h3', date: 'Mar 15, 2025', event: 'refund_issued',         description: 'Marketplace refund', amount: 4.99,  method: 'Visa ****4242',     status: 'completed', eligible_refund: false },
  { id: 'h4', date: 'Mar 1, 2025',  event: 'payment_succeeded',    description: 'Pro Plan — Monthly',  amount: 11.99, method: 'Visa ****4242',     status: 'completed', eligible_refund: false },
  { id: 'h5', date: 'Feb 14, 2025', event: 'payment_failed',        description: '500 AI Credits',     amount: 19.99, method: 'Mastercard ****8210',status: 'failed',    eligible_refund: false },
  { id: 'h6', date: 'Feb 1, 2025',  event: 'payment_succeeded',    description: '500 AI Credits',     amount: 19.99, method: 'PayPal',             status: 'completed', eligible_refund: false },
  { id: 'h7', date: 'Jan 15, 2025', event: 'subscription_created',  description: 'Pro Plan started',   amount: 9.99,  method: 'Visa ****4242',     status: 'completed', eligible_refund: false },
  { id: 'h8', date: 'Jan 1, 2025',  event: 'subscription_cancelled',description: 'Free trial ended',  amount: 0,     method: '—',                  status: 'completed', eligible_refund: false },
]

const MOCK_CREDIT_ACTIVITY: CreditActivity[] = [
  { id: 'ca1', date: 'May 12', action: 'used',      amount: -25,  note: 'AI Generation batch' },
  { id: 'ca2', date: 'May 8',  action: 'used',      amount: -10,  note: 'Mix Assistant' },
  { id: 'ca3', date: 'May 3',  action: 'purchased', amount: 500,  note: '500 Credit Pack' },
  { id: 'ca4', date: 'Apr 28', action: 'used',      amount: -40,  note: 'AI Generation batch' },
  { id: 'ca5', date: 'Apr 15', action: 'expired',   amount: -25,  note: 'Monthly bonus credits' },
]

const CREDIT_PACKS = [
  { credits: 100, price: 4.99, pkg: '100' },
  { credits: 500, price: 19.99, pkg: '500' },
  { credits: 2000, price: 69.99, pkg: '2000' },
]

// ─── Badge helpers ────────────────────────────────────────────────────────────

function EventBadge({ event }: { event: HistoryEntry['event'] }) {
  const map: Record<HistoryEntry['event'], { label: string; cls: string }> = {
    payment_succeeded:    { label: 'Payment',       cls: 'badge-green'  },
    payment_failed:       { label: 'Failed',         cls: 'badge-red'    },
    refund_issued:        { label: 'Refund',         cls: 'badge-orange' },
    subscription_created: { label: 'Subscribed',     cls: 'badge-purple' },
    subscription_cancelled:{ label: 'Cancelled',    cls: 'badge-grey'   },
  }
  const info = map[event]
  return <span className={`history-badge ${info.cls}`}>{info.label}</span>
}

function StatusBadge({ status }: { status: Invoice['status'] | HistoryEntry['status'] }) {
  const cls = status === 'paid' || status === 'completed' ? 'badge-green' : status === 'failed' ? 'badge-red' : 'badge-orange'
  return <span className={`history-badge ${cls}`}>{status}</span>
}

// ─── Component ────────────────────────────────────────────────────────────────

function Billing() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = authTokens.get()
    if (!token || isTokenExpired()) {
      navigate('/login?redirect=/billing', { replace: true })
    }
  }, [navigate])

  // ── API data ────────────────────────────────────────────────────────────────
  const [subscription, setSubscription] = useState<SubData | null>(null)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [subRes, invRes] = await Promise.all([
          apiGet<{ success: boolean; data: SubData | null }>('/api/payments/subscription'),
          apiGet<{ success: boolean; data: InvoiceItem[] }>('/api/payments/invoices'),
        ])
        if (subRes.data) setSubscription(subRes.data)
        if (invRes.data) setInvoices(invRes.data)
      } catch {
        // silently keep empty state
      } finally {
        setLoadingData(false)
      }
    }
    fetchData()
  }, [])

  const [activeTab, setActiveTab] = useState<BillingTab>('plan')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelDone, setCancelDone] = useState(false)
  const [defaultMethod, setDefaultMethod] = useState('pm1')
  const [removedMethods, setRemovedMethods] = useState<string[]>([])
  const [refundModalEntry, setRefundModalEntry] = useState<HistoryEntry | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundDone, setRefundDone] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null)

  const creditsBalance = 450
  const creditsTotal = 500
  const creditsPct = (creditsBalance / creditsTotal) * 100

  // Derive plan info from API subscription (fallback to free plan)
  const planNames: Record<string, string> = { pro: 'Pro', studio: 'Studio', label: 'Label', free: 'Free' }
  const planPrices: Record<string, number> = { pro: 9.99, studio: 24.99, label: 79.99, free: 0 }
  const subPlanId = subscription?.planId ?? 'free'
  const subStatus = cancelDone ? 'cancelled' : (subscription?.status ?? 'active')
  const renewsAt = subscription?.renewsAt
  const renewsDate = renewsAt
    ? new Date(renewsAt * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'June 14, 2025'
  const currentPlan = {
    name: planNames[subPlanId] ?? subPlanId,
    price: planPrices[subPlanId] ?? 0,
    status: subStatus,
    renewsDate,
  }

  const visibleMethods = MOCK_PAYMENT_METHODS.filter(m => !removedMethods.includes(m.id))

  const handleRemoveMethod = (id: string) => {
    if (id === defaultMethod) return
    setRemovedMethods(prev => [...prev, id])
  }

  const handleDownloadInvoice = (invoiceId: string) => {
    setGeneratingInvoice(invoiceId)
    setTimeout(() => {
      setGeneratingInvoice(null)
      const blob = new Blob([JSON.stringify({ invoice: invoiceId, generated: new Date().toISOString() }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${invoiceId}.json`; a.click()
      URL.revokeObjectURL(url)
    }, 1500)
  }

  const handleRefundSubmit = () => {
    setRefundDone(true)
    setTimeout(() => { setRefundModalEntry(null); setRefundDone(false); setRefundReason('') }, 2000)
  }

  return (
    <div className="billing-page">
      <div className="billing-hero">
        <div className="container">
          <div className="section-label">Billing</div>
          <h1 className="billing-title">Billing &amp; <span className="gradient-text">Subscription</span></h1>
        </div>
      </div>

      <div className="section-sm">
        <div className="container">
          {/* Tabs */}
          <div className="billing-tabs">
            {([['plan','Plan'],['payment','Payment Methods'],['invoices','Invoices'],['credits','Credits'],['history','History']] as [BillingTab, string][]).map(([tab, label]) => (
              <button key={tab} className={`billing-tab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>{label}</button>
            ))}
          </div>

          {/* ── Plan tab ────────────────────────────────────────── */}
          {activeTab === 'plan' && (
            <div className="billing-tab-content">
              <div className="glass-card billing-plan-card">
                <div className="billing-plan-header">
                  <div>
                    <span className="billing-plan-name">{currentPlan.name} Plan</span>
                    <StatusBadge status={currentPlan.status as Invoice['status']} />
                  </div>
                  <span className="billing-plan-price">${currentPlan.price.toFixed(2)}<span className="billing-plan-period">/mo</span></span>
                </div>
                <p className="billing-plan-renews">
                  {currentPlan.status === 'active'
                    ? `Renews ${currentPlan.renewsDate}`
                    : `Access until ${currentPlan.renewsDate}`}
                </p>

                {/* Usage bar */}
                <div className="billing-usage">
                  <div className="billing-usage-label-row">
                    <span className="billing-usage-label">AI Generations</span>
                    <span className="billing-usage-count">87 / 200 used</span>
                  </div>
                  <div className="billing-usage-bar">
                    <div className="billing-usage-fill" style={{ width: '43.5%' }} />
                  </div>
                  <p className="billing-usage-note">Resets in 12 days.</p>
                </div>

                <div className="billing-plan-actions">
                  <Link to="/pricing" className="btn-primary billing-plan-btn">Upgrade Plan</Link>
                  <Link to="/pricing" className="btn-secondary billing-plan-btn">Change Plan</Link>
                  {currentPlan.status === 'active' && (
                    <button className="billing-cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Subscription</button>
                  )}
                </div>
              </div>

              {/* Annual toggle note */}
              <div className="glass-card billing-annual-note">
                <div className="billing-annual-row">
                  <div>
                    <p className="billing-annual-title">Switch to annual billing</p>
                    <p className="billing-annual-sub">Save 20% — pay $95.88/year instead of $119.88</p>
                  </div>
                  <Link to="/checkout?plan=pro&annual=true" className="btn-secondary billing-annual-btn">Switch &amp; Save</Link>
                </div>
              </div>
            </div>
          )}

          {/* ── Payment Methods tab ─────────────────────────────── */}
          {activeTab === 'payment' && (
            <div className="billing-tab-content">
              <div className="glass-card billing-section-card">
                <h3 className="billing-section-title">Saved payment methods</h3>
                <div className="payment-methods-list">
                  {visibleMethods.map(m => (
                    <div key={m.id} className={`payment-method-item${m.id === defaultMethod ? ' default' : ''}`}>
                      <div className="payment-method-radio">
                        <input
                          type="radio"
                          id={`pm-${m.id}`}
                          name="defaultMethod"
                          checked={m.id === defaultMethod}
                          onChange={() => setDefaultMethod(m.id)}
                        />
                      </div>
                      <div className="payment-method-icon">
                        {m.type === 'paypal' ? '🅿' : '💳'}
                      </div>
                      <div className="payment-method-info">
                        <span className="payment-method-label">{m.label}</span>
                        <span className="payment-method-detail">{m.detail}</span>
                      </div>
                      {m.id === defaultMethod && <span className="payment-method-default-badge">Default</span>}
                      <button
                        className="payment-method-remove"
                        onClick={() => handleRemoveMethod(m.id)}
                        disabled={m.id === defaultMethod}
                        title={m.id === defaultMethod ? 'Cannot remove default method' : 'Remove'}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn-secondary billing-add-method-btn">+ Add Payment Method</button>
              </div>
            </div>
          )}

          {/* ── Invoices tab ─────────────────────────────────────── */}
          {activeTab === 'invoices' && (
            <div className="billing-tab-content">
              <div className="glass-card billing-section-card">
                <h3 className="billing-section-title">Invoices</h3>
                {loadingData ? (
                  <div className="billing-loading">Chargement…</div>
                ) : invoices.length === 0 ? (
                  <div className="billing-empty">
                    <p>Aucune facture.</p>
                  </div>
                ) : (
                  <div className="invoice-table-wrap">
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Date</th>
                          <th>Total</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map(inv => (
                          <tr key={inv.id}>
                            <td className="invoice-id">{inv.number ?? inv.id}</td>
                            <td className="invoice-date">
                              {new Date(inv.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="invoice-total">
                              {((inv.totalCents ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: inv.currency?.toUpperCase() ?? 'USD' })}
                            </td>
                            <td style={{ color: 'var(--muted)', fontSize: 13 }}>{inv.paymentMethod ?? '—'}</td>
                            <td><StatusBadge status={inv.status as Invoice['status']} /></td>
                            <td>
                              <button
                                className="invoice-download-btn"
                                onClick={() => handleDownloadInvoice(inv.id)}
                                disabled={generatingInvoice === inv.id}
                              >
                                {generatingInvoice === inv.id ? 'Generating…' : 'PDF ↓'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Credits tab ──────────────────────────────────────── */}
          {activeTab === 'credits' && (
            <div className="billing-tab-content">
              <div className="glass-card billing-section-card">
                <h3 className="billing-section-title">Credits balance</h3>
                <div className="credits-balance-display">
                  <span className="credits-balance-num">{creditsBalance}</span>
                  <span className="credits-balance-label">AI Credits remaining</span>
                </div>
                <div className="billing-usage-bar" style={{ marginTop: 8 }}>
                  <div className="billing-usage-fill credits-fill" style={{ width: `${creditsPct}%` }} />
                </div>
                <p className="billing-usage-note">{creditsBalance} of {creditsTotal} credits remaining · Expires Jun 30, 2025</p>
              </div>

              {/* Sparkline */}
              <div className="glass-card billing-section-card">
                <h3 className="billing-section-title">Usage this week</h3>
                <div className="credits-sparkline">
                  {[20, 45, 15, 60, 25, 40, 10].map((h, i) => (
                    <div key={i} className="sparkline-bar" style={{ height: `${h}%` }} title={`${h} credits`} />
                  ))}
                </div>
                <div className="credits-activity-table">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Action</th><th>Amount</th><th>Note</th></tr>
                    </thead>
                    <tbody>
                      {MOCK_CREDIT_ACTIVITY.map(ca => (
                        <tr key={ca.id}>
                          <td className="invoice-date">{ca.date}</td>
                          <td><span className={`history-badge ${ca.action === 'purchased' ? 'badge-green' : ca.action === 'expired' ? 'badge-orange' : 'badge-grey'}`}>{ca.action}</span></td>
                          <td className={ca.amount > 0 ? 'credits-positive' : 'credits-negative'}>{ca.amount > 0 ? `+${ca.amount}` : ca.amount}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 13 }}>{ca.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Buy more packs */}
              <div className="glass-card billing-section-card">
                <h3 className="billing-section-title">Buy more credits</h3>
                <div className="billing-credit-packs">
                  {CREDIT_PACKS.map(pack => (
                    <Link key={pack.pkg} to={`/checkout?type=credits&pkg=${pack.pkg}`} className="billing-credit-pack glass-card">
                      <span className="billing-pack-credits">{pack.credits.toLocaleString()}</span>
                      <span className="billing-pack-label">credits</span>
                      <span className="billing-pack-price">${pack.price.toFixed(2)}</span>
                      <span className="billing-pack-cta">Buy →</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── History tab ──────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="billing-tab-content">
              <div className="glass-card billing-section-card">
                <h3 className="billing-section-title">Payment history</h3>
                <div className="invoice-table-wrap">
                  <table className="invoice-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Event</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_HISTORY.map(entry => (
                        <tr key={entry.id}>
                          <td className="invoice-date">{entry.date}</td>
                          <td><EventBadge event={entry.event} /></td>
                          <td>{entry.description}</td>
                          <td>{entry.amount > 0 ? `$${entry.amount.toFixed(2)}` : '—'}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 13 }}>{entry.method}</td>
                          <td><StatusBadge status={entry.status} /></td>
                          <td>
                            {entry.eligible_refund && (
                              <button className="refund-btn" onClick={() => setRefundModalEntry(entry)}>
                                Refund
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Cancel modal ──────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="billing-modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="billing-modal glass-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Cancel subscription?</h3>
            <p className="modal-body">
              You'll lose access to Pro features at the end of your current billing period (<strong>{currentPlan.renewsDate}</strong>). Your projects and data remain safe.
            </p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowCancelModal(false)}>Keep my plan</button>
              <button className="billing-cancel-confirm-btn" onClick={() => { setCancelDone(true); setShowCancelModal(false) }}>
                Cancel anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refund modal ──────────────────────────────────────────── */}
      {refundModalEntry && (
        <div className="billing-modal-overlay" onClick={() => !refundDone && setRefundModalEntry(null)}>
          <div className="billing-modal glass-card" onClick={e => e.stopPropagation()}>
            {refundDone ? (
              <div className="modal-done">
                <p className="modal-done-icon">✓</p>
                <p className="modal-done-text">Refund request submitted!</p>
              </div>
            ) : (
              <>
                <h3 className="modal-title">Request refund</h3>
                <p className="modal-body">
                  Requesting refund for <strong>{refundModalEntry.description}</strong> — ${refundModalEntry.amount.toFixed(2)}
                </p>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <select className="form-input form-select" value={refundReason} onChange={e => setRefundReason(e.target.value)}>
                    <option value="">Select a reason…</option>
                    <option value="duplicate">Duplicate charge</option>
                    <option value="not_working">Product not working</option>
                    <option value="changed_mind">Changed my mind</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setRefundModalEntry(null)}>Cancel</button>
                  <button className="btn-primary" disabled={!refundReason} onClick={handleRefundSubmit}>
                    Submit Request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Billing
