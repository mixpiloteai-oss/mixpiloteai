import './admin.css'
import { useState, useMemo } from 'react'

type Plan = 'Free' | 'Pro' | 'Studio' | 'Label'
type UserStatus = 'active' | 'banned'

interface AdminUser {
  id: number
  name: string
  email: string
  initials: string
  avatarColor: string
  plan: Plan
  status: UserStatus
  projects: number
  aiRequests: number
  joined: string
  lastActive: string
  billing: string
  banReason?: string
}

const MOCK_USERS: AdminUser[] = [
  { id: 1, name: 'Alex Rivera', email: 'alex.rivera@email.com', initials: 'AR', avatarColor: '#8b5cf6', plan: 'Pro', status: 'active', projects: 12, aiRequests: 4820, joined: '2024-03-15', lastActive: '2026-05-18', billing: 'Monthly' },
  { id: 2, name: 'Jordan Lee', email: 'jordan.lee@email.com', initials: 'JL', avatarColor: '#22d3ee', plan: 'Studio', status: 'active', projects: 34, aiRequests: 18430, joined: '2023-11-02', lastActive: '2026-05-19', billing: 'Annual' },
  { id: 3, name: 'Morgan Chen', email: 'morgan.chen@music.io', initials: 'MC', avatarColor: '#10b981', plan: 'Free', status: 'active', projects: 3, aiRequests: 280, joined: '2026-04-10', lastActive: '2026-05-17', billing: 'Free' },
  { id: 4, name: 'Sam Patel', email: 'sam.patel@beatz.co', initials: 'SP', avatarColor: '#f59e0b', plan: 'Label', status: 'active', projects: 89, aiRequests: 52100, joined: '2023-06-20', lastActive: '2026-05-19', billing: 'Annual' },
  { id: 5, name: 'Casey Williams', email: 'casey.w@gmail.com', initials: 'CW', avatarColor: '#ef4444', plan: 'Free', status: 'banned', projects: 1, aiRequests: 50, joined: '2026-02-14', lastActive: '2026-03-01', billing: 'Free', banReason: 'Spam / abuse' },
  { id: 6, name: 'Taylor Kim', email: 'taylor.kim@studio.net', initials: 'TK', avatarColor: '#8b5cf6', plan: 'Studio', status: 'active', projects: 22, aiRequests: 9840, joined: '2024-07-08', lastActive: '2026-05-16', billing: 'Monthly' },
  { id: 7, name: 'Riley Johnson', email: 'riley.j@soundlab.fm', initials: 'RJ', avatarColor: '#22d3ee', plan: 'Pro', status: 'active', projects: 8, aiRequests: 3210, joined: '2025-01-19', lastActive: '2026-05-15', billing: 'Monthly' },
  { id: 8, name: 'Quinn Torres', email: 'quinn.torres@daw.io', initials: 'QT', avatarColor: '#10b981', plan: 'Free', status: 'active', projects: 5, aiRequests: 410, joined: '2026-05-01', lastActive: '2026-05-19', billing: 'Free' },
  { id: 9, name: 'Drew Martinez', email: 'drew.m@email.com', initials: 'DM', avatarColor: '#f59e0b', plan: 'Pro', status: 'active', projects: 14, aiRequests: 6200, joined: '2024-09-30', lastActive: '2026-05-18', billing: 'Annual' },
  { id: 10, name: 'Avery Brown', email: 'avery.brown@beats.com', initials: 'AB', avatarColor: '#8b5cf6', plan: 'Label', status: 'active', projects: 120, aiRequests: 89200, joined: '2023-03-12', lastActive: '2026-05-19', billing: 'Annual' },
  { id: 11, name: 'Parker Wilson', email: 'parker.wilson@mail.com', initials: 'PW', avatarColor: '#22d3ee', plan: 'Free', status: 'active', projects: 2, aiRequests: 90, joined: '2026-03-22', lastActive: '2026-04-30', billing: 'Free' },
  { id: 12, name: 'Reese Thompson', email: 'reese.t@music.io', initials: 'RT', avatarColor: '#ef4444', plan: 'Pro', status: 'banned', projects: 6, aiRequests: 2100, joined: '2024-12-05', lastActive: '2026-04-10', billing: 'Monthly', banReason: 'Copyright violation' },
  { id: 13, name: 'Blake Anderson', email: 'blake.a@soundcloud.io', initials: 'BA', avatarColor: '#10b981', plan: 'Studio', status: 'active', projects: 41, aiRequests: 21800, joined: '2023-08-17', lastActive: '2026-05-17', billing: 'Annual' },
  { id: 14, name: 'Jamie Garcia', email: 'jamie.garcia@email.com', initials: 'JG', avatarColor: '#f59e0b', plan: 'Free', status: 'active', projects: 1, aiRequests: 45, joined: '2026-05-15', lastActive: '2026-05-19', billing: 'Free' },
  { id: 15, name: 'Skyler Davis', email: 'skyler.davis@daw.net', initials: 'SD', avatarColor: '#8b5cf6', plan: 'Pro', status: 'active', projects: 18, aiRequests: 7340, joined: '2024-06-01', lastActive: '2026-05-14', billing: 'Monthly' },
  { id: 16, name: 'Harley White', email: 'harley.w@beats.fm', initials: 'HW', avatarColor: '#22d3ee', plan: 'Studio', status: 'active', projects: 29, aiRequests: 13400, joined: '2024-02-28', lastActive: '2026-05-18', billing: 'Annual' },
  { id: 17, name: 'Robin Scott', email: 'robin.scott@email.com', initials: 'RS', avatarColor: '#ef4444', plan: 'Free', status: 'banned', projects: 0, aiRequests: 0, joined: '2026-04-01', lastActive: '2026-04-02', billing: 'Free', banReason: 'Fraudulent account' },
  { id: 18, name: 'Cameron Hall', email: 'cam.hall@music.co', initials: 'CH', avatarColor: '#10b981', plan: 'Label', status: 'active', projects: 200, aiRequests: 140200, joined: '2022-12-10', lastActive: '2026-05-19', billing: 'Annual' },
  { id: 19, name: 'Finley Adams', email: 'finley.adams@studio.io', initials: 'FA', avatarColor: '#f59e0b', plan: 'Pro', status: 'active', projects: 10, aiRequests: 4010, joined: '2025-07-14', lastActive: '2026-05-13', billing: 'Monthly' },
  { id: 20, name: 'Emery Nelson', email: 'emery.nelson@daw.io', initials: 'EN', avatarColor: '#8b5cf6', plan: 'Free', status: 'active', projects: 4, aiRequests: 320, joined: '2026-05-19', lastActive: '2026-05-19', billing: 'Free' },
]

