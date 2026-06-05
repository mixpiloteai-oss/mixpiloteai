import './admin.css'
import { useState } from 'react'

interface FeatureFlag {
  key: string
  label: string
  description: string
  enabled: boolean
  rollout: number
}

interface AuditEntry {
  id: number
  actor: string
  action: string
  target: string
  time: string
}

const INITIAL_FLAGS: FeatureFlag[] = [
  { key: 'marketplace_uploads',  label: 'Marketplace Uploads',  description: 'Allow users to upload packs & presets',       enabled: true,  rollout: 100 },
  { key: 'ai_assistant',         label: 'AI Assistant',         description: 'Claude-powered pattern generation',           enabled: true,  rollout: 100 },
  { key: 'collaboration',        label: 'Live Collaboration',   description: 'Real-time multi-user editing',                enabled: true,  rollout: 80 },
  { key: 'creator_dashboard',    label: 'Creator Dashboard',    description: 'Revenue & analytics for creators',            enabled: true,  rollout: 100 },
  { key: 'local_ai',             label: 'Local AI Panel',       description: 'Offline BPM detection & analysis',           enabled: true,  rollout: 100 },
  { key: 'gpu_export',           label: 'GPU DSP Export',       description: 'GPU-accelerated export processing',           enabled: false, rollout: 0 },
  { key: 'stems_export',         label: 'Stems Export',         description: 'Per-track stem export',                      enabled: true,  rollout: 100 },
  { key: 'coupon_system',        label: 'Coupon System',        description: 'Discount codes at checkout',                 enabled: true,  rollout: 100 },
  { key: 'paypal',               label: 'PayPal Payments',      description: 'PayPal as a payment method',                 enabled: true,  rollout: 100 },
  { key: 'new_piano_roll',       label: 'New Piano Roll (beta)', description: 'Redesigned piano roll editor',               enabled: false, rollout: 10 },
]

const AUDIT: AuditEntry[] = [
  { id: 1, actor: 'admin@neurotek.ai',   action: 'Toggled feature flag',  target: 'gpu_export → disabled',               time: '2026-05-19 10:30' },
  { id: 2, actor: 'admin@neurotek.ai',   action: 'Updated rate limits',   target: 'Free plan: 10 → 15 req/day',          time: '2026-05-19 09:45' },
  { id: 3, actor: 'admin@neurotek.ai',   action: 'Changed setting',       target: 'maintenance_mode: false → true → false', time: '2026-05-18 22:00' },
  { id: 4, actor: 'mod@neurotek.ai',     action: 'Updated auto-mod rule', target: 'toxic_language: disabled',             time: '2026-05-18 15:30' },
  { id: 5, actor: 'admin@neurotek.ai',   action: 'Created coupon',        target: 'LAUNCH50 — 50% off Pro plan',         time: '2026-05-17 11:00' },
  { id: 6, actor: 'analyst@neurotek.ai', action: 'Exported report',       target: 'Revenue report May 2026',             time: '2026-05-16 16:00' },
  { id: 7, actor: 'admin@neurotek.ai',   action: 'Issued refund',         target: '$49.00 → Sam Patel (duplicate charge)', time: '2026-05-18 09:05' },
]

