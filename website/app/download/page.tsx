import Link from 'next/link'

export const metadata = { title: 'Download — Neurotek AI' }

export default function DownloadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <h1 className="text-4xl font-bold text-nt-text mb-4">Download Neurotek Studio</h1>
      <p className="text-nt-muted mb-12">AI-powered desktop DAW. Free forever on Windows.</p>

      <div className="grid md:grid-cols-2 gap-6 mb-16">
        <a
          href="https://github.com/mixpiloteai-oss/mixpiloteai/releases/download/v1.0.0-beta.1/NeuroTek-AI-Setup-1.0.0-beta.1.exe"
          className="p-8 rounded-2xl bg-nt-card border border-nt-border hover:border-nt-purple transition-colors block text-left"
        >
          <div className="text-3xl mb-3">🪟</div>
          <h2 className="text-lg font-bold text-nt-text mb-1">Windows Installer</h2>
          <p className="text-nt-muted text-sm mb-4">NSIS installer, adds to Start Menu</p>
          <span className="text-nt-purple text-sm font-medium">NeuroTek-AI-Setup-1.0.0-beta.1.exe →</span>
        </a>
        <a
          href="https://github.com/mixpiloteai-oss/mixpiloteai/releases/download/v1.0.0-beta.1/NeuroTek-AI-Portable-1.0.0-beta.1.exe"
          className="p-8 rounded-2xl bg-nt-card border border-nt-border hover:border-nt-purple transition-colors block text-left"
        >
          <div className="text-3xl mb-3">📦</div>
          <h2 className="text-lg font-bold text-nt-text mb-1">Windows Portable</h2>
          <p className="text-nt-muted text-sm mb-4">No installation, run anywhere</p>
          <span className="text-nt-purple text-sm font-medium">NeuroTek-AI-Portable-1.0.0-beta.1.exe →</span>
        </a>
      </div>

      <div className="p-6 rounded-xl bg-nt-card border border-nt-border text-left mb-8">
        <h3 className="font-semibold text-nt-text mb-2">System Requirements</h3>
        <ul className="text-nt-muted text-sm space-y-1">
          <li>Windows 10 / 11 (64-bit)</li>
          <li>4 GB RAM minimum (8 GB recommended)</li>
          <li>2 GHz dual-core processor</li>
          <li>2 GB disk space</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-4 justify-center text-sm text-nt-muted">
        <span>macOS — 🔜 In testing</span>
        <span>•</span>
        <span>Linux — 🔜 Planned 2025</span>
      </div>
    </div>
  )
}
