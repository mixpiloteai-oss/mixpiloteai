import { useEffect, useState } from 'react'

type View =
  | 'dashboard' | 'pianoroll' | 'arrangement' | 'mixer'
  | 'ai' | 'live' | 'vst' | 'routing' | 'cloud-sync'

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('dashboard')
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    window.electronAPI?.onNav(v => setView(v as View))
    return () => { window.electronAPI?.removeAllListeners('nav') }
  }, [])

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-studio-bg">
        <div className="w-full max-w-sm p-8 rounded-2xl bg-studio-surface border border-studio-border">
          <h1 className="text-2xl font-bold text-studio-text mb-2">Neurotek Studio</h1>
          <p className="text-studio-muted text-sm mb-6">Sign in to continue</p>
          <button
            className="w-full py-2 px-4 bg-studio-purple hover:opacity-90 text-white rounded-lg font-medium transition-opacity"
            onClick={() => setAuthenticated(true)}
          >
            Continue as Demo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-studio-bg text-studio-text">
      {/* Sidebar */}
      <nav className="w-14 flex flex-col items-center py-4 gap-3 bg-studio-surface border-r border-studio-border shrink-0">
        {(
          [
            ['dashboard',   '⊞', 'Dashboard'],
            ['pianoroll',   '♪', 'Piano Roll'],
            ['arrangement', '≡', 'Arrangement'],
            ['mixer',       '⊟', 'Mixer'],
            ['ai',          '✦', 'AI Assistant'],
            ['live',        '▶', 'Live'],
            ['vst',         '⊕', 'VST'],
            ['routing',     '⊗', 'Routing'],
            ['cloud-sync',  '↑', 'Cloud Sync'],
          ] as [View, string, string][]
        ).map(([v, icon, label]) => (
          <button
            key={v}
            title={label}
            onClick={() => setView(v)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors
              ${view === v ? 'bg-studio-purple text-white' : 'text-studio-muted hover:text-studio-text hover:bg-studio-border'}`}
          >
            {icon}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-hidden p-6">
        <h2 className="text-xl font-semibold text-studio-text capitalize mb-4">
          {view.replace('-', ' ')}
        </h2>
        <p className="text-studio-muted text-sm">
          {view === 'dashboard'   && 'Welcome to Neurotek Studio. Your projects and recent activity appear here.'}
          {view === 'pianoroll'   && 'Piano Roll — MIDI editor with velocity, quantize and multi-select.'}
          {view === 'arrangement' && 'Arrangement Timeline — pattern-based sequencer with clip dragging.'}
          {view === 'mixer'       && 'Mixer — per-track faders, mute/solo, send/return routing, master bus.'}
          {view === 'ai'          && 'AI Assistant — text-to-pattern, chord suggestions, genre presets.'}
          {view === 'live'        && 'Live Mode — clip launcher for live performance.'}
          {view === 'vst'         && 'VST Plugins — scan and host VST2/VST3 plugins.'}
          {view === 'routing'     && 'Audio Routing — configure sends, returns and sidechain routing.'}
          {view === 'cloud-sync'  && 'Cloud Sync — sync projects across devices via your account.'}
        </p>
      </main>
    </div>
  )
}