export default function Settings() {
  const [flags, setFlags] = useState(INITIAL_FLAGS)
  const [maintenance, setMaintenance] = useState(false)
  const [registrations, setRegistrations] = useState(true)
  const [maxUploadMB, setMaxUploadMB] = useState('500')
  const [supportEmail, setSupportEmail] = useState('support@neurotek.ai')
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'flags' | 'platform' | 'audit'>('flags')

  function toggleFlag(key: string) {
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f))
  }

  function saveSettings() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="admin-fade-in" style={{ padding: 28 }}>
      {/* Header */}
      <div className="admin-header" style={{ padding: 0, marginBottom: 24 }}>
        <div>
          <div className="admin-page-title">Settings</div>
          <div className="admin-page-sub">Feature flags, platform config & audit log</div>
        </div>
        {maintenance && (
          <div className="admin-badge badge-red" style={{ fontSize: 12, padding: '6px 14px' }}>
            ⚠ Maintenance Mode Active
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1a1a2e' }}>
        {(['flags', 'platform', 'audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'none', borderBottom: tab === t ? '2px solid #8b5cf6' : '2px solid transparent',
              color: tab === t ? '#8b5cf6' : '#475569', transition: 'all 0.15s', marginBottom: -1,
            }}>
            {t === 'flags' ? 'Feature Flags' : t === 'platform' ? 'Platform Config' : 'Audit Log'}
          </button>
        ))}
      </div>

      {/* Feature Flags */}
      {tab === 'flags' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="admin-card admin-card-glow">
            {flags.map((flag, i) => (
              <div key={flag.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px', borderBottom: i < flags.length - 1 ? '1px solid #1a1a2e' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{flag.label}</span>
                    <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>{flag.key}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{flag.description}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {flag.rollout < 100 && flag.rollout > 0 && (
                    <span className="admin-badge badge-orange" style={{ fontSize: 10 }}>
                      {flag.rollout}% rollout
                    </span>
                  )}
                  <button
                    onClick={() => toggleFlag(flag.key)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: flag.enabled ? '#8b5cf6' : '#1a1a2e',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9,
                      background: 'white', transition: 'left 0.2s',
                      left: flag.enabled ? 23 : 3,
                    }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform Config */}
      {tab === 'platform' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Critical toggles */}
          <div className="admin-card admin-card-glow">
            <div className="admin-card-body">
              <div className="admin-card-title">Platform Controls</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Maintenance Mode', desc: 'Blocks all user-facing traffic with a maintenance page', val: maintenance, set: setMaintenance, danger: true },
                  { label: 'New Registrations', desc: 'Allow new users to sign up', val: registrations, set: setRegistrations, danger: false },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: item.danger && item.val ? '#ef4444' : '#e2e8f0' }}>
                        {item.label}
                        {item.danger && item.val && <span className="admin-badge badge-red" style={{ fontSize: 10, marginLeft: 8 }}>Active</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{item.desc}</div>
                    </div>
                    <button
                      onClick={() => item.set(!item.val)}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: item.val ? (item.danger ? '#ef4444' : '#8b5cf6') : '#1a1a2e',
                        position: 'relative', transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9,
                        background: 'white', transition: 'left 0.2s', left: item.val ? 23 : 3,
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Config inputs */}
          <div className="admin-card admin-card-glow">
            <div className="admin-card-body">
              <div className="admin-card-title">Platform Settings</div>
              <div style={{ display: 'grid', gap: 16 }}>
                {[
                  { label: 'Support Email',        val: supportEmail, set: setSupportEmail, type: 'email' },
                  { label: 'Max Upload Size (MB)',  val: maxUploadMB,  set: setMaxUploadMB,  type: 'number' },
                ].map(field => (
                  <div key={field.label}>
                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>{field.label}</div>
                    <input
                      type={field.type}
                      value={field.val}
                      onChange={e => field.set(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                        background: '#0c0c18', border: '1px solid #1a1a2e', color: '#e2e8f0',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ))}
                <button
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  style={{ alignSelf: 'flex-end', width: 'auto' }}
                  onClick={saveSettings}
                >
                  {saved ? '✓ Saved' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log */}
      {tab === 'audit' && (
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body" style={{ paddingBottom: 0 }}>
            <div className="admin-card-title">Admin Audit Log</div>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Actor</th><th>Action</th><th>Target</th><th>Time</th></tr>
            </thead>
            <tbody>
              {AUDIT.map(entry => (
                <tr key={entry.id}>
                  <td style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600 }}>{entry.actor}</td>
                  <td style={{ fontSize: 13, color: '#94a3b8' }}>{entry.action}</td>
                  <td style={{ fontSize: 12, color: '#475569', maxWidth: 300 }}>{entry.target}</td>
                  <td style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>{entry.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
