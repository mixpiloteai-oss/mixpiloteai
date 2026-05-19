import { useState, useEffect, useRef } from 'react'
import './admin.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  latency: number
  uptime: number
  errors24h: number
}

interface ErrorLog {
  timestamp: string
  level: 'ERROR' | 'WARN'
  message: string
  endpoint: string
  count: number
}

interface AlertRule {
  name: string
  metric: string
  threshold: number
  current: number
  triggered: boolean
}

// ── Mock static data ──────────────────────────────────────────────────────────

const INITIAL_SERVICES: ServiceStatus[] = [
  { name: 'API Gateway',     status: 'healthy',  latency: 42,  uptime: 99.98, errors24h: 3 },
  { name: 'PostgreSQL',      status: 'healthy',  latency: 8,   uptime: 99.99, errors24h: 0 },
  { name: 'AI Service',      status: 'degraded', latency: 312, uptime: 99.41, errors24h: 47 },
  { name: 'Redis Cache',     status: 'healthy',  latency: 2,   uptime: 100,   errors24h: 0 },
  { name: 'Storage S3',      status: 'healthy',  latency: 65,  uptime: 99.97, errors24h: 1 },
  { name: 'Email Service',   status: 'degraded', latency: 180, uptime: 98.82, errors24h: 12 },
  { name: 'Payment Gateway', status: 'healthy',  latency: 95,  uptime: 99.95, errors24h: 2 },
  { name: 'WebSocket Hub',   status: 'healthy',  latency: 18,  uptime: 99.87, errors24h: 5 },
]

const ERROR_LOGS: ErrorLog[] = [
  { timestamp: '14:32:18', level: 'ERROR', message: 'AI inference timeout after 30s',     endpoint: '/api/ai/generate',    count: 8 },
  { timestamp: '14:29:05', level: 'WARN',  message: 'High memory usage on ai-worker-02',  endpoint: 'internal',            count: 1 },
  { timestamp: '14:21:44', level: 'ERROR', message: 'Email delivery failed: SMTP 550',    endpoint: '/api/email/send',     count: 4 },
  { timestamp: '14:18:33', level: 'WARN',  message: 'Rate limit approaching for user #8831', endpoint: '/api/marketplace', count: 1 },
  { timestamp: '14:09:11', level: 'ERROR', message: 'Payment webhook signature mismatch', endpoint: '/webhooks/stripe',    count: 1 },
  { timestamp: '13:58:27', level: 'WARN',  message: 'Slow query detected (>500ms)',        endpoint: '/api/search',         count: 3 },
  { timestamp: '13:44:02', level: 'ERROR', message: 'Presigned URL generation failed',    endpoint: '/api/storage/upload', count: 1 },
  { timestamp: '13:30:50', level: 'WARN',  message: 'Redis eviction rate elevated',        endpoint: 'internal',            count: 1 },
  { timestamp: '13:12:39', level: 'ERROR', message: 'Auth token verification failed',     endpoint: '/api/auth/verify',    count: 6 },
  { timestamp: '12:58:14', level: 'WARN',  message: 'CDN cache miss ratio >40%',           endpoint: 'cdn-edge',            count: 1 },
]

const ALERT_RULES: AlertRule[] = [
  { name: 'CPU Critical',       metric: 'CPU Usage',        threshold: 80,   current: 54,   triggered: false },
  { name: 'Error Rate High',    metric: 'Error Rate %',     threshold: 1,    current: 0.42, triggered: false },
  { name: 'AI Latency',         metric: 'AI Latency (ms)',  threshold: 300,  current: 312,  triggered: true },
  { name: 'RAM Warning',        metric: 'RAM Usage %',      threshold: 85,   current: 68,   triggered: false },
  { name: 'Queue Depth',        metric: 'Job Queue Depth',  threshold: 500,  current: 124,  triggered: false },
  { name: 'DB Connections',     metric: 'DB Connections',   threshold: 90,   current: 37,   triggered: false },
]

// Hourly request volume pattern (0-23h)
const HOURLY_VOLUME = [
  180, 120, 90, 70, 85, 140, 280, 520, 740, 910,
  980, 1020, 1050, 1100, 1080, 1140, 1200, 1350, 1420, 1380,
  1260, 1050, 820, 540,
]
const maxVol = Math.max(...HOURLY_VOLUME)

// ── Helpers ───────────────────────────────────────────────────────────────────

