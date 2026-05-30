import { useState } from 'react'
import './admin.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d' | '1y'

interface KPI {
  label: string
  value: string
  trend: string
  trendDir: 'up' | 'down'
  color: string
}

interface TopProduct {
  name: string
  category: string
  categoryColor: string
  creator: string
  downloads: number
  revenue: string
}

// ── Mock data (varies by date range) ─────────────────────────────────────────

const KPI_DATA: Record<DateRange, KPI[]> = {
  '7d': [
    { label: 'Revenue',           value: '$22,814', trend: '+8.2% vs prev period', trendDir: 'up',   color: '#10b981' },
    { label: 'New Users',         value: '873',     trend: '+12.4% vs prev period', trendDir: 'up',  color: '#22d3ee' },
    { label: 'AI Requests',       value: '998K',    trend: '+18.7% vs prev period', trendDir: 'up',  color: '#8b5cf6' },
    { label: 'Marketplace DLs',   value: '4,321',   trend: '+5.1% vs prev period',  trendDir: 'up',  color: '#f59e0b' },
  ],
  '30d': [
    { label: 'Revenue',           value: '$96,420',  trend: '+14.3% vs prev period', trendDir: 'up',  color: '#10b981' },
    { label: 'New Users',         value: '3,741',    trend: '+9.6% vs prev period',  trendDir: 'up',  color: '#22d3ee' },
    { label: 'AI Requests',       value: '4.28M',    trend: '+21.2% vs prev period', trendDir: 'up',  color: '#8b5cf6' },
    { label: 'Marketplace DLs',   value: '18,934',   trend: '-2.1% vs prev period',  trendDir: 'down', color: '#f59e0b' },
  ],
  '90d': [
    { label: 'Revenue',           value: '$281,340', trend: '+22.7% vs prev period', trendDir: 'up',  color: '#10b981' },
    { label: 'New Users',         value: '11,280',   trend: '+17.4% vs prev period', trendDir: 'up',  color: '#22d3ee' },
    { label: 'AI Requests',       value: '12.9M',    trend: '+34.1% vs prev period', trendDir: 'up',  color: '#8b5cf6' },
    { label: 'Marketplace DLs',   value: '57,882',   trend: '+8.3% vs prev period',  trendDir: 'up',  color: '#f59e0b' },
  ],
  '1y': [
    { label: 'Revenue',           value: '$1.14M',   trend: '+61.8% vs prev year',   trendDir: 'up',  color: '#10b981' },
    { label: 'New Users',         value: '44,120',   trend: '+83.2% vs prev year',   trendDir: 'up',  color: '#22d3ee' },
    { label: 'AI Requests',       value: '51.2M',    trend: '+142% vs prev year',    trendDir: 'up',  color: '#8b5cf6' },
    { label: 'Marketplace DLs',   value: '224,580',  trend: '+39.7% vs prev year',   trendDir: 'up',  color: '#f59e0b' },
  ],
}

// 30 daily revenue values for chart
const DAILY_REVENUE_30 = [
  2840, 3120, 2780, 3450, 4100, 3820, 3240, 2960, 3580, 4220,
  3940, 4500, 3710, 3280, 3890, 4180, 3640, 2920, 3750, 4380,
  4820, 4120, 3560, 3990, 4610, 4290, 3870, 4050, 3720, 3247,
]
const maxDailyRev = Math.max(...DAILY_REVENUE_30)

const TRAFFIC_SOURCES = [
  { source: 'Direct',   pct: 35, color: '#8b5cf6' },
  { source: 'Search',   pct: 28, color: '#22d3ee' },
  { source: 'Social',   pct: 18, color: '#10b981' },
  { source: 'Referral', pct: 12, color: '#f59e0b' },
  { source: 'Email',    pct:  7, color: '#ef4444' },
]

const TOP_PRODUCTS: TopProduct[] = [
  { name: 'LoFi Dreamscape Kit',    category: 'Samples',   categoryColor: 'badge-purple', creator: 'ChillWave',    downloads: 4821, revenue: '$9,642' },
  { name: 'Neural Drums Vol.3',     category: 'Drums',     categoryColor: 'badge-cyan',   creator: 'BeatForge',    downloads: 4109, revenue: '$8,218' },
  { name: 'Synthwave Presets Pro',  category: 'Presets',   categoryColor: 'badge-orange', creator: 'RetroSynth',   downloads: 3872, revenue: '$7,744' },
  { name: 'Vocal Chop FX Pack',     category: 'FX',        categoryColor: 'badge-green',  creator: 'VocalLab',     downloads: 3641, revenue: '$5,461' },
  { name: 'Dark Trap Construction', category: 'Loops',     categoryColor: 'badge-red',    creator: 'ShadowBeats',  downloads: 3298, revenue: '$6,596' },
  { name: 'Jazz Chord Progressions', category: 'MIDI',     categoryColor: 'badge-purple', creator: 'MelodyMind',   downloads: 2984, revenue: '$4,476' },
  { name: 'AI Stem Separator VST',  category: 'Plugin',    categoryColor: 'badge-cyan',   creator: 'NeuralAudio',  downloads: 2741, revenue: '$13,705' },
  { name: 'House Music Toolkit',    category: 'Samples',   categoryColor: 'badge-purple', creator: 'ClubKit',      downloads: 2503, revenue: '$5,006' },
  { name: 'Cinematic Score Pack',   category: 'Samples',   categoryColor: 'badge-orange', creator: 'FilmScore',    downloads: 2218, revenue: '$11,090' },
  { name: 'Dubstep Bass Growls',    category: 'Presets',   categoryColor: 'badge-green',  creator: 'WobbleLab',    downloads: 1987, revenue: '$3,974' },
]

