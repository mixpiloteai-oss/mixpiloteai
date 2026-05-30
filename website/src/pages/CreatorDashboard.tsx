import { useState, useRef } from 'react'
import './CreatorDashboard.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'products' | 'upload' | 'revenue' | 'audience'

interface DashProduct {
  id: string
  name: string
  category: string
  price: number
  status: 'approved' | 'pending' | 'flagged'
  downloads: number
  revenue: number
}

interface RevenueRow {
  date: string
  product: string
  sales: number
  amount: number
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const DASH_PRODUCTS: DashProduct[] = [
  { id: 'p1', name: 'Dark Techno Kicks Vol.1', category: 'kick',       price: 9.99,  status: 'approved', downloads: 2847, revenue: 284.13 },
  { id: 'p2', name: '808 Sound Bank Pro',       category: 'sound-bank', price: 24.99, status: 'approved', downloads: 5671, revenue: 991.20 },
  { id: 'p3', name: 'Snare Clap Collection',    category: 'snare',      price: 6.99,  status: 'approved', downloads: 3445, revenue: 168.78 },
  { id: 'p4', name: 'Modular Rack WIP',         category: 'rack',       price: 19.99, status: 'pending',  downloads: 0,    revenue: 0 },
  { id: 'p5', name: 'Unmastered Demo Kit',      category: 'sample',     price: 4.99,  status: 'flagged',  downloads: 201,  revenue: 0 },
]

const REVENUE_ROWS: RevenueRow[] = [
  { date: 'May 18, 2026', product: '808 Sound Bank Pro',       sales: 4,  amount: 69.97 },
  { date: 'May 17, 2026', product: 'Dark Techno Kicks Vol.1',  sales: 2,  amount: 13.99 },
  { date: 'May 16, 2026', product: '808 Sound Bank Pro',       sales: 6,  amount: 104.94 },
  { date: 'May 15, 2026', product: 'Snare Clap Collection',    sales: 3,  amount: 14.67 },
  { date: 'May 14, 2026', product: 'Dark Techno Kicks Vol.1',  sales: 5,  amount: 34.96 },
  { date: 'May 13, 2026', product: '808 Sound Bank Pro',       sales: 8,  amount: 139.93 },
  { date: 'May 12, 2026', product: 'Snare Clap Collection',    sales: 1,  amount: 4.89 },
]

const DOWNLOADS_LAST7 = [142, 89, 203, 178, 312, 267, 198]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const COUNTRIES = [
  { name: 'United States', pct: 38 },
  { name: 'Germany',        pct: 22 },
  { name: 'United Kingdom', pct: 16 },
  { name: 'France',         pct: 9 },
  { name: 'Japan',          pct: 7 },
]

const CATEGORIES = ['kick', 'hat', 'snare', 'preset', 'template', 'rack', 'plugin', 'sample', 'sound-bank', 'melody', 'bass']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function StatusBadge({ status }: { status: DashProduct['status'] }) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

function OverviewTab() {
  const maxDownloads = Math.max(...DOWNLOADS_LAST7)
  return (
    <div className="tab-pane">
      {/* Stat Cards */}
      <div className="overview-stats-grid">
        <div className="overview-stat-card glass-card">
          <div className="ov-stat-icon ov-icon-purple">↓</div>
          <div className="ov-stat-value">{fmtNum(DASH_PRODUCTS.reduce((s, p) => s + p.downloads, 0))}</div>
          <div className="ov-stat-label">Total Downloads</div>
        </div>
        <div className="overview-stat-card glass-card">
          <div className="ov-stat-icon ov-icon-green">$</div>
          <div className="ov-stat-value">$383.56</div>
          <div className="ov-stat-label">Revenue This Month</div>
        </div>
        <div className="overview-stat-card glass-card">
          <div className="ov-stat-icon ov-icon-cyan">+</div>
          <div className="ov-stat-value">214</div>
          <div className="ov-stat-label">New Followers</div>
        </div>
        <div className="overview-stat-card glass-card">
          <div className="ov-stat-icon ov-icon-purple">♪</div>
          <div className="ov-stat-value">{DASH_PRODUCTS.filter(p => p.status === 'approved').length}</div>
          <div className="ov-stat-label">Active Products</div>
        </div>
      </div>

      {/* Downloads Chart */}
      <div className="glass-card chart-card">
        <h3 className="dash-section-title">Downloads — Last 7 Days</h3>
        <div className="bar-chart">
          {DOWNLOADS_LAST7.map((val, i) => (
            <div key={i} className="bar-col">
              <div className="bar-value">{val}</div>
              <div className="bar-wrap">
                <div className="bar-fill" style={{ height: `${(val / maxDownloads) * 100}%` }} />
              </div>
              <div className="bar-label">{DAY_LABELS[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Products */}
      <div className="glass-card table-card">
        <h3 className="dash-section-title">Top Products</h3>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Downloads</th>
              <th>Revenue</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...DASH_PRODUCTS].sort((a, b) => b.downloads - a.downloads).slice(0, 5).map(p => (
              <tr key={p.id}>
                <td className="td-name">{p.name}</td>
                <td className="td-muted">{p.category}</td>
                <td>{fmtNum(p.downloads)}</td>
                <td className="td-green">${p.revenue.toFixed(2)}</td>
                <td><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProductsTab() {
  const [items, setItems] = useState<DashProduct[]>(DASH_PRODUCTS)

  function handleDelete(id: string) {
    if (window.confirm('Delete this product?')) {
      setItems(prev => prev.filter(p => p.id !== id))
    }
  }

  return (
    <div className="tab-pane">
      <div className="glass-card table-card">
        <div className="table-card-header">
          <h3 className="dash-section-title" style={{ marginBottom: 0 }}>My Products</h3>
          <span className="table-card-count">{items.length} items</span>
        </div>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Downloads</th>
              <th>Revenue</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id}>
                <td className="td-name">{p.name}</td>
                <td className="td-muted">{p.category}</td>
                <td>{p.price === 0 ? 'Free' : `$${p.price.toFixed(2)}`}</td>
                <td>{fmtNum(p.downloads)}</td>
                <td className="td-green">${p.revenue.toFixed(2)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  <div className="table-actions">
                    <button className="table-action-btn table-edit-btn">Edit</button>
                    <button className="table-action-btn table-del-btn" onClick={() => handleDelete(p.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UploadTab() {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [tags, setTags] = useState('')
  const [bpmMin, setBpmMin] = useState('')
  const [bpmMax, setBpmMax] = useState('')
  const [key, setKey] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [coverFile, setCoverFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setCoverFile(file.name)
  }

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !category) return
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev === null) return null
        if (prev >= 100) {
          clearInterval(interval)
          setUploaded(true)
          return 100
        }
        return prev + 10
      })
    }, 150)
  }

  if (uploaded) {
    return (
      <div className="tab-pane upload-success">
        <div className="upload-success-icon">✓</div>
        <h3>Upload Submitted!</h3>
        <p>Your product is under review. You'll be notified within 24–48 hours.</p>
        <button className="btn-secondary" onClick={() => { setUploaded(false); setUploadProgress(null); setName(''); setCategory(''); setDescription(''); setPrice(''); setTags(''); setBpmMin(''); setBpmMax(''); setKey(''); setCoverFile(null); }}>
          Upload Another
        </button>
      </div>
    )
  }

  return (
    <div className="tab-pane">
      <form className="upload-form" onSubmit={handleUpload}>
        {/* Drop Zone */}
        <div
          className={`upload-dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setCoverFile(f.name) }} />
          {coverFile ? (
            <div className="upload-dropzone-file">
              <span className="upload-dropzone-icon">📁</span>
              <span className="upload-dropzone-filename">{coverFile}</span>
            </div>
          ) : (
            <>
              <div className="upload-dropzone-icon">↑</div>
              <div className="upload-dropzone-text">Drag &amp; drop your files here</div>
              <div className="upload-dropzone-hint">ZIP, WAV, MP3, FLP, ALS accepted. Max 500MB.</div>
            </>
          )}
        </div>

        {/* Form Fields */}
        <div className="upload-form-grid">
          <div className="upload-field">
            <label className="upload-label">Product Name *</label>
            <input className="upload-input" type="text" placeholder="e.g. Dark Techno Kicks Vol.2" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="upload-field">
            <label className="upload-label">Category *</label>
            <select className="upload-input" value={category} onChange={e => setCategory(e.target.value)} required>
              <option value="">Select category…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
            </select>
          </div>
          <div className="upload-field upload-field-full">
            <label className="upload-label">Description</label>
            <textarea className="upload-input upload-textarea" placeholder="Describe your product..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="upload-field">
            <label className="upload-label">Price (USD) — leave 0 for free</label>
            <input className="upload-input" type="number" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} min={0} step={0.01} />
          </div>
          <div className="upload-field">
            <label className="upload-label">Tags (comma-separated)</label>
            <input className="upload-input" type="text" placeholder="Techno, Industrial, Hard" value={tags} onChange={e => setTags(e.target.value)} />
          </div>
          <div className="upload-field">
            <label className="upload-label">BPM Min</label>
            <input className="upload-input" type="number" placeholder="e.g. 128" value={bpmMin} onChange={e => setBpmMin(e.target.value)} min={0} max={300} />
          </div>
          <div className="upload-field">
            <label className="upload-label">BPM Max</label>
            <input className="upload-input" type="number" placeholder="e.g. 145" value={bpmMax} onChange={e => setBpmMax(e.target.value)} min={0} max={300} />
          </div>
          <div className="upload-field">
            <label className="upload-label">Key</label>
            <input className="upload-input" type="text" placeholder="e.g. A minor" value={key} onChange={e => setKey(e.target.value)} />
          </div>
        </div>

        {/* Progress Bar */}
        {uploadProgress !== null && (
          <div className="upload-progress-wrap">
            <div className="upload-progress-bar">
              <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="upload-progress-label">{uploadProgress}%</span>
          </div>
        )}

        <button type="submit" className="btn-primary upload-submit-btn">
          Upload Files
        </button>
      </form>
    </div>
  )
}

function RevenueTab() {
  const total = REVENUE_ROWS.reduce((s, r) => s + r.amount, 0)
  const share = total * 0.7
  const [payoutSent, setPayoutSent] = useState(false)

  return (
    <div className="tab-pane">
      <div className="revenue-summary-row">
        <div className="glass-card revenue-summary-card">
          <div className="rev-sum-label">Total Earnings (Your 70%)</div>
          <div className="rev-sum-value gradient-text">${share.toFixed(2)}</div>
        </div>
        <div className="glass-card revenue-summary-card">
          <div className="rev-sum-label">Gross Revenue</div>
          <div className="rev-sum-value">${total.toFixed(2)}</div>
        </div>
        <div className="glass-card revenue-summary-card">
          <div className="rev-sum-label">Platform Fee (30%)</div>
          <div className="rev-sum-value td-muted-val">${(total * 0.3).toFixed(2)}</div>
        </div>
        <div className="glass-card revenue-summary-card">
          <button
            className={payoutSent ? 'btn-secondary payout-btn' : 'btn-primary payout-btn'}
            disabled={share < 50 || payoutSent}
            onClick={() => setPayoutSent(true)}
          >
            {payoutSent ? 'Payout Requested ✓' : `Request Payout`}
          </button>
          <div className="rev-payout-note">{share >= 50 ? 'Minimum met ($50)' : `Minimum $50 required (${(50 - share).toFixed(2)} more)`}</div>
        </div>
      </div>

      <div className="glass-card table-card">
        <h3 className="dash-section-title">Transaction History</h3>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Sales</th>
              <th>Gross</th>
              <th>Your Share (70%)</th>
            </tr>
          </thead>
          <tbody>
            {REVENUE_ROWS.map((r, i) => (
              <tr key={i}>
                <td className="td-muted">{r.date}</td>
                <td className="td-name">{r.product}</td>
                <td>{r.sales}</td>
                <td>${r.amount.toFixed(2)}</td>
                <td className="td-green">${(r.amount * 0.7).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AudienceTab() {
  return (
    <div className="tab-pane">
      <div className="audience-grid">
        {/* Follower Stats */}
        <div className="glass-card audience-card">
          <h3 className="dash-section-title">Follower Stats</h3>
          <div className="audience-stats-list">
            <div className="audience-stat-row"><span>Total Followers</span><strong>12,400</strong></div>
            <div className="audience-stat-row"><span>New This Month</span><strong className="td-green">+214</strong></div>
            <div className="audience-stat-row"><span>Avg. Monthly Growth</span><strong>+3.2%</strong></div>
            <div className="audience-stat-row"><span>Returning Visitors</span><strong>68%</strong></div>
          </div>
        </div>

        {/* Subscription Tiers */}
        <div className="glass-card audience-card">
          <h3 className="dash-section-title">Subscription Tiers</h3>
          <div className="audience-tiers-list">
            {[
              { name: 'Studio',  count: 48,  pct: 15, color: 'var(--purple)' },
              { name: 'Pro',     count: 142, pct: 44, color: 'var(--cyan)' },
              { name: 'Basic',   count: 133, pct: 41, color: 'rgba(167,139,250,0.4)' },
            ].map(t => (
              <div key={t.name} className="audience-tier-row">
                <span className="audience-tier-name">{t.name}</span>
                <div className="audience-tier-bar-wrap">
                  <div className="audience-tier-bar" style={{ width: `${t.pct}%`, background: t.color }} />
                </div>
                <span className="audience-tier-count">{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Geography */}
        <div className="glass-card audience-card audience-geo-card">
          <h3 className="dash-section-title">Top Countries</h3>
          <div className="audience-geo-list">
            {COUNTRIES.map(c => (
              <div key={c.name} className="audience-geo-row">
                <span className="audience-geo-name">{c.name}</span>
                <div className="audience-geo-bar-wrap">
                  <div className="audience-geo-bar" style={{ width: `${c.pct}%` }} />
                </div>
                <span className="audience-geo-pct">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CreatorDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Simulate login check via localStorage
  const hasToken = Boolean(localStorage.getItem('auth_token') ?? 'demo_token_present')

  if (!hasToken) {
    return (
      <div className="creator-dashboard-page">
        <div className="dash-login-prompt">
          <div className="dash-login-icon">🔒</div>
          <h2>Sign in to access your dashboard</h2>
          <p>You need to be logged in to view your creator analytics and manage your products.</p>
          <a href="/login" className="btn-primary">Sign In</a>
        </div>
      </div>
    )
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'products',  label: 'Products' },
    { id: 'upload',    label: 'Upload' },
    { id: 'revenue',   label: 'Revenue' },
    { id: 'audience',  label: 'Audience' },
  ]

  return (
    <div className="creator-dashboard-page">
      <div className="dash-hero">
        <div className="container">
          <div className="section-label">Creator Portal</div>
          <h1 className="dash-title">Creator <span className="gradient-text">Dashboard</span></h1>
        </div>
      </div>

      <div className="dash-tab-bar">
        <div className="container">
          <div className="dash-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`dash-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-content section-sm">
        <div className="container">
          {activeTab === 'overview'  && <OverviewTab />}
          {activeTab === 'products'  && <ProductsTab />}
          {activeTab === 'upload'    && <UploadTab />}
          {activeTab === 'revenue'   && <RevenueTab />}
          {activeTab === 'audience'  && <AudienceTab />}
        </div>
      </div>
    </div>
  )
}

export default CreatorDashboard
