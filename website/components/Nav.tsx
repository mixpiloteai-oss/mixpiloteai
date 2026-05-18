'use client'
import Link from 'next/link'
import { useState } from 'react'

const links = [
  { href: '/features',  label: 'Features' },
  { href: '/pricing',   label: 'Pricing' },
  { href: '/download',  label: 'Download' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-nt-border bg-nt-bg/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-nt-text hover:text-nt-purple transition-colors">
          Neurotek AI
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <Link key={l.href} href={l.href} className="text-sm text-nt-muted hover:text-nt-text transition-colors">
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="ml-2 px-4 py-1.5 rounded-lg bg-nt-purple text-white text-sm font-medium hover:opacity-90 transition-opacity">
            Sign in
          </Link>
        </nav>
        <button className="md:hidden text-nt-muted" onClick={() => setOpen(o => !o)}>
          {open ? '✕' : '☰'}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-nt-border px-4 py-4 flex flex-col gap-3 bg-nt-bg">
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-nt-muted hover:text-nt-text">
              {l.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="text-sm text-nt-purple font-medium">Sign in</Link>
        </div>
      )}
    </header>
  )
}
