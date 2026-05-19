import './admin.css'
import { useState } from 'react'

interface BanEntry {
  id: number
  userId: string
  name: string
  email: string
  reason: string
  bannedAt: string
  bannedBy: string
  permanent: boolean
  expiresAt?: string
}

interface BlockedIP {
  ip: string
  reason: string
  requests: number
  blockedAt: string
  country: string
}

interface AdminRole {
  id: number
  email: string
  role: 'super_admin' | 'admin' | 'moderator' | 'viewer'
  addedAt: string
  lastLogin: string
}

interface SecurityEvent {
  id: number
  type: 'ban' | 'unban' | 'ip_block' | 'login' | 'suspicious' | 'role_change'
  description: string
  actor: string
  time: string
  severity: 'low' | 'medium' | 'high'
}

const BANS: BanEntry[] = [
  { id: 1, userId: 'u-001', name: 'Casey Williams',  email: 'casey.w@gmail.com',      reason: 'Spam / abuse',          bannedAt: '2026-03-01', bannedBy: 'admin@neurotek.ai', permanent: false, expiresAt: '2026-06-01' },
  { id: 2, userId: 'u-012', name: 'Reese Thompson',  email: 'reese.t@music.io',       reason: 'Copyright violation',   bannedAt: '2026-04-10', bannedBy: 'admin@neurotek.ai', permanent: true },
  { id: 3, userId: 'u-017', name: 'Robin Scott',     email: 'robin.scott@email.com',  reason: 'Fraudulent account',    bannedAt: '2026-04-02', bannedBy: 'mod@neurotek.ai',   permanent: true },
  { id: 4, userId: 'u-028', name: 'Devon Blake',     email: 'devon.blake@spam.io',    reason: 'Mass spam upload',      bannedAt: '2026-05-10', bannedBy: 'admin@neurotek.ai', permanent: false, expiresAt: '2026-07-10' },
  { id: 5, userId: 'u-041', name: 'Harley Turner',   email: 'harley.t@fake.com',      reason: 'Payment fraud attempt', bannedAt: '2026-05-15', bannedBy: 'system',            permanent: true },
]

const BLOCKED_IPS: BlockedIP[] = [
  { ip: '185.220.101.42', reason: 'Brute force login',     requests: 4820, blockedAt: '2026-05-18 14:32', country: 'RU' },
  { ip: '103.21.244.10',  reason: 'Credential stuffing',   requests: 2140, blockedAt: '2026-05-17 09:11', country: 'CN' },
  { ip: '46.161.27.188',  reason: 'API rate limit abuse',  requests: 9300, blockedAt: '2026-05-16 22:47', country: 'KP' },
  { ip: '77.88.55.60',    reason: 'Scraping bot',          requests: 1560, blockedAt: '2026-05-14 08:30', country: 'DE' },
  { ip: '192.168.100.5',  reason: 'Repeated fraud signals',requests: 320,  blockedAt: '2026-05-12 17:00', country: 'US' },
]

const ROLES: AdminRole[] = [
  { id: 1, email: 'admin@neurotek.ai',   role: 'super_admin', addedAt: '2023-01-01', lastLogin: '2026-05-19 10:42' },
  { id: 2, email: 'mod@neurotek.ai',     role: 'moderator',   addedAt: '2024-03-15', lastLogin: '2026-05-18 16:20' },
  { id: 3, email: 'analyst@neurotek.ai', role: 'viewer',      addedAt: '2024-09-01', lastLogin: '2026-05-17 11:05' },
  { id: 4, email: 'support@neurotek.ai', role: 'admin',       addedAt: '2025-02-10', lastLogin: '2026-05-19 09:15' },
]

