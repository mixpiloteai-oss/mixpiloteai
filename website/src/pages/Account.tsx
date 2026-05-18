import { Link } from 'react-router-dom'
import './Account.css'

const mockUser = { name: 'Alex Producer', email: 'alex@email.com', plan: 'Pro', generations: 87, generationsMax: 200, projects: 12, joined: 'January 2025' }

function Account() {
  return (
    <div className="account-page">
      <div className="account-hero">
        <div className="container">
          <div className="section-label">My Account</div>
          <h1 className="account-title">Your <span className="gradient-text">Dashboard</span></h1>
        </div>
      </div>

      <section className="section-sm">
        <div className="container">
          <div className="account-grid">

            {/* Profile card */}
            <div className="glass-card account-profile-card">
              <div className="account-avatar">{mockUser.name.split(' ').map(w => w[0]).join('')}</div>
              <div className="account-profile-info">
                <h2 className="account-name">{mockUser.name}</h2>
                <p className="account-email">{mockUser.email}</p>
                <span className="account-plan-badge">{mockUser.plan}</span>
              </div>
              <div className="account-profile-meta">
                <div className="account-meta-item"><span className="account-meta-label">Member since</span><span className="account-meta-val">{mockUser.joined}</span></div>
                <div className="account-meta-item"><span className="account-meta-label">Projects</span><span className="account-meta-val">{mockUser.projects}</span></div>
              </div>
              <Link to="/pricing" className="btn-primary" style={{ justifyContent: 'center' }}>Upgrade to Studio</Link>
            </div>

            {/* Usage */}
            <div className="account-main">
              <div className="glass-card account-section-card">
                <h3 className="account-section-title">AI Generations</h3>
                <div className="account-usage-bar-wrap">
                  <div className="account-usage-bar">
                    <div className="account-usage-fill" style={{ width: `${(mockUser.generations / mockUser.generationsMax) * 100}%` }} />
                  </div>
                  <span className="account-usage-label">{mockUser.generations} / {mockUser.generationsMax} used this month</span>
                </div>
                <p className="account-usage-note">Resets in 12 days. <Link to="/pricing">Upgrade for unlimited →</Link></p>
              </div>

              <div className="glass-card account-section-card">
                <h3 className="account-section-title">Desktop App</h3>
                <div className="account-app-row">
                  <div className="account-app-info">
                    <div className="account-app-version">v1.0.0-beta.1</div>
                    <div className="account-app-os">Windows 10 / 11 — 64-bit</div>
                  </div>
                  <Link to="/download" className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Download
                  </Link>
                </div>
              </div>

              <div className="glass-card account-section-card">
                <h3 className="account-section-title">Subscription</h3>
                <div className="account-sub-row">
                  <div>
                    <div className="account-sub-plan">{mockUser.plan} Plan</div>
                    <div className="account-sub-renew">Renews June 14, 2025</div>
                  </div>
                  <div className="account-sub-actions">
                    <Link to="/pricing" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>Change Plan</Link>
                    <button className="account-cancel-btn">Cancel</button>
                  </div>
                </div>
              </div>

              <div className="glass-card account-section-card">
                <h3 className="account-section-title">Settings</h3>
                <div className="account-settings-list">
                  {['Change password', 'Update email', 'Notification preferences', 'Delete account'].map((item) => (
                    <button key={item} className="account-setting-row">
                      <span>{item}</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Account
