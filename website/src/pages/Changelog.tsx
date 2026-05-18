import './Changelog.css'

interface ChangelogEntry {
  version: string; date: string; title: string; current?: boolean
  changes: { type: 'new' | 'improved' | 'fixed' | 'removed'; text: string }[]
}

const entries: ChangelogEntry[] = [
  {
    version: 'v1.0.0-beta.1', date: 'May 14, 2025', title: 'First Public Beta Release', current: true,
    changes: [
      { type: 'new', text: 'Piano Roll with full undo/redo stack, clipboard, and MIDI note editing' },
      { type: 'new', text: 'Arrangement timeline with clip dragging, resizing, and loop markers' },
      { type: 'new', text: 'AI Beat Generation supporting 8 genres: Trap, Lo-Fi, House, DNB, Ambient, R&B, Rock, Pop' },
      { type: 'new', text: 'Sample Browser with 500MB local cache and AI-powered search tagging' },
      { type: 'new', text: 'Electron desktop app for Windows x64 with native system tray integration' },
      { type: 'new', text: 'WAV and MIDI export with configurable sample rate (44.1 / 48 kHz)' },
      { type: 'improved', text: 'Piano Roll: velocity lane with mouse dragging and lasso selection' },
      { type: 'fixed', text: 'Fixed audio crackling on some Intel HD Audio drivers with low-latency WASAPI mode' },
      { type: 'fixed', text: 'Project files now save correctly when filename contains special characters' },
    ],
  },
  {
    version: 'v0.9.0', date: 'April 22, 2025', title: 'Pre-Release Candidate',
    changes: [
      { type: 'new', text: 'Undo/redo history system with 500-step deep stack (Ctrl+Z / Ctrl+Shift+Z)' },
      { type: 'new', text: 'Live Performance Mode with scene launching and clip triggering' },
      { type: 'new', text: 'Autosave system — projects saved every 2 minutes automatically' },
      { type: 'new', text: 'Crash recovery: unsaved work is restored after unexpected closes' },
      { type: 'improved', text: 'AI generation speed improved by 40% through model quantization' },
      { type: 'fixed', text: 'Fixed a memory leak when switching projects rapidly' },
    ],
  },
  {
    version: 'v0.8.0', date: 'March 10, 2025', title: 'Core DAW Systems',
    changes: [
      { type: 'new', text: 'Audio engine integration using Web Audio API with ASIO bridge on Windows' },
      { type: 'new', text: 'VST hosting panel — load VST2 and VST3 plugins from a user-specified folder' },
      { type: 'new', text: 'Mixer view with channel strips, sends, EQ, and compressor per track' },
      { type: 'improved', text: 'Reduced startup time from ~8s to ~2.5s via lazy module loading' },
      { type: 'removed', text: 'Removed legacy audio engine fallback (now requires WASAPI or ASIO)' },
    ],
  },
  {
    version: 'v0.5.0', date: 'December 12, 2024', title: 'Foundation Release',
    changes: [
      { type: 'new', text: 'Initial Electron desktop application for Windows (x64)' },
      { type: 'new', text: 'User authentication: sign up, sign in, password reset via email' },
      { type: 'new', text: 'Pack marketplace — browse and preview sample packs (basic version)' },
      { type: 'new', text: 'Settings panel: audio device selection, theme, language (EN only)' },
    ],
  },
]

const typeColors: Record<string, string> = { new: 'type-new', improved: 'type-improved', fixed: 'type-fixed', removed: 'type-removed' }
const typeLabels: Record<string, string> = { new: 'New', improved: 'Improved', fixed: 'Fixed', removed: 'Removed' }

function Changelog() {
  return (
    <div className="changelog-page">
      <div className="changelog-hero">
        <div className="container">
          <div className="section-label">Release History</div>
          <h1 className="changelog-title"><span className="gradient-text">Changelog</span></h1>
          <p className="changelog-subtitle">A detailed history of every update to NeuroTek AI. We ship fast and break nothing.</p>
          <div className="changelog-badges">
            <a href="/download" className="badge badge-cyan"><span className="badge-dot" />Latest: v1.0.0-beta.1</a>
            <span className="badge"><span className="badge-dot" />Auto-updates enabled</span>
          </div>
        </div>
      </div>

      <section className="section-sm">
        <div className="container">
          <div className="changelog-layout">
            <aside className="changelog-sidebar">
              <div className="changelog-sidebar-sticky">
                <p className="changelog-sidebar-title">Versions</p>
                <nav>
                  {entries.map((entry) => (
                    <a key={entry.version} href={`#${entry.version}`} className={`changelog-nav-item${entry.current ? ' current' : ''}`}>
                      <span className="changelog-nav-version">{entry.version}</span>
                      {entry.current && <span className="changelog-nav-badge">Current</span>}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
            <div className="changelog-entries">
              {entries.map((entry) => (
                <article key={entry.version} id={entry.version} className={`changelog-entry${entry.current ? ' changelog-entry-current' : ''}`}>
                  <div className="changelog-entry-header">
                    <div className="changelog-entry-version-row">
                      <h2 className="changelog-entry-version">{entry.version}</h2>
                      {entry.current && <span className="changelog-current-badge"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34d399', marginRight: 6 }} />Current</span>}
                    </div>
                    <div className="changelog-entry-date">{entry.date}</div>
                    <p className="changelog-entry-title">{entry.title}</p>
                  </div>
                  <ul className="changelog-changes">
                    {entry.changes.map((change, i) => (
                      <li key={i} className="changelog-change">
                        <span className={`changelog-type-badge ${typeColors[change.type]}`}>{typeLabels[change.type]}</span>
                        <span className="changelog-change-text">{change.text}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Changelog