const EVENTS: SecurityEvent[] = [
  { id: 1,  type: 'ban',         description: 'User devon.blake@spam.io banned for mass spam upload',        actor: 'admin@neurotek.ai', time: '2026-05-10 11:30', severity: 'high' },
  { id: 2,  type: 'ip_block',    description: 'IP 185.220.101.42 blocked — brute force detected (4820 req)', actor: 'system',            time: '2026-05-18 14:32', severity: 'high' },
  { id: 3,  type: 'login',       description: 'Admin login: admin@neurotek.ai from 82.45.120.11',            actor: 'admin@neurotek.ai', time: '2026-05-19 10:42', severity: 'low' },
  { id: 4,  type: 'suspicious',  description: 'Unusual payment pattern: 18 transactions in 4 min from u-028',actor: 'system',            time: '2026-05-15 08:22', severity: 'high' },
  { id: 5,  type: 'role_change', description: 'Role changed: support@neurotek.ai → admin',                  actor: 'admin@neurotek.ai', time: '2026-05-19 09:00', severity: 'medium' },
  { id: 6,  type: 'unban',       description: 'User u-099 unbanned by admin (false positive)',               actor: 'admin@neurotek.ai', time: '2026-05-16 14:00', severity: 'low' },
  { id: 7,  type: 'ip_block',    description: 'IP 103.21.244.10 blocked — credential stuffing',             actor: 'system',            time: '2026-05-17 09:11', severity: 'high' },
  { id: 8,  type: 'ban',         description: 'User harley.t@fake.com banned for payment fraud',            actor: 'system',            time: '2026-05-15 13:44', severity: 'high' },
]

const ROLE_COLORS: Record<AdminRole['role'], string> = {
  super_admin: 'badge-purple',
  admin:       'badge-cyan',
  moderator:   'badge-orange',
  viewer:      'badge-grey',
}

const SEV_COLORS: Record<SecurityEvent['severity'], string> = {
  high:   'badge-red',
  medium: 'badge-orange',
  low:    'badge-grey',
}

const EVT_ICONS: Record<SecurityEvent['type'], string> = {
  ban:         '⊘',
  unban:       '◉',
  ip_block:    '⊗',
  login:       '◎',
  suspicious:  '⚠',
  role_change: '⚿',
}

