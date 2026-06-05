import './admin.css'
import { useState } from 'react'

interface AIModel {
  id: string
  name: string
  provider: string
  version: string
  status: 'active' | 'standby' | 'disabled'
  requestsToday: number
  requestsMonth: number
  avgLatencyMs: number
  errorRate: number
  costPer1k: number
  maxTokens: number
  enabled: boolean
}

interface UsageBar {
  hour: string
  requests: number
}

const MODELS: AIModel[] = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', version: '4.6', status: 'active', requestsToday: 8_420, requestsMonth: 184_200, avgLatencyMs: 1840, errorRate: 0.8, costPer1k: 3.00, maxTokens: 200_000, enabled: true },
  { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5',  provider: 'Anthropic', version: '4.5', status: 'active', requestsToday: 21_300, requestsMonth: 620_000, avgLatencyMs: 420,  errorRate: 0.3, costPer1k: 0.25, maxTokens: 200_000, enabled: true },
  { id: 'claude-opus-4-7',   name: 'Claude Opus 4.7',   provider: 'Anthropic', version: '4.7', status: 'standby', requestsToday: 340,   requestsMonth: 4_200,   avgLatencyMs: 5200, errorRate: 1.2, costPer1k: 15.00, maxTokens: 200_000, enabled: true },
  { id: 'whisper-v3',        name: 'Whisper v3',         provider: 'OpenAI',    version: '3',   status: 'active', requestsToday: 1_820,  requestsMonth: 42_100,  avgLatencyMs: 2100, errorRate: 0.4, costPer1k: 0.006, maxTokens: 0, enabled: true },
  { id: 'local-bpm',         name: 'Local BPM Detector', provider: 'Internal', version: '1.2', status: 'active', requestsToday: 9_100,  requestsMonth: 210_000, avgLatencyMs: 85,   errorRate: 0.1, costPer1k: 0, maxTokens: 0, enabled: true },
]

const USAGE_24H: UsageBar[] = [
  { hour: '00', requests: 120 }, { hour: '02', requests: 80  }, { hour: '04', requests: 45  },
  { hour: '06', requests: 210 }, { hour: '08', requests: 840 }, { hour: '10', requests: 1420 },
  { hour: '12', requests: 1820 }, { hour: '14', requests: 2100 }, { hour: '16', requests: 1940 },
  { hour: '18', requests: 1650 }, { hour: '20', requests: 1200 }, { hour: '22', requests: 680 },
]
const maxReq = Math.max(...USAGE_24H.map(u => u.requests))

const STATUS_COLORS: Record<AIModel['status'], string> = {
  active:   'badge-green',
  standby:  'badge-orange',
  disabled: 'badge-red',
}

