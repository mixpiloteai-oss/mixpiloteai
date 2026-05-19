import './admin.css'
import { useState, useEffect, useRef } from 'react'
import { adminApi, type AdminUser } from './services/adminApi'

const PLAN_COLORS: Record<string, string> = {
  free:   'badge-grey',
  pro:    'badge-purple',
  studio: 'badge-cyan',
  label:  'badge-orange',
  Free:   'badge-grey',
  Pro:    'badge-purple',
  Studio: 'badge-cyan',
  Label:  'badge-orange',
}

function getInitials(name: string) {
  return name.split(' ').map(s => s[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

const AVATAR_COLORS = ['#8b5cf6', '#22d3ee', '#10b981', '#f59e0b', '#ef4444']
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

interface BanModal { user: AdminUser }
interface DrawerUser { user: AdminUser }

const sparkBars = [40, 55, 48, 62, 70, 58, 80, 75, 90, 85, 95, 88]

export default function Users() {
  const [users, setUsers]           = useState<AdminUser[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [banModal, setBanModal]     = useState<BanModal | null>(null)
  const [banReason, setBanReason]   = useState('')
  const [banDuration, setBanDuration] = useState('Permanent')
  const [drawer, setDrawer]         = useState<DrawerUser | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const searchRef = useRef(search)
  searchRef.current = search

  async function loadUsers(pg = page, srch = search, plan = planFilter) {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.users({
        page: pg,
        limit: 20,
        search: srch || undefined,
        plan: plan !== 'all' ? plan : undefined,
      })
      setUsers(res.data.users)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  // Load when page or planFilter changes
  useEffect(() => {
    loadUsers(page, search, planFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, planFilter])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      loadUsers(1, search, planFilter)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function handleConfirmBan() {
    if (!banModal) return
    setActionLoading(true)
    try {
      await adminApi.banUser(banModal.user.id, banReason)
      setBanModal(null)
      setBanReason('')
      await loadUsers(page, search, planFilter)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ban failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnban(id: string) {
    setActionLoading(true)
    try {
      await adminApi.unbanUser(id)
      await loadUsers(page, search, planFilter)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unban failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user permanently?')) return
    setActionLoading(true)
    try {
      await adminApi.deleteUser(id)
      if (drawer?.user.id === id) setDrawer(null)
      await loadUsers(page, search, planFilter)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setActionLoading(false)
    }
  }

  const pageStart = (page - 1) * 20 + 1
  const pageEnd   = Math.min(page * 20, total)

  return (
    <div className="admin-fade-in" style={{ padding: '24px', maxWidth: '100%' }}>
      <div className="admin-header">
        <div>
          <h1 className="admin-page-title">User Management</h1>
          <p className="admin-page-sub">{total.toLocaleString()} total users</p>
        </div>
      </div>

      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <input
          className="admin-search"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="admin-select" value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }}>
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="studio">Studio</option>
          <option value="label">Label</option>
        </select>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-body">
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>Loading users…</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Projects</th>
                    <th>AI Requests</th>
                    <th>Joined</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: avatarColor(user.id), display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0
                          }}>{getInitials(user.name)}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`admin-badge ${PLAN_COLORS[user.plan] ?? 'badge-grey'}`}>{user.plan}</span></td>
                      <td>
                        <span className={`status-dot ${user.status === 'active' ? 'dot-green' : 'dot-red'}`} />
                        <span style={{ fontSize: 12, marginLeft: 6 }}>{user.status === 'active' ? 'Active' : 'Banned'}</span>
                      </td>
                      <td style={{ fontSize: 13 }}>{user.projects ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{user.aiRequests?.toLocaleString() ?? '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{user.createdAt?.slice(0, 10) ?? '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{user.lastActive?.slice(0, 10) ?? '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setDrawer({ user })} disabled={actionLoading}>View</button>
                          {user.status === 'active'
                            ? <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={actionLoading} onClick={() => { setBanModal({ user }); setBanReason('') }}>Ban</button>
                            : <button className="admin-btn admin-btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--admin-green)', border: '1px solid rgba(16,185,129,0.3)' }} disabled={actionLoading} onClick={() => handleUnban(user.id)}>Unban</button>
                          }
                          <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={actionLoading} onClick={() => handleDelete(user.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: '#334155' }}>No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #1a1a2e' }}>
              <span style={{ fontSize: 12, color: '#475569' }}>
                Showing {pageStart}–{pageEnd} of {total.toLocaleString()}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >← Prev</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pg = Math.max(1, page - 2) + i
                  if (pg > totalPages) return null
                  return (
                    <button
                      key={pg}
                      className={`admin-btn admin-btn-sm ${pg === page ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                      onClick={() => setPage(pg)}
                    >{pg}</button>
                  )
                })}
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ban Modal */}
      {banModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="admin-card" style={{ width: 420, padding: 0 }}>
            <div className="admin-card-body">
              <h3 className="admin-card-title" style={{ color: 'var(--admin-red)' }}>Ban User</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(banModal.user.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{getInitials(banModal.user.name)}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{banModal.user.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{banModal.user.email}</div>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--admin-muted)', display: 'block', marginBottom: 6 }}>Reason</label>
                <input className="admin-search" style={{ width: '100%' }} placeholder="Enter ban reason..." value={banReason} onChange={e => setBanReason(e.target.value)} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: 'var(--admin-muted)', display: 'block', marginBottom: 6 }}>Duration</label>
                <select className="admin-select" style={{ width: '100%' }} value={banDuration} onChange={e => setBanDuration(e.target.value)}>
                  <option>1 day</option>
                  <option>7 days</option>
                  <option>30 days</option>
                  <option>Permanent</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setBanModal(null)}>Cancel</button>
                <button className="admin-btn admin-btn-danger" disabled={actionLoading} onClick={handleConfirmBan}>
                  {actionLoading ? 'Banning…' : 'Confirm Ban'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Drawer */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', zIndex: 999 }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} onClick={() => setDrawer(null)} />
          <div style={{ width: 420, background: 'var(--admin-surface)', borderLeft: '1px solid var(--admin-border)', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>User Details</h3>
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setDrawer(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarColor(drawer.user.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>{getInitials(drawer.user.name)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{drawer.user.name}</div>
                <div style={{ fontSize: 13, color: 'var(--admin-muted)' }}>{drawer.user.email}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                ['Plan', <span key="plan" className={`admin-badge ${PLAN_COLORS[drawer.user.plan] ?? 'badge-grey'}`}>{drawer.user.plan}</span>],
                ['Status', drawer.user.status],
                ['Projects', drawer.user.projects ?? '—'],
                ['AI Requests', drawer.user.aiRequests?.toLocaleString() ?? '—'],
                ['Joined', drawer.user.createdAt?.slice(0, 10) ?? '—'],
                ['Last Active', drawer.user.lastActive?.slice(0, 10) ?? '—'],
              ].map(([label, value], i) => (
                <div key={i} style={{ background: 'var(--admin-card)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--admin-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--admin-muted)', marginBottom: 4 }}>{label as string}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 8 }}>AI Usage (last 12 months)</div>
              <div className="sparkline">
                {sparkBars.map((h, i) => (
                  <div key={i} className="sparkline-bar" style={{ height: `${h}%`, background: 'var(--admin-purple)' }} />
                ))}
              </div>
            </div>
            {drawer.user.banReason && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 4 }}>Ban Reason</div>
                <div style={{ fontSize: 13 }}>{drawer.user.banReason}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
