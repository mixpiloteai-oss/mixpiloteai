import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import './admin.css'
import { adminLogin, adminLogout, isAdminAuthed } from './services/adminApi'

const AdminDashboard   = lazy(() => import('./AdminDashboard'))
const CMS              = lazy(() => import('./CMS'))
const Monitoring       = lazy(() => import('./Monitoring'))
const Analytics        = lazy(() => import('./Analytics'))
const Security         = lazy(() => import('./Security'))
const Users            = lazy(() => import('./Users'))
const Subscriptions    = lazy(() => import('./Subscriptions'))
const MarketplaceAdmin = lazy(() => import('./MarketplaceAdmin'))
const Payments         = lazy(() => import('./Payments'))
const Moderation       = lazy(() => import('./Moderation'))
const AIManagement     = lazy(() => import('./AIManagement'))
const Support          = lazy(() => import('./Support'))
const Storage          = lazy(() => import('./Storage'))
const Settings         = lazy(() => import('./Settings'))

// ── Auth Gate ──────────────────────────────────────────────────────────────────

function AuthGate({ onAuth }: { onAuth: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await adminLogin(email, password)
      const userEmail = result.user?.email ?? email
      localStorage.setItem('admin-user-email', userEmail)
      onAuth(userEmail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-auth-gate">
      <form className="admin-auth-box" onSubmit={handleSubmit}>
        <div className="admin-auth-logo">N</div>
        <div className="admin-auth-title">Admin Access</div>
        <div className="admin-auth-sub">Sign in to access the NeuroTek control panel</div>
        {error && <div className="admin-auth-error">{error}</div>}
        <input
          className="admin-auth-input"
          type="email"
          placeholder="admin@neurotek.ai"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          autoFocus
        />
        <input
          className="admin-auth-input"
          type="password"
          placeholder="Password / admin key"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          style={{ marginTop: 8 }}
        />
        <button type="submit" className="admin-auth-btn" disabled={loading}>
          {loading ? 'Signing in…' : 'Access Admin Panel'}
        </button>
        <div className="admin-auth-hint">
          Access restricted to authorized administrators.
        </div>
      </form>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface NavItemProps {
  to: string
  icon: string
  label: string
  badge?: number
  end?: boolean
}

function SidebarItem({ to, icon, label, badge, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}
    >
      <span className="admin-nav-icon">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="admin-nav-badge">{badge}</span>
      )}
    </NavLink>
  )
}

// ── Main Shell ─────────────────────────────────────────────────────────────────

export default function AdminShell() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(isAdminAuthed)
  const [userEmail, setUserEmail] = useState(
    () => localStorage.getItem('admin-user-email') ?? 'admin@neurotek.ai'
  )

  // Re-check auth on mount and when localStorage changes (other tabs logging out)
  useEffect(() => {
    const recheck = () => {
      if (!isAdminAuthed()) {
        setAuthed(false)
        navigate('/login')
      }
    }
    recheck()
    window.addEventListener('storage', recheck)
    return () => window.removeEventListener('storage', recheck)
  }, [navigate])

  // Clickjacking defense: refuse to render inside an iframe
  const isFramed = typeof window !== 'undefined' && window.self !== window.top
  if (isFramed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#fff', color: '#0f172a',
        fontFamily: 'system-ui, sans-serif', fontSize: 14, padding: 24, textAlign: 'center',
      }}>
        This panel cannot be embedded.
      </div>
    )
  }

  if (!authed) {
    return (
      <AuthGate
        onAuth={(email) => {
          setUserEmail(email)
          setAuthed(true)
        }}
      />
    )
  }

  async function handleLogout() {
    await adminLogout()
    localStorage.removeItem('admin-user-email')
    setAuthed(false)
    navigate('/admin')
  }

  const initials = userEmail
    .split('@')[0]
    .split(/[._-]/)
    .map(s => s[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('') || 'SA'

  return (
    <div className="admin-shell">
      {/* ── Sidebar ── */}
      <nav className="admin-sidebar">
        {/* Logo */}
        <div className="admin-logo">
          <div className="admin-logo-badge">N</div>
          <div>
            <div className="admin-logo-text">NeuroTek AI</div>
            <div className="admin-logo-sub">Admin Panel</div>
          </div>
        </div>

        {/* OVERVIEW */}
        <div className="admin-nav-group">
          <div className="admin-nav-group-label">Overview</div>
          <SidebarItem to="/admin"          icon="⬡" label="Dashboard"  end />
          <SidebarItem to="/admin/monitoring" icon="◈" label="Monitoring" />
          <SidebarItem to="/admin/analytics"  icon="∿" label="Analytics"  />
        </div>

        {/* MANAGEMENT */}
        <div className="admin-nav-group">
          <div className="admin-nav-group-label">Management</div>
          <SidebarItem to="/admin/users"         icon="◉" label="Users"         badge={3} />
          <SidebarItem to="/admin/subscriptions" icon="◎" label="Subscriptions" />
          <SidebarItem to="/admin/marketplace"   icon="◈" label="Marketplace"   badge={5} />
          <SidebarItem to="/admin/payments"      icon="⊟" label="Payments"      />
        </div>

        {/* CONTENT */}
        <div className="admin-nav-group">
          <div className="admin-nav-group-label">Content</div>
          <SidebarItem to="/admin/cms"        icon="✎" label="Landing CMS" />
          <SidebarItem to="/admin/moderation" icon="⊛" label="Moderation" badge={5} />
          <SidebarItem to="/admin/ai"         icon="✦" label="AI Models"  />
        </div>

        {/* OPERATIONS */}
        <div className="admin-nav-group">
          <div className="admin-nav-group-label">Operations</div>
          <SidebarItem to="/admin/support" icon="✉" label="Support" badge={12} />
          <SidebarItem to="/admin/storage" icon="⊟" label="Storage"  />
          <SidebarItem to="/admin/security" icon="⚿" label="Security" />
        </div>

        {/* SYSTEM */}
        <div className="admin-nav-group">
          <div className="admin-nav-group-label">System</div>
          <SidebarItem to="/admin/settings" icon="⚙" label="Settings" />
        </div>

        {/* Footer */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-user-avatar">{initials}</div>
            <div>
              <div className="admin-user-role">super_admin</div>
              <div className="admin-user-email">{userEmail}</div>
            </div>
          </div>
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            style={{ width: '100%' }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ── Content Area ── */}
      <main className="admin-content">
        <Suspense fallback={
          <div style={{ padding: 40, color: '#334155', fontSize: 13 }}>Loading…</div>
        }>
          <Routes>
            <Route path="/"             element={<AdminDashboard />} />
            <Route path="/monitoring"   element={<Monitoring />} />
            <Route path="/analytics"    element={<Analytics />} />
            <Route path="/security"     element={<Security />} />
            <Route path="/users"         element={<Users />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/marketplace"   element={<MarketplaceAdmin />} />
            <Route path="/payments"      element={<Payments />} />
            <Route path="/cms"           element={<CMS />} />
            <Route path="/moderation"    element={<Moderation />} />
            <Route path="/ai"            element={<AIManagement />} />
            <Route path="/support"       element={<Support />} />
            <Route path="/storage"       element={<Storage />} />
            <Route path="/settings"      element={<Settings />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
