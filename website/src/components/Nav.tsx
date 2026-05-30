import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Nav.css'
import { useSiteConfig } from '../contexts/SiteConfigContext'

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { config } = useSiteConfig()
  const navCfg = config.navbar
  const visibleLinks = navCfg.links.filter(l => l.visible)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isActive = (path: string) => location.pathname === path

  return (
    <header className={`nav-header${scrolled ? ' nav-scrolled' : ''}`}>
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <div className="nav-logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#logoGrad)" />
              <path d="M8 14C8 10.686 10.686 8 14 8C17.314 8 20 10.686 20 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="14" cy="14" r="3" fill="white" />
              <path d="M6 18C7.5 16 10 15 14 15C18 15 20.5 16 22 18" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7c3aed" />
                  <stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="nav-logo-text">{navCfg.logoText} <span>{navCfg.logoHighlight}</span></span>
        </Link>

        <nav className="nav-links" aria-label="Main navigation">
          {visibleLinks.map(({ to, label }) => (
            <Link key={to} to={to} className={`nav-link${isActive(to) ? ' nav-link-active' : ''}`}>{label}</Link>
          ))}
        </nav>

        <div className="nav-cta">
          <Link to={navCfg.secondaryCta.to} className="btn-secondary nav-btn-login">{navCfg.secondaryCta.text}</Link>
          <Link to={navCfg.primaryCta.to} className="btn-primary nav-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {navCfg.primaryCta.text}
          </Link>
        </div>

        <button className={`nav-hamburger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
          <span /><span /><span />
        </button>
      </div>

      <div className={`nav-mobile${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <nav className="nav-mobile-links">
          {visibleLinks.map(({ to, label }) => (
            <Link key={to} to={to} className={`nav-mobile-link${isActive(to) ? ' active' : ''}`}>{label}</Link>
          ))}
        </nav>
        <div className="nav-mobile-cta">
          <Link to={navCfg.secondaryCta.to} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }}>{navCfg.secondaryCta.text}</Link>
          <Link to={navCfg.primaryCta.to} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {navCfg.primaryCta.text}
          </Link>
        </div>
      </div>
      {navCfg.announcementBar.show && (
        <div className={`nav-announcement nav-announcement-${navCfg.announcementBar.type}`}>
          <a href={navCfg.announcementBar.url}>{navCfg.announcementBar.text}</a>
        </div>
      )}
    </header>
  )
}

export default Nav