function randWalk(current: number, step: number, min: number, max: number) {
  const delta = (Math.random() - 0.5) * step * 2
  return Math.min(max, Math.max(min, current + delta))
}

function cpuColor(v: number) {
  if (v >= 80) return '#ef4444'
  if (v >= 60) return '#f59e0b'
  return '#10b981'
}

function formatNow() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Monitoring() {
  const [cpu, setCpu]       = useState(54)
  const [ram, setRam]       = useState(11.2)   // GB used (of 16)
  const [reqMin, setReqMin] = useState(847)
  const [errRate, setErrRate] = useState(0.42)
  const [sparkCpu, setSparkCpu] = useState<number[]>(Array.from({ length: 20 }, () => 50 + Math.random() * 15))
  const [lastUpdated, setLastUpdated] = useState(formatNow())
  const [alertOpen, setAlertOpen] = useState(true)

  const cpuRef    = useRef(cpu)
  const ramRef    = useRef(ram)
  const reqRef    = useRef(reqMin)
  const errRef    = useRef(errRate)

  useEffect(() => {
    cpuRef.current = cpu
  }, [cpu])
  useEffect(() => {
    ramRef.current = ram
  }, [ram])
  useEffect(() => {
    reqRef.current = reqMin
  }, [reqMin])
  useEffect(() => {
    errRef.current = errRate
  }, [errRate])

  useEffect(() => {
    const id = setInterval(() => {
      const newCpu = randWalk(cpuRef.current, 5, 10, 95)
      setCpu(newCpu)
      setSparkCpu(prev => [...prev.slice(1), newCpu])
      setRam(randWalk(ramRef.current, 0.05, 6, 15.8))
      setReqMin(Math.round(randWalk(reqRef.current, 20, 400, 2000)))
      setErrRate(parseFloat(randWalk(errRef.current, 0.05, 0.1, 2).toFixed(2)))
      setLastUpdated(formatNow())
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const overallStatus = errRate > 1 || cpu > 80 ? 'Degraded' : 'All Systems Operational'
  const statusClass   = overallStatus === 'Degraded' ? 'badge-red' : 'badge-green'

  return (
    <div className="admin-fade-in" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="admin-header">
        <div>
          <div className="admin-page-title">Live System Monitoring</div>
          <div className="admin-page-sub">Updated every 5 seconds — {lastUpdated}</div>
        </div>
        <div className="admin-header-actions">
          <span className={`admin-badge ${statusClass}`}>{overallStatus}</span>
        </div>
      </div>

      {/* ── Top Metric Cards ── */}
      <div className="admin-stat-grid">
        {/* CPU */}
        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: cpuColor(cpu) }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div className="admin-stat-label">CPU Usage</div>
              <div className="admin-metric-big" style={{ color: cpuColor(cpu), marginTop: 4 }}>
                {cpu.toFixed(1)}%
              </div>
            </div>
            <div className="sparkline">
              {sparkCpu.map((v, i) => (
                <div
                  key={i}
                  className="sparkline-bar"
                  style={{
                    height: `${(v / 100) * 32}px`,
                    background: cpuColor(v),
                    opacity: 0.4 + (i / sparkCpu.length) * 0.6,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="admin-progress-track">
            <div className="admin-progress-fill" style={{ width: `${cpu}%`, background: cpuColor(cpu) }} />
          </div>
        </div>

        {/* RAM */}
        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#8b5cf6' }} />
          <div className="admin-stat-label">RAM Usage</div>
          <div className="admin-metric-big" style={{ color: '#8b5cf6', marginTop: 4, marginBottom: 8 }}>
            {ram.toFixed(1)} <span style={{ fontSize: 18, fontWeight: 600 }}>/ 16 GB</span>
          </div>
          <div className="admin-progress-track">
            <div className="admin-progress-fill" style={{ width: `${(ram / 16) * 100}%`, background: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
            {((ram / 16) * 100).toFixed(1)}% utilization
          </div>
        </div>

        {/* Requests/min */}
        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: '#22d3ee' }} />
          <div className="admin-stat-label">Requests / Min</div>
          <div className="admin-metric-big" style={{ color: '#22d3ee', marginTop: 4, marginBottom: 8 }}>
            {reqMin.toLocaleString()}
          </div>
          <div className={`admin-stat-delta admin-stat-delta-up`}>
            ↑ Live updating
          </div>
        </div>

        {/* Error Rate */}
        <div className="admin-card admin-card-glow admin-stat-card">
          <div className="admin-stat-glow" style={{ background: errRate > 1 ? '#ef4444' : '#10b981' }} />
          <div className="admin-stat-label">Error Rate</div>
          <div className="admin-metric-big" style={{ color: errRate > 1 ? '#ef4444' : '#10b981', marginTop: 4, marginBottom: 8 }}>
            {errRate.toFixed(2)}%
          </div>
          <span className={`admin-badge ${errRate > 1 ? 'badge-red' : 'badge-green'}`}>
            {errRate > 1 ? 'Elevated' : 'Normal'}
          </span>
        </div>
      </div>

      {/* ── Services Grid ── */}
      <div style={{ padding: '0 28px', marginBottom: 8 }}>
        <div className="admin-card-title" style={{ marginBottom: 12 }}>Service Health</div>
      </div>
      <div className="admin-services-grid">
        {INITIAL_SERVICES.map(svc => {
          const dotClass = svc.status === 'healthy' ? 'dot-green' : svc.status === 'degraded' ? 'dot-orange' : 'dot-red'
          const maxLatency = 500
          const latPct = Math.min((svc.latency / maxLatency) * 100, 100)
          const latColor = svc.latency < 100 ? '#10b981' : svc.latency < 300 ? '#f59e0b' : '#ef4444'
          return (
            <div key={svc.name} className="admin-card admin-card-glow admin-service-card">
              <div className="admin-service-name">
                <span className={`status-dot ${dotClass} dot-pulse`} />
                {svc.name}
              </div>
              <div className="admin-service-latency">{svc.latency}ms avg</div>
              <div className="admin-progress-track" style={{ marginBottom: 6 }}>
                <div className="admin-progress-fill" style={{ width: `${latPct}%`, background: latColor }} />
              </div>
              <div className="admin-service-meta">
                <span>Uptime {svc.uptime}%</span>
                <span style={{ color: svc.errors24h > 10 ? '#ef4444' : '#334155' }}>
                  {svc.errors24h} err/24h
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Request Volume Chart ── */}
      <div className="admin-chart-wrap">
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Request Volume — Past 24 Hours</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
              {HOURLY_VOLUME.map((vol, i) => {
                const pct = (vol / maxVol) * 100
                const hour = i === 0 ? '12a' : i === 6 ? '6a' : i === 12 ? '12p' : i === 18 ? '6p' : i === 23 ? '11p' : ''
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${pct}%`,
                        borderRadius: '2px 2px 0 0',
                        background: `linear-gradient(180deg, #22d3ee 0%, rgba(34,211,238,0.3) 100%)`,
                        minHeight: 2,
                      }}
                    />
                    <div style={{ fontSize: 8, color: '#334155', height: 10 }}>{hour}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Error Log ── */}
      <div className="admin-table-wrap">
        <div style={{ marginBottom: 12 }}>
          <span className="admin-card-title">Recent Error Log</span>
        </div>
        <div className="admin-card admin-card-glow">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Message</th>
                <th>Endpoint</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_LOGS.map((log, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.timestamp}</td>
                  <td>
                    <span className={`admin-badge ${log.level === 'ERROR' ? 'badge-red' : 'badge-orange'}`}>
                      {log.level}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8', maxWidth: 300 }}>{log.message}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>{log.endpoint}</td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12 }}>{log.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Alert Rules ── */}
      <div className="admin-table-wrap">
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, cursor: 'pointer' }}
          onClick={() => setAlertOpen(o => !o)}
        >
          <span className="admin-card-title">Alert Rules ({ALERT_RULES.filter(r => r.triggered).length} triggered)</span>
          <span style={{ fontSize: 12, color: '#475569' }}>{alertOpen ? '▲ collapse' : '▼ expand'}</span>
        </div>
        {alertOpen && (
          <div className="admin-card admin-card-glow">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Metric</th>
                  <th>Threshold</th>
                  <th>Current</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ALERT_RULES.map((rule, i) => (
                  <tr key={i}>
                    <td style={{ color: '#f1f5f9', fontWeight: 600 }}>{rule.name}</td>
                    <td>{rule.metric}</td>
                    <td style={{ fontFamily: 'monospace' }}>{rule.threshold}</td>
                    <td style={{ fontFamily: 'monospace', color: rule.triggered ? '#ef4444' : '#10b981' }}>
                      {rule.current}
                    </td>
                    <td>
                      <span className={`admin-badge ${rule.triggered ? 'badge-red' : 'badge-green'}`}>
                        {rule.triggered ? 'TRIGGERED' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
