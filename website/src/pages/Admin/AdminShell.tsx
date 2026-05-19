import { useState, lazy, Suspense } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import './admin.css'

const AdminDashboard   = lazy(() => import('./AdminDashboard'))
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

const ADMIN_KEY = 'nt-admin-dev-2025'
const STORAGE_KEY = 'admin-key'
const SUPER_ADMIN_EMAILS = new Set(['tifenn.cruchon@gmail.com'])

function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed === ADMIN_KEY || SUPER_ADMIN_EMAILS.has(trimmed)) {
      localStorage.setItem(STORAGE_KEY, trimmed)
      onAuth()
    } else {
      setError('Invalid admin key. Please try again.')
    }
  }

  return (
    <div className="admin-auth-gate">
      <form className="admin-auth-box" onSubmit={handleSubmit}>
        <div className="admin-auth-logo">N</div>
        <div className="admin-auth-title">Admin Access</div>
        <div className="admin-auth-sub">Enter your admin key to access the NeuroTek control panel</div>
        {error && <div className="admin-auth-error">{error}</div>}
        <input
          className="admin-auth-input"
          type="password"
          placeholder="••••••••••••••••"
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          autoFocus
        />
        <button type="submit" className="admin-auth-btn">Access Admin Panel</button>
        <div className="admin-auth-hint">
          Dev hint: <code>{ADMIN_KEY}</code>
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
  const stored = localStorage.getItem(STORAGE_KEY)
  const [authed, setAuthed] = useState(stored === ADMIN_KEY || SUPER_ADMIN_EMAILS.has(stored ?? ''))

  if (!authed) {
    return <AuthGate onAuth={() => setAuthed(true)} />
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setAuthed(false)
    navigate('/admin')
  }

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
            <div className="admin-user-avatar">SA</div>
            <div>
              <div className="admin-user-role">super_admin</div>
              <div className="admin-user-email">admin@neurotek.ai</div>
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
