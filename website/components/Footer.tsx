import Link from 'next/link'

const cols = [
  {
    label: 'Product',
    links: [
      { href: '/features', label: 'Features',  external: false },
      { href: '/pricing',  label: 'Pricing',   external: false },
      { href: '/download', label: 'Download',  external: false },
    ],
  },
  {
    label: 'Community',
    links: [
      { href: 'https://discord.gg/neurotek',                           label: 'Discord',     external: true },
      { href: 'https://github.com/mixpiloteai-oss/mixpiloteai',        label: 'GitHub',      external: true },
      { href: 'https://github.com/mixpiloteai-oss/mixpiloteai/wiki',   label: 'Docs',        external: true },
      { href: 'https://github.com/mixpiloteai-oss/mixpiloteai/issues', label: 'Bug tracker', external: true },
    ],
  },
  {
    label: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy',   external: false },
      { href: '/terms',   label: 'Terms of service', external: false },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-nt-border/50 mt-auto" style={{ background: '#06060d' }}>
      <div className="max-w-6xl mx-auto px-5 py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <Link href="/" className="flex items-center gap-2.5 mb-4 w-fit">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-nt-purple to-nt-cyan flex items-center justify-center text-white text-xs font-bold">N</span>
            <span className="font-bold text-nt-text text-sm tracking-tight">Neurotek<span className="text-nt-violet"> AI</span></span>
          </Link>
          <p className="text-xs text-nt-muted leading-relaxed max-w-[180px]">AI-powered music production for the underground tekno scene.</p>
          <div className="mt-5 flex items-center gap-2">
            {[['https://discord.gg/neurotek','Discord','D'],['https://github.com/mixpiloteai-oss/mixpiloteai','GitHub','G']].map(([href,label,letter])=>(
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}
                className="w-8 h-8 rounded-lg border border-nt-border flex items-center justify-center text-nt-muted hover:text-nt-text hover:border-nt-purple/40 transition-all text-xs">
                {letter}
              </a>
            ))}
          </div>
        </div>
        {cols.map(col => (
          <div key={col.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-nt-muted mb-4">{col.label}</p>
            <ul className="space-y-2.5">
              {col.links.map(l => (
                <li key={l.label}>
                  {l.external
                    ? <a href={l.href} target="_blank" rel="noreferrer" className="text-xs text-nt-muted hover:text-nt-subtle transition-colors">{l.label}</a>
                    : <Link href={l.href} className="text-xs text-nt-muted hover:text-nt-subtle transition-colors">{l.label}</Link>
                  }
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-nt-border/30 px-5 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-nt-muted/50">
          <span>© {new Date().getFullYear()} NeuroTek AI · MIT License</span>
          <span>Made for the underground tekno scene · <a href="https://github.com/mixpiloteai-oss/mixpiloteai" target="_blank" rel="noreferrer" className="hover:text-nt-muted transition-colors">Open source</a></span>
        </div>
      </div>
    </footer>
  )
}
