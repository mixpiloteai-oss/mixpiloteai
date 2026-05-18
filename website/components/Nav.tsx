'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const links = [
  { href: '/features',  label: 'Features' },
  { href: '/pricing',   label: 'Pricing' },
  { href: '/download',  label: 'Download' },
]

export default function Nav() {
  const [open, setOpen]       = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(3,3,7,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(28,28,46,0.8)' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-nt-purple to-nt-cyan flex items-center justify-center text-white text-xs font-bold">
            N
          </span>
          <span className="font-bold text-nt-text text-sm tracking-tight group-hover:text-nt-violet transition-colors">
            Neurotek<span className="text-nt-violet"> AI</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 text-sm text-nt-muted hover:text-nt-text rounded-lg hover:bg-white/5 transition-all"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-nt-muted hover:text-nt-text transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link
            href="/download"
            className="btn-primary text-xs px-4 py-2"
          >
            Download Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 text-nt-muted rounded-lg hover:bg-white/5 transition-colors"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-px bg-current transition-all ${open ? 'rotate-45 translate-y-[5px]' : ''}`} />
          <span className={`block w-5 h-px bg-current transition-all ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-px bg-current transition-all ${open ? '-rotate-45 -translate-y-[5px]' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-nt-border/50 px-5 py-4 flex flex-col gap-1" style={{ background: 'rgba(3,3,7,0.97)' }}>
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 text-sm text-nt-muted hover:text-nt-text rounded-lg hover:bg-white/5 transition-all"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 pt-2 border-t border-nt-border/50 flex flex-col gap-2">
            <Link href="/login" onClick={() => setOpen(false)} className="px-3 py-2.5 text-sm text-nt-muted">
              Sign in
            </Link>
            <Link href="/download" onClick={() => setOpen(false)} className="btn-primary justify-center text-xs">
              Download Free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
