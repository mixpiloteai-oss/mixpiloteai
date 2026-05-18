import { Link } from 'react-router-dom'
import './Download.css'

const VERSION = '1.0.0-beta.1'
const RELEASE_DATE = 'May 14, 2025'
const INSTALLER_NAME = `NeuroTek-AI-Setup-${VERSION}.exe`
const INSTALLER_SIZE = '~120 MB'
const PORTABLE_NAME = `NeuroTek-AI-Portable-${VERSION}.exe`
const RELEASES_BASE = 'https://github.com/mixpiloteai-oss/mixpiloteai/releases'
const INSTALLER_URL = `${RELEASES_BASE}/download/v${VERSION}/${INSTALLER_NAME}`
const PORTABLE_URL  = `${RELEASES_BASE}/download/v${VERSION}/${PORTABLE_NAME}`

const installSteps = [
  { step: '1', icon: '⬇️', title: 'Download the installer', description: `Click "Download for Windows" above to download ${INSTALLER_NAME}.` },
  { step: '2', icon: '🛡️', title: 'Run the installer', description: 'Double-click the .exe file. If Windows SmartScreen appears, click "More info" then "Run anyway". We are working on code signing.' },
  { step: '3', icon: '⚙️', title: 'Follow setup wizard', description: 'Choose your install directory and shortcut preferences. The installation takes about 30 seconds.' },
  { step: '4', icon: '🚀', title: 'Launch and create', description: 'Open NeuroTek AI from your desktop or Start menu. Sign in or continue as a guest to start making music immediately.' },
]

