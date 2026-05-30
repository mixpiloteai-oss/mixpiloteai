import './admin.css'
import { useState, useEffect } from 'react'
import { adminApi, type BanEntry, type AuditLog } from './services/adminApi'

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

// Static data for IPs and roles (no backend endpoint yet)
const BLOCKED_IPS: BlockedIP[] = [
  { ip: '185.220.101.42', reason: 'Brute force login',      requests: 4820, blockedAt: '2026-05-18 14:32', country: 'RU' },
  { ip: '103.21.244.10',  reason: 'Credential stuffing',    requests: 2140, blockedAt: '2026-05-17 09:11', country: 'CN' },
  { ip: '46.161.27.188',  reason: 'API rate limit abuse',   requests: 9300, blockedAt: '2026-05-16 22:47', country: 'KP' },
  { ip: '77.88.55.60',    reason: 'Scraping bot',           requests: 1560, blockedAt: '2026-05-14 08:30', country: 'DE' },
  { ip: '192.168.100.5',  reason: 'Repeated fraud signals', requests: 320,  blockedAt: '2026-05-12 17:00', country: 'US' },
]

const ROLES: AdminRole[] = [
  { id: 1, email: 'admin@neurotek.ai',   role: 'super_admin', addedAt: '2023-01-01', lastLogin: '2026-05-19 10:42' },
  { id: 2, email: 'mod@neurotek.ai',     role: 'moderator',   addedAt: '2024-03-15', lastLogin: '2026-05-18 16:20' },
  { id: 3, email: 'analyst@neurotek.ai', role: 'viewer',      addedAt: '2024-09-01', lastLogin: '2026-05-17 11:05' },
  { id: 4, email: 'support@neurotek.ai', role: 'admin',       addedAt: '2025-02-10', lastLogin: '2026-05-19 09:15' },
]

const ROLE_COLORS: Record<AdminRole['role'], string> = {
  super_admin: 'badge-purple',
  admin:       'badge-cyan',
  moderator:   'badge-orange',
  viewer:      'badge-grey',
}


export default function Security() {
  const [tab, setTab] = useState<'bans' | 'ips' | 'roles' | 'timeline'>('bans')

  const [bans, setBans]           = useState<BanEntry[]>([])
  const [events, setEvents]       = useState<AuditLog[]>([])
  const [loadingBans, setLoadingBans]     = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)

  const [unbanTarget, setUnbanTarget]   = useState<BanEntry | null>(null)
  const [newRoleEmail, setNewRoleEmail] = useState('')
  const [newRoleLevel, setNewRoleLevel] = useState<AdminRole['role']>('viewer')

  useEffect(() => {
    adminApi.bans()
      .then(res => setBans(res.data))
      .catch(() => { /* keep empty */ })
      .finally(() => setLoadingBans(false))

    adminApi.auditLogs()
      .then(res => setEvents(res.data))
      .catch(() => { /* keep empty */ })
      .finally(() => setLoadingEvents(false))
  }, [])

  async function handleUnban() {
    if (!unbanTarget) return
    try {
      await adminApi.unbanUser(unbanTarget.userId)
      setBans(prev => prev.filter(b => b.id !== unbanTarget.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unban failed')
    } finally {
      setUnbanTarget(null)
    }
  }

  return (
    <div className="admin-fade-in" style={{ padding: 28 }}>
      {/* Header */}
      <div className="admin-header" style={{ padding: 0, marginBottom: 24 }}>
        <div>
          <div className="admin-page-title">Security</div>
          <div className="admin-page-sub">Bans, blocked IPs, admin roles &amp; audit timeline</div>
        </div>
        <div className="admin-header-actions">
          <div className="admin-badge badge-red" style={{ fontSize: 12, padding: '6px 14px' }}>
            {bans.length} Active Bans
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
          {loadingBans ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>Loading bans…</div>
          ) : (
            <div className="admin-card admin-card-glow">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th><th>Reason</th><th>Banned At</th><th>Expires</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bans.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: '#334155' }}>No active bans</td>
                    </tr>
                  ) : bans.map(ban => (
                    <tr key={ban.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{ban.name}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{ban.email}</div>
                      </td>
                      <td><span className="admin-badge badge-red">{ban.reason}</span></td>
                      <td style={{ fontSize: 12 }}>{ban.bannedAt}</td>
                      <td>
                        {ban.permanent
                          ? <span className="admin-badge badge-red">Permanent</span>
                          : <span className="admin-badge badge-orange">Temporary</span>}
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
          )}
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
                  onClick={() => { setNewRoleEmail('') }}>
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
            <div className="admin-card-title">Audit Timeline</div>
            {loadingEvents ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>Loading events…</div>
            ) : events.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>No audit events found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {events.map((evt, i) => (
                  <div key={evt.id} style={{
                    display: 'flex', gap: 16, paddingBottom: 16,
                    borderBottom: i < events.length - 1 ? '1px solid #1a1a2e' : 'none',
                    paddingTop: i > 0 ? 16 : 0,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                      background: 'rgba(100,116,139,0.12)',
                      color: '#64748b',
                    }}>
                      ⚿
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                        {evt.action} — {evt.target}
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#475569' }}>{evt.actor}</span>
                        <span style={{ fontSize: 11, color: '#334155' }}>·</span>
                        <span style={{ fontSize: 11, color: '#334155' }}>{evt.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleUnban}>
                Confirm Unban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
