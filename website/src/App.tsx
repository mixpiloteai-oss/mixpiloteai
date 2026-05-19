import { Routes, Route, useLocation } from 'react-router-dom'
import Nav         from './components/Nav'
import Footer      from './components/Footer'
import OfflineBanner from './components/OfflineBanner'
import Landing     from './pages/Landing'
import Download    from './pages/Download'
import Pricing     from './pages/Pricing'
import Changelog   from './pages/Changelog'
import Support     from './pages/Support'
import Login       from './pages/Login'
import Account     from './pages/Account'
import Marketplace from './pages/Marketplace'
import Merch       from './pages/Merch'
import Privacy     from './pages/Privacy'
import Terms         from './pages/Terms'
import Collaboration from './pages/Collaboration'
import AdminShell   from './pages/Admin/AdminShell'
import CreatorProfile    from './pages/CreatorProfile'
import CreatorDashboard from './pages/CreatorDashboard'
import Checkout from './pages/Checkout'
import Billing  from './pages/Billing'
import { useOnlineStatus } from './hooks/useOnlineStatus'

// ─── Offline placeholder for cloud-only pages ─────────────────────────────────

function CloudOfflinePage({ label }: { label: string }) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      minHeight:      '60vh',
      gap:            16,
      padding:        32,
      textAlign:      'center',
      color:          '#64748b',
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" style={{ color: '#334155' }}>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" /><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" /><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" />
      </svg>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8', margin: 0 }}>{label} — Offline</p>
      <p style={{ fontSize: 14, maxWidth: 380, margin: 0 }}>
        This page requires an internet connection. Please reconnect and try again.
      </p>
    </div>
  )
}

function App() {
  const { isOnline, backendReachable } = useOnlineStatus()
  const networkOk = isOnline && backendReachable !== false
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')

  if (isAdmin) {
    return (
      <Routes>
        <Route path="/admin/*" element={<AdminShell />} />
      </Routes>
    )
  }

  return (
    <div className="app">
      <OfflineBanner />
      <Nav />
      <main>
        <Routes>
          {/* Always available offline */}
          <Route path="/"          element={<Landing />} />
          <Route path="/download"  element={<Download />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/support"   element={<Support />} />
          <Route path="/pricing"   element={<Pricing />} />
          <Route path="/privacy"   element={<Privacy />} />
          <Route path="/terms"         element={<Terms />} />
          <Route path="/collaboration" element={<Collaboration />} />

          {/* Cloud features — disabled when offline */}
          <Route path="/marketplace" element={
            networkOk
              ? <Marketplace />
              : <CloudOfflinePage label="Marketplace" />
          } />
          <Route path="/login" element={
            networkOk
              ? <Login />
              : <CloudOfflinePage label="Login" />
          } />
          <Route path="/account" element={
            networkOk
              ? <Account />
              : <CloudOfflinePage label="Account" />
          } />
          <Route path="/merch" element={
            networkOk
              ? <Merch />
              : <CloudOfflinePage label="Merch Store" />
          } />
          <Route path="/creator/:slug" element={
            networkOk
              ? <CreatorProfile />
              : <CloudOfflinePage label="Creator" />
          } />
          <Route path="/creator-dashboard" element={
            networkOk
              ? <CreatorDashboard />
              : <CloudOfflinePage label="Dashboard" />
          } />
          <Route path="/checkout" element={
            networkOk
              ? <Checkout />
              : <CloudOfflinePage label="Checkout" />
          } />
          <Route path="/billing" element={
            networkOk
              ? <Billing />
              : <CloudOfflinePage label="Billing" />
          } />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
