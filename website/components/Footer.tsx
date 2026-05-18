import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-nt-border mt-auto py-12 px-4">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
        <div>
          <p className="font-bold text-nt-text mb-2">Neurotek AI</p>
          <p className="text-nt-muted text-sm">AI-powered music production for the underground tekno scene.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-nt-muted mb-3">Product</p>
          <ul className="space-y-2 text-sm text-nt-muted">
            <li><Link href="/features" className="hover:text-nt-text transition-colors">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-nt-text transition-colors">Pricing</Link></li>
            <li><Link href="/download" className="hover:text-nt-text transition-colors">Download</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-nt-muted mb-3">Community</p>
          <ul className="space-y-2 text-sm text-nt-muted">
            <li><a href="https://discord.gg/neurotek" target="_blank" rel="noreferrer" className="hover:text-nt-text transition-colors">Discord</a></li>
            <li><a href="https://github.com/mixpiloteai-oss/mixpiloteai" target="_blank" rel="noreferrer" className="hover:text-nt-text transition-colors">GitHub</a></li>
            <li><a href="https://github.com/mixpiloteai-oss/mixpiloteai/wiki" target="_blank" rel="noreferrer" className="hover:text-nt-text transition-colors">Docs</a></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-nt-muted mb-3">Legal</p>
          <ul className="space-y-2 text-sm text-nt-muted">
            <li><Link href="/privacy" className="hover:text-nt-text transition-colors">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-nt-text transition-colors">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-nt-border text-center text-xs text-nt-muted">
        © {new Date().getFullYear()} NeuroTek AI · MIT License · Made for the underground tekno scene.
      </div>
    </footer>
  )
}