function Download() {
  return (
    <div className="download-page">
      <div className="download-hero">
        <div className="download-hero-bg" aria-hidden="true"><div className="dl-orb dl-orb-1" /><div className="dl-orb dl-orb-2" /></div>
        <div className="container">
          <div className="section-label">Download</div>
          <h1 className="download-title">Download <span className="gradient-text">NeuroTek AI</span></h1>
          <p className="download-subtitle">Free to download, free to use. No credit card, no sign-up required to get started.</p>
        </div>
      </div>

      <section className="section-sm">
        <div className="container">
          <div className="download-main-grid">
            <div className="download-card-primary glass-card">
              <div className="dl-platform-badge">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="rgba(167,139,250,0.1)" /><rect x="6" y="6" width="9" height="9" rx="1" fill="#a78bfa" /><rect x="17" y="6" width="9" height="9" rx="1" fill="#a78bfa" /><rect x="6" y="17" width="9" height="9" rx="1" fill="#a78bfa" /><rect x="17" y="17" width="9" height="9" rx="1" fill="#a78bfa" /></svg>
                <div><span className="dl-platform-name">Windows</span><span className="dl-platform-detail">10 / 11 — 64-bit</span></div>
              </div>
              <div className="dl-version-info">
                <div className="badge" style={{ marginBottom: '8px' }}><span className="badge-dot" />Latest Stable Beta</div>
                <div className="dl-version-number">v{VERSION}</div>
                <div className="dl-version-meta">Released {RELEASE_DATE} &bull; {INSTALLER_SIZE} &bull; NSIS installer</div>
              </div>
              <a href={INSTALLER_URL} className="btn-primary dl-btn-main" target="_blank" rel="noopener noreferrer">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2v12M6 10l4 4 4-4M2 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Download {INSTALLER_NAME}
              </a>
              <a href={PORTABLE_URL} className="btn-secondary dl-btn-secondary" target="_blank" rel="noopener noreferrer">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2h12v12H2V2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                Portable Version ({PORTABLE_NAME})
              </a>
              <p className="dl-sha-hint">SHA-256 checksum available after download &bull; See <Link to="/changelog">Changelog</Link> for what's new</p>
            </div>
            <div className="dl-other-platforms">
              <h3 className="dl-other-title">Other Platforms</h3>
              <div className="dl-platform-card dl-platform-disabled">
                <div className="dl-platform-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></svg></div>
                <div><div className="dl-platform-name">macOS</div><div className="dl-platform-status">In internal testing</div></div>
                <span className="dl-coming-soon-badge">Soon</span>
              </div>
              <div className="dl-platform-card dl-platform-disabled">
                <div className="dl-platform-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" /></svg></div>
                <div><div className="dl-platform-name">Linux</div><div className="dl-platform-status">AppImage — planned 2025</div></div>
                <span className="dl-coming-soon-badge">Soon</span>
              </div>
              <div className="dl-notify-box">
                <p className="dl-notify-text">Get notified when Mac and Linux builds are available.</p>
                <div className="dl-notify-input">
                  <input type="email" placeholder="your@email.com" className="dl-email-input" />
                  <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>Notify Me</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section sysreq-section">
        <div className="container">
          <div className="section-label">System Requirements</div>
          <h2 className="section-title">What you need to <span className="gradient-text">run NeuroTek AI</span></h2>
          <div className="sysreq-grid">
            <div className="glass-card sysreq-card">
              <div className="sysreq-card-header sysreq-minimum"><div className="sysreq-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></div><h3>Minimum</h3></div>
              <ul className="sysreq-list">
                <li><span className="sysreq-key">OS</span><span className="sysreq-val">Windows 10 (64-bit)</span></li>
                <li><span className="sysreq-key">RAM</span><span className="sysreq-val">4 GB</span></li>
                <li><span className="sysreq-key">CPU</span><span className="sysreq-val">2 GHz dual-core</span></li>
                <li><span className="sysreq-key">Storage</span><span className="sysreq-val">2 GB free space</span></li>
                <li><span className="sysreq-key">Audio</span><span className="sysreq-val">Any Windows audio device</span></li>
                <li><span className="sysreq-key">Internet</span><span className="sysreq-val">Required for AI features</span></li>
              </ul>
            </div>
            <div className="glass-card sysreq-card sysreq-recommended">
              <div className="sysreq-card-header sysreq-rec-header"><div className="sysreq-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.39 4.84L18 7.64l-4 3.9.94 5.46L10 14.27 5.06 17 6 11.54 2 7.64l5.61-.8L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg></div><h3>Recommended</h3><span className="sysreq-rec-badge">Best Experience</span></div>
              <ul className="sysreq-list">
                <li><span className="sysreq-key">OS</span><span className="sysreq-val">Windows 11 (64-bit)</span></li>
                <li><span className="sysreq-key">RAM</span><span className="sysreq-val">8 GB or more</span></li>
                <li><span className="sysreq-key">CPU</span><span className="sysreq-val">4-core, 3+ GHz</span></li>
                <li><span className="sysreq-key">Storage</span><span className="sysreq-val">4 GB free (SSD)</span></li>
                <li><span className="sysreq-key">Audio</span><span className="sysreq-val">ASIO-compatible interface</span></li>
                <li><span className="sysreq-key">Internet</span><span className="sysreq-val">Broadband (5+ Mbps)</span></li>
              </ul>
            </div>
            <div className="glass-card sysreq-card sysreq-note-card">
              <div className="sysreq-card-header"><div className="sysreq-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9 10v4M9 6v.01M4 10a6 6 0 1112 0 6 6 0 01-12 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></div><h3>Audio Note</h3></div>
              <div className="sysreq-note">
                <p>For the lowest latency, use an <strong>ASIO-compatible audio interface</strong>. Install <a href="https://www.asio4all.org/" className="dl-inline-link" target="_blank" rel="noopener noreferrer">ASIO4ALL</a> (free) if you don't have one.</p>
                <div className="dl-latency-bar">
                  <div className="dl-latency-item"><span>ASIO</span><div className="dl-latency-pill good">2–4 ms</div></div>
                  <div className="dl-latency-item"><span>WASAPI</span><div className="dl-latency-pill ok">10–20 ms</div></div>
                  <div className="dl-latency-item"><span>DirectSound</span><div className="dl-latency-pill warn">40–80 ms</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section install-section">
        <div className="container">
          <div className="install-header"><div className="section-label">Installation</div><h2 className="section-title">Up and running in <span className="gradient-text">under 2 minutes</span></h2></div>
          <div className="install-steps">
            {installSteps.map((step) => (
              <div key={step.step} className="install-step">
                <div className="install-step-num">{step.step}</div>
                <div className="install-step-icon">{step.icon}</div>
                <div className="install-step-content"><h3>{step.title}</h3><p>{step.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm dl-bottom-cta">
        <div className="container">
          <div className="dl-cta-inner">
            <h2>Ready to start? <span className="gradient-text">It's free.</span></h2>
            <a href={INSTALLER_URL} className="btn-primary" style={{ fontSize: '16px', padding: '16px 36px' }} target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1v10M5 8l4 4 4-4M1 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Download {INSTALLER_NAME}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Download
