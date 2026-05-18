import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Nav.css'

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const isActive = (path: string) => location.pathname === path

  return (
    <header className={`nav-header${scrolled ? ' nav-scrolled' : ''}`}>
      <div className="nav-container">
        {/* Logo */}
        <Link to="/" className="nav-logo">
          <div className="nav-logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#logoGrad)" />
              <path
                d="M8 14C8 10.686 10.686 8 14 8C17.314 8 20 10.686 20 14"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="14" cy="14" r="3" fill="white" />
              <path
                d="M6 18C7.5 16 10 15 14 15C18 15 20.5 16 22 18"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7c3aed" />
                  <stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="nav-logo-text">NeuroTek <span>AI</span></span>
        </Link>

        {/* Desktop Nav */}
        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/" className={`nav-link${isActive('/') ? ' nav-link-active' : ''}`}>
            Features
          </Link>
          <Link to="/pricing" className={`nav-link${isActive('/pricing') ? ' nav-link-active' : ''}`}>
            Pricing
          </Link>
          <Link to="/download" className={`nav-link${isActive('/download') ? ' nav-link-active' : ''}`}>
            Download
          </Link>
          <Link to="/changelog" className={`nav-link${isActive('/changelog') ? ' nav-link-active' : ''}`}>
            Changelog
          </Link>
          <Link to="/support" className={`nav-link${isActive('/support') ? ' nav-link-active' : ''}`}>
            Support
          </Link>
        </nav>

        {/* CTA */}
        <div className="nav-cta">
          <Link to="/download" className="btn-primary nav-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download Free
          </Link>
        </div>

        {/* Hamburger */}
        <button
          className={`nav-hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`nav-mobile${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <nav className="nav-mobile-links">
          <Link to="/" className={`nav-mobile-link${isActive('/') ? ' active' : ''}`}>
            Features
          </Link>
          <Link to="/pricing" className={`nav-mobile-link${isActive('/pricing') ? ' active' : ''}`}>
            Pricing
          </Link>
          <Link to="/download" className={`nav-mobile-link${isActive('/download') ? ' active' : ''}`}>
            Download
          </Link>
          <Link to="/changelog" className={`nav-mobile-link${isActive('/changelog') ? ' active' : ''}`}>
            Changelog
          </Link>
          <Link to="/support" className={`nav-mobile-link${isActive('/support') ? ' active' : ''}`}>
            Support
          </Link>
        </nav>
        <div className="nav-mobile-cta">
          <Link to="/download" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download Free
          </Link>
        </div>
      </div>
    </header>
  )
}

export default Nav