export default function AIManagement() {
  const [models, setModels] = useState(MODELS)
  const [rateLimit, setRateLimit] = useState('1000')

  const totalToday   = models.filter(m => m.enabled).reduce((s, m) => s + m.requestsToday, 0)
  const totalMonth   = models.filter(m => m.enabled).reduce((s, m) => s + m.requestsMonth, 0)
  const avgLatency   = Math.round(models.filter(m => m.enabled && m.avgLatencyMs > 0).reduce((s, m) => s + m.avgLatencyMs, 0) / models.filter(m => m.enabled && m.avgLatencyMs > 0).length)
  const totalCost    = models.filter(m => m.enabled && m.costPer1k > 0).reduce((s, m) => s + (m.requestsMonth / 1000) * m.costPer1k, 0)

  function toggleModel(id: string) {
    setModels(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))
  }

  return (
    <div className="admin-fade-in" style={{ padding: 28 }}>
      {/* Header */}
      <div className="admin-header" style={{ padding: 0, marginBottom: 24 }}>
        <div>
          <div className="admin-page-title">AI Management</div>
          <div className="admin-page-sub">Model status, usage metrics & rate limits</div>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stat-grid" style={{ paddingLeft: 0, paddingRight: 0, marginBottom: 24 }}>
        {[
          { label: 'Requests Today',  value: totalToday.toLocaleString(),  color: '#8b5cf6', delta: '+12% vs yesterday' },
          { label: 'Requests/Month',  value: (totalMonth / 1000).toFixed(0) + 'K', color: '#22d3ee', delta: '+8% vs last month' },
          { label: 'Avg Latency',     value: avgLatency + 'ms',             color: '#10b981', delta: 'p95: 4.2s' },
          { label: 'Est. Monthly Cost', value: '$' + totalCost.toFixed(0), color: '#f59e0b', delta: 'API costs only' },
        ].map(stat => (
          <div key={stat.label} className="admin-card admin-card-glow admin-stat-card">
            <div className="admin-stat-glow" style={{ background: stat.color }} />
            <div className="admin-stat-value" style={{ color: stat.color, fontSize: 22 }}>{stat.value}</div>
            <div className="admin-stat-label">{stat.label}</div>
            <div className="admin-stat-delta admin-stat-delta-up">{stat.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Models Table */}
          <div className="admin-card admin-card-glow">
            <div className="admin-card-body" style={{ paddingBottom: 0 }}>
              <div className="admin-card-title">AI Models</div>
            </div>
            <table className="admin-table">
              <thead>
                <tr><th>Model</th><th>Provider</th><th>Status</th><th>Req/Day</th><th>Latency</th><th>Error%</th><th>Cost/1K</th><th>Toggle</th></tr>
              </thead>
              <tbody>
                {models.map(m => (
                  <tr key={m.id} style={{ opacity: m.enabled ? 1 : 0.4 }}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>{m.id}</div>
                    </td>
                    <td style={{ fontSize: 12, color: '#475569' }}>{m.provider}</td>
                    <td><span className={`admin-badge ${STATUS_COLORS[m.status]}`} style={{ fontSize: 10 }}>{m.status}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                      {m.requestsToday.toLocaleString()}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: m.avgLatencyMs > 3000 ? '#f59e0b' : '#10b981' }}>
                      {m.avgLatencyMs > 0 ? m.avgLatencyMs + 'ms' : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: m.errorRate > 1 ? '#ef4444' : '#10b981' }}>
                      {m.errorRate}%
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#22d3ee' }}>
                      {m.costPer1k === 0 ? 'Free' : '$' + m.costPer1k.toFixed(3)}
                    </td>
                    <td>
                      <button
                        onClick={() => toggleModel(m.id)}
                        className={`admin-btn admin-btn-sm ${m.enabled ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                      >
                        {m.enabled ? 'On' : 'Off'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Usage chart */}
          <div className="admin-card admin-card-glow">
            <div className="admin-card-body">
              <div className="admin-card-title">Request Volume (24h)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {USAGE_24H.map(u => (
                  <div key={u.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%', borderRadius: 3,
                      height: `${(u.requests / maxReq) * 64}px`,
                      background: `linear-gradient(180deg, #8b5cf6, #22d3ee)`,
                      minHeight: 2,
                    }} />
                    <span style={{ fontSize: 9, color: '#334155' }}>{u.hour}h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel: Rate limits + Cost breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="admin-card admin-card-glow">
            <div className="admin-card-body">
              <div className="admin-card-title">Rate Limits</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Free', 'Pro', 'Studio', 'Label'].map((plan, i) => {
                  const limits = [10, 200, 1000, 5000]
                  return (
                    <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>{plan}</span>
                      <input
                        defaultValue={limits[i]}
                        type="number"
                        style={{
                          width: 80, padding: '4px 8px', borderRadius: 6, fontSize: 12,
                          background: '#0c0c18', border: '1px solid #1a1a2e', color: '#22d3ee',
                          fontFamily: 'monospace', outline: 'none', textAlign: 'right',
                        }}
                      />
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Global RPM cap</span>
                  <input
                    value={rateLimit}
                    onChange={e => setRateLimit(e.target.value)}
                    type="number"
                    style={{
                      width: 80, padding: '4px 8px', borderRadius: 6, fontSize: 12,
                      background: '#0c0c18', border: '1px solid #1a1a2e', color: '#8b5cf6',
                      fontFamily: 'monospace', outline: 'none', textAlign: 'right',
                    }}
                  />
                </div>
                <button className="admin-btn admin-btn-primary admin-btn-sm" style={{ width: '100%' }}>
                  Save Limits
                </button>
              </div>
            </div>
          </div>

          <div className="admin-card admin-card-glow">
            <div className="admin-card-body">
              <div className="admin-card-title">Cost Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {models.filter(m => m.costPer1k > 0 && m.enabled).map(m => {
                  const cost = (m.requestsMonth / 1000) * m.costPer1k
                  const pct = (cost / totalCost) * 100
                  return (
                    <div key={m.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: '#94a3b8' }}>{m.name}</span>
                        <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>${cost.toFixed(0)}</span>
                      </div>
                      <div style={{ height: 4, background: '#1a1a2e', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b', borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
                <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Total / month</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>
                    ${totalCost.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