const PLAN_COLORS: Record<Plan, string> = {
  Free: 'badge-grey',
  Pro: 'badge-purple',
  Studio: 'badge-cyan',
  Label: 'badge-orange',
}

interface BanModal {
  user: AdminUser
}

interface DrawerUser {
  user: AdminUser
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>(MOCK_USERS)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortBy, setSortBy] = useState('Newest')
  const [banModal, setBanModal] = useState<BanModal | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState('Permanent')
  const [drawer, setDrawer] = useState<DrawerUser | null>(null)

  const filtered = useMemo(() => {
    let list = [...users]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    if (planFilter !== 'All') list = list.filter(u => u.plan === planFilter)
    if (statusFilter !== 'All') list = list.filter(u => u.status === (statusFilter === 'Banned' ? 'banned' : 'active'))
    if (sortBy === 'Newest') list.sort((a, b) => b.joined.localeCompare(a.joined))
    else if (sortBy === 'Oldest') list.sort((a, b) => a.joined.localeCompare(b.joined))
    else if (sortBy === 'Most Active') list.sort((a, b) => b.aiRequests - a.aiRequests)
    return list
  }, [users, search, planFilter, statusFilter, sortBy])

  const handleConfirmBan = () => {
    if (!banModal) return
    setUsers(prev => prev.map(u => u.id === banModal.user.id ? { ...u, status: 'banned', banReason } : u))
    setBanModal(null)
    setBanReason('')
  }

  const handleUnban = (id: number) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active', banReason: undefined } : u))
  }

  const handleDelete = (id: number) => {
    setUsers(prev => prev.filter(u => u.id !== id))
    if (drawer?.user.id === id) setDrawer(null)
  }

  const totalUsers = users.length
  void users.filter(u => u.status === 'active').length
  const bannedUsers = users.filter(u => u.status === 'banned').length
  const newToday = users.filter(u => u.joined === '2026-05-19').length

  const sparkBars = [40, 55, 48, 62, 70, 58, 80, 75, 90, 85, 95, 88]

  return (
    <div className="admin-fade-in" style={{ padding: '24px', maxWidth: '100%' }}>
      <div className="admin-header">
        <div>
          <h1 className="admin-page-title">User Management</h1>
          <p className="admin-page-sub">{totalUsers.toLocaleString()} total users</p>
        </div>
      </div>

      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-value">8,432</div>
          <div className="admin-stat-label">Total Users</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">4,891</div>
          <div className="admin-stat-label">Active (30d)</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-red)' }}>{bannedUsers}</div>
          <div className="admin-stat-label">Banned</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--admin-green)' }}>{newToday}</div>
          <div className="admin-stat-label">New Today</div>
        </div>
      </div>

      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <input
          className="admin-search"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="admin-select" value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
          <option>All</option>
          <option>Free</option>
          <option>Pro</option>
          <option>Studio</option>
          <option>Label</option>
        </select>
        <select className="admin-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option>Active</option>
          <option>Banned</option>
        </select>
        <select className="admin-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option>Newest</option>
          <option>Oldest</option>
          <option>Most Active</option>
        </select>
      </div>

      <div className="admin-card">
        <div className="admin-card-body">
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
                {filtered.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: user.avatarColor, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0
                        }}>{user.initials}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--admin-muted)' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`admin-badge ${PLAN_COLORS[user.plan]}`}>{user.plan}</span></td>
                    <td>
                      <span className={`status-dot ${user.status === 'active' ? 'dot-green' : 'dot-red'}`} />
                      <span style={{ fontSize: 12, marginLeft: 6 }}>{user.status === 'active' ? 'Active' : 'Banned'}</span>
                    </td>
                    <td style={{ fontSize: 13 }}>{user.projects}</td>
                    <td style={{ fontSize: 13 }}>{user.aiRequests.toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{user.joined}</td>
                    <td style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{user.lastActive}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setDrawer({ user })}>View</button>
                        {user.status === 'active'
                          ? <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => { setBanModal({ user }); setBanReason('') }}>Ban</button>
                          : <button className="admin-btn admin-btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--admin-green)', border: '1px solid rgba(16,185,129,0.3)' }} onClick={() => handleUnban(user.id)}>Unban</button>
                        }
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(user.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ban Modal */}
      {banModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="admin-card" style={{ width: 420, padding: 0 }}>
            <div className="admin-card-body">
              <h3 className="admin-card-title" style={{ color: 'var(--admin-red)' }}>Ban User</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: banModal.user.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{banModal.user.initials}</div>
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
                <button className="admin-btn admin-btn-danger" onClick={handleConfirmBan}>Confirm Ban</button>
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
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: drawer.user.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>{drawer.user.initials}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{drawer.user.name}</div>
                <div style={{ fontSize: 13, color: 'var(--admin-muted)' }}>{drawer.user.email}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                ['Plan', <span key="plan" className={`admin-badge ${PLAN_COLORS[drawer.user.plan]}`}>{drawer.user.plan}</span>],
                ['Billing', drawer.user.billing],
                ['Projects', drawer.user.projects],
                ['AI Requests', drawer.user.aiRequests.toLocaleString()],
                ['Joined', drawer.user.joined],
                ['Last Active', drawer.user.lastActive],
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
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 8 }}>Recent Activity</div>
              {['Uploaded "Night Beat.mp3"', 'Generated 40 AI stems', 'Published project "Lo-Fi Session"', 'Upgraded plan to Pro', 'Created new project'].map((act, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}>
                  <span style={{ color: 'var(--admin-muted)', marginRight: 8 }}>•</span>{act}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 8 }}>Payment History</div>
              {[
                { date: '2026-05-01', amount: '$19.00', desc: 'Pro Monthly' },
                { date: '2026-04-01', amount: '$19.00', desc: 'Pro Monthly' },
                { date: '2026-03-01', amount: '$19.00', desc: 'Pro Monthly' },
              ].map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--admin-border)' }}>
                  <span style={{ color: 'var(--admin-muted)' }}>{p.date}</span>
                  <span>{p.desc}</span>
                  <span style={{ color: 'var(--admin-green)', fontWeight: 600 }}>{p.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