export default function Security() {
  const [tab, setTab] = useState<'bans' | 'ips' | 'roles' | 'timeline'>('bans')
  const [unbanTarget, setUnbanTarget] = useState<BanEntry | null>(null)
  const [newRoleEmail, setNewRoleEmail] = useState('')
  const [newRoleLevel, setNewRoleLevel] = useState<AdminRole['role']>('viewer')

  return (
    <div className="admin-fade-in" style={{ padding: 28 }}>
      {/* Header */}
      <div className="admin-header" style={{ padding: 0, marginBottom: 24 }}>
        <div>
          <div className="admin-page-title">Security</div>
          <div className="admin-page-sub">Bans, blocked IPs, admin roles & audit timeline</div>
        </div>
        <div className="admin-header-actions">
          <div className="admin-badge badge-red" style={{ fontSize: 12, padding: '6px 14px' }}>
            {BANS.length} Active Bans
          </div>
          <div className="admin-badge badge-orange" style={{ fontSize: 12, padding: '6px 14px' }}>
            {BLOCKED_IPS.length} Blocked IPs
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1a1a2e', paddingBottom: 0 }}>
        {(['bans', 'ips', 'roles', 'timeline'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'none', borderBottom: tab === t ? '2px solid #8b5cf6' : '2px solid transparent',
              color: tab === t ? '#8b5cf6' : '#475569', transition: 'all 0.15s', marginBottom: -1,
            }}>
            {t === 'bans' ? 'Bans' : t === 'ips' ? 'Blocked IPs' : t === 'roles' ? 'Admin Roles' : 'Audit Timeline'}
          </button>
        ))}
      </div>

      {/* Bans */}
      {tab === 'bans' && (
        <div className="admin-table-wrap" style={{ padding: 0 }}>
          <div className="admin-card admin-card-glow">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th><th>Reason</th><th>Banned At</th><th>By</th><th>Expires</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {BANS.map(ban => (
                  <tr key={ban.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{ban.name}</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>{ban.email}</div>
                    </td>
                    <td><span className="admin-badge badge-red">{ban.reason}</span></td>
                    <td style={{ fontSize: 12 }}>{ban.bannedAt}</td>
                    <td style={{ fontSize: 11, color: '#475569' }}>{ban.bannedBy}</td>
                    <td>
                      {ban.permanent
                        ? <span className="admin-badge badge-red">Permanent</span>
                        : <span className="admin-badge badge-orange">{ban.expiresAt}</span>}
                    </td>
                    <td>
                      <button className="admin-btn admin-btn-ghost admin-btn-sm"
                        onClick={() => setUnbanTarget(ban)}>
                        Unban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blocked IPs */}
      {tab === 'ips' && (
        <div className="admin-card admin-card-glow">
          <table className="admin-table">
            <thead>
              <tr><th>IP Address</th><th>Country</th><th>Reason</th><th>Requests</th><th>Blocked At</th><th>Action</th></tr>
            </thead>
            <tbody>
              {BLOCKED_IPS.map(ip => (
                <tr key={ip.ip}>
                  <td style={{ fontFamily: 'monospace', color: '#22d3ee' }}>{ip.ip}</td>
                  <td><span className="admin-badge badge-grey">{ip.country}</span></td>
                  <td style={{ color: '#94a3b8', fontSize: 13 }}>{ip.reason}</td>
                  <td style={{ fontFamily: 'monospace', color: '#ef4444', fontWeight: 700 }}>
                    {ip.requests.toLocaleString()}
                  </td>
                  <td style={{ fontSize: 12, color: '#475569' }}>{ip.blockedAt}</td>
                  <td>
                    <button className="admin-btn admin-btn-ghost admin-btn-sm">Unblock</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin Roles */}
      {tab === 'roles' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="admin-card admin-card-glow">
            <div className="admin-card-body" style={{ paddingBottom: 0 }}>
              <div className="admin-card-title">Admin Team</div>
            </div>
            <table className="admin-table">
              <thead>
                <tr><th>Email</th><th>Role</th><th>Added</th><th>Last Login</th><th>Action</th></tr>
              </thead>
              <tbody>
                {ROLES.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: '#e2e8f0', fontWeight: 500 }}>{r.email}</td>
                    <td><span className={`admin-badge ${ROLE_COLORS[r.role]}`}>{r.role}</span></td>
                    <td style={{ fontSize: 12, color: '#475569' }}>{r.addedAt}</td>
                    <td style={{ fontSize: 12, color: '#475569' }}>{r.lastLogin}</td>
                    <td>
                      {r.role !== 'super_admin' && (
                        <button className="admin-btn admin-btn-ghost admin-btn-sm">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-card admin-card-glow">
            <div className="admin-card-body">
              <div className="admin-card-title">Add Admin</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input
                  placeholder="email@neurotek.ai"
                  value={newRoleEmail}
                  onChange={e => setNewRoleEmail(e.target.value)}
                  style={{
                    flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    background: '#0c0c18', border: '1px solid #1a1a2e', color: '#e2e8f0', outline: 'none',
                  }}
                />
                <select
                  value={newRoleLevel}
                  onChange={e => setNewRoleLevel(e.target.value as AdminRole['role'])}
                  style={{
                    padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    background: '#0c0c18', border: '1px solid #1a1a2e', color: '#e2e8f0', outline: 'none',
                  }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={() => { setNewRoleEmail(''); }}>
                  Add Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Timeline */}
      {tab === 'timeline' && (
        <div className="admin-card admin-card-glow">
          <div className="admin-card-body">
            <div className="admin-card-title">Security Timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {EVENTS.map((evt, i) => (
                <div key={evt.id} style={{
                  display: 'flex', gap: 16, paddingBottom: 16,
                  borderBottom: i < EVENTS.length - 1 ? '1px solid #1a1a2e' : 'none',
                  paddingTop: i > 0 ? 16 : 0,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                    background: evt.severity === 'high' ? 'rgba(239,68,68,0.12)' : evt.severity === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
                    color: evt.severity === 'high' ? '#ef4444' : evt.severity === 'medium' ? '#f59e0b' : '#64748b',
                  }}>
                    {EVT_ICONS[evt.type]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>{evt.description}</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#475569' }}>{evt.actor}</span>
                      <span style={{ fontSize: 11, color: '#334155' }}>·</span>
                      <span style={{ fontSize: 11, color: '#334155' }}>{evt.time}</span>
                      <span className={`admin-badge ${SEV_COLORS[evt.severity]}`} style={{ fontSize: 10 }}>
                        {evt.severity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unban Modal */}
      {unbanTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="admin-card" style={{ width: 400, padding: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
              Unban {unbanTarget.name}?
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 24 }}>
              This will restore full access for <strong style={{ color: '#e2e8f0' }}>{unbanTarget.email}</strong>.
              Ban reason: <em>{unbanTarget.reason}</em>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setUnbanTarget(null)}>
                Cancel
              </button>
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setUnbanTarget(null)}>
                Confirm Unban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