const GEO_DATA = [
  { country: 'United States', pct: 38, users: '3,204' },
  { country: 'United Kingdom', pct: 14, users: '1,181' },
  { country: 'Germany',        pct: 9,  users: '759' },
  { country: 'Canada',         pct: 7,  users: '590' },
  { country: 'Australia',      pct: 5,  users: '422' },
]

const PLATFORM_DATA = [
  { label: 'Desktop App', pct: 58, color: '#8b5cf6' },
  { label: 'Web App',     pct: 28, color: '#22d3ee' },
  { label: 'Mobile',      pct: 14, color: '#10b981' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [range, setRange] = useState<DateRange>('30d')

  const kpis = KPI_DATA[range]

  return (
    <div className="admin-fade-in" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="admin-header">
        <div>
          <div className="admin-page-title">Analytics</div>
          <div className="admin-page-sub">Platform performance and growth metrics</div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="admin-date-range">
        {(['7d', '30d', '90d', '1y'] as DateRange[]).map(r => (
          <button
            key={r}
            className={`admin-date-btn${range === r ? ' active' : ''}`}
            onClick={() => setRange(r)}
          >
            {r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : r === '90d' ? 'Last 90 Days' : 'Past Year'}
          </button>
        ))}
      </div>

      {/* KPI Row */}
      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        {kpis.map((kpi, i) => (
          <div key={i} className="admin-card admin-card-glow admin-stat-card">
            <div className="admin-stat-glow" style={{ background: kpi.color }} />
            <div className="admin-stat-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="admin-stat-label">{kpi.label}</div>
            <div className={`admin-stat-delta ${kpi.trendDir === 'up' ? 'admin-stat-delta-up' : 'admin-stat-delta-down'}`}>
              {kpi.trendDir === 'up' ? '↑' : '↓'} {kpi.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart (30-day) */}
      <div className="admin-chart-wrap">
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Daily Revenue — Last 30 Days</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['$1k', '$2k', '$3k', '$4k', '$5k'].map(l => (
                <span key={l} style={{ fontSize: 9, color: '#334155' }}>{l}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
              {DAILY_REVENUE_30.map((val, i) => {
                const pct = (val / maxDailyRev) * 100
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${pct}%`,
                        borderRadius: '2px 2px 0 0',
                        background: `linear-gradient(180deg, #10b981 0%, rgba(16,185,129,0.3) 100%)`,
                        minHeight: 2,
                      }}
                    />
                    {(i === 0 || i === 9 || i === 19 || i === 29) && (
                      <div style={{ fontSize: 8, color: '#334155' }}>D{i + 1}</div>
                    )}
                    {!(i === 0 || i === 9 || i === 19 || i === 29) && (
                      <div style={{ fontSize: 8, height: 10 }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Sources + Geographic */}
      <div className="admin-grid-2">
        {/* Traffic Sources */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Traffic Sources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TRAFFIC_SOURCES.map(t => (
                <div key={t.source}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{t.source}</span>
                    <span style={{ fontSize: 11, color: '#475569' }}>{t.pct}%</span>
                  </div>
                  <div className="admin-progress-track">
                    <div className="admin-progress-fill" style={{ width: `${t.pct}%`, background: t.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Geographic Breakdown */}
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Geographic Breakdown (Top 5)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {GEO_DATA.map(g => (
                <div key={g.country}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{g.country}</span>
                    <span style={{ fontSize: 11, color: '#475569' }}>{g.users} users ({g.pct}%)</span>
                  </div>
                  <div className="admin-progress-track">
                    <div className="admin-progress-fill" style={{ width: `${g.pct}%`, background: '#8b5cf6' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Platform breakdown */}
      <div style={{ padding: '0 28px', marginBottom: 24 }}>
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Device / Platform Split</div>
            <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
              {PLATFORM_DATA.map(p => (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: `conic-gradient(${p.color} 0% ${p.pct}%, #1a1a2e ${p.pct}% 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: '#0c0c18',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: p.color,
                    }}>
                      {p.pct}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{p.pct}% of sessions</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="admin-table-wrap">
        <div style={{ marginBottom: 12 }}>
          <span className="admin-card-title">Top Marketplace Products</span>
        </div>
        <div className="admin-card admin-card-glow">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Category</th>
                <th>Creator</th>
                <th>Downloads</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {TOP_PRODUCTS.map((p, i) => (
                <tr key={i}>
                  <td style={{ color: '#334155', fontWeight: 700, width: 30 }}>{i + 1}</td>
                  <td style={{ color: '#f1f5f9', fontWeight: 600 }}>{p.name}</td>
                  <td><span className={`admin-badge ${p.categoryColor}`}>{p.category}</span></td>
                  <td>{p.creator}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.downloads.toLocaleString()}</td>
                  <td style={{ color: '#10b981', fontFamily: 'monospace', fontWeight: 700 }}>{p.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
