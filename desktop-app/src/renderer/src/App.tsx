import { useState, useEffect } from 'react'
import TitleBar from './components/shell/TitleBar'
import Sidebar from './components/shell/Sidebar'
import StatusBar from './components/shell/StatusBar'
import TransportBar from './components/transport/TransportBar'
import ArrangementView from './components/arrangement/ArrangementView'
import MixerView from './components/mixer/MixerView'
import PianoRollView from './components/piano-roll/PianoRollView'
import AIAssistant from './components/ai-assistant/AIAssistant'
import LiveMode from './components/live/LiveMode'
import PluginBrowser from './components/plugin-browser/PluginBrowser'
import RoutingMatrix from './components/routing/RoutingMatrix'
import { useUIStore } from './store/uiStore'
import { useTransportSync } from './hooks/useTransportSync'

const API_URL = 'https://mixpiloteai-production.up.railway.app'

// ─── Login Screen ─────────────────────────────────────────────────────────────

interface LoginProps {
  onAuth: (token: string) => void
}

function LoginScreen({ onAuth }: LoginProps) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? 'Login failed')
      localStorage.setItem('token', data.token)
      onAuth(data.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function demoLogin() {
    localStorage.setItem('token', 'demo')
    onAuth('demo')
  }

  return (
    <div className="flex items-center justify-center h-full" style={{ background: '#08080f' }}>
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(124,58,237,0.12), transparent)',
      }} />

      <div className="relative w-full max-w-sm p-8 rounded-2xl" style={{
        background: '#0c0c14',
        border: '1px solid #1c1c2e',
        boxShadow: '0 0 60px rgba(124,58,237,0.1)',
      }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#a855f7' }}>
            N
          </div>
          <span className="font-bold text-lg" style={{ color: '#e2e8f0' }}>Neurotek Studio</span>
        </div>

        <h2 className="text-sm font-semibold mb-1" style={{ color: '#e2e8f0' }}>Welcome back</h2>
        <p className="text-xs mb-6" style={{ color: '#475569' }}>Sign in to access your projects</p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full text-xs px-3 py-2.5 rounded-xl outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0', caretColor: '#7c3aed' }}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full text-xs px-3 py-2.5 rounded-xl outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0', caretColor: '#7c3aed' }}
          />
          {error && <p className="text-[10px]" style={{ color: '#ef4444' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px" style={{ background: '#1c1c2e' }} />
          <span className="text-[10px]" style={{ color: '#334155' }}>or</span>
          <div className="flex-1 h-px" style={{ background: '#1c1c2e' }} />
        </div>

        <button
          onClick={demoLogin}
          className="w-full py-2.5 rounded-xl text-xs font-medium transition-colors"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}
        >
          Continue as Demo
        </button>

        <p className="text-[10px] text-center mt-5" style={{ color: '#334155' }}>
          demo@neurotek.ai · demo1234
        </p>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const setView = useUIStore(s => s.setView)

  const tiles = [
    { id: 'arrangement' as const, icon: '≡', label: 'Arrangement',   sub: '8 tracks · 32 bars',       color: '#7c3aed' },
    { id: 'mixer'       as const, icon: '⊟', label: 'Mixer',         sub: '6 channels + master',       color: '#06b6d4' },
    { id: 'pianoroll'   as const, icon: '♪', label: 'Piano Roll',    sub: 'MIDI editor · 145 BPM',     color: '#a855f7' },
    { id: 'ai'          as const, icon: '✦', label: 'AI Assistant',  sub: 'Claude · text-to-pattern',  color: '#10b981' },
    { id: 'live'        as const, icon: '▶', label: 'Live Mode',     sub: '6 × 8 clip launcher',       color: '#f59e0b' },
    { id: 'vst'         as const, icon: '⊕', label: 'Plugin Browser',sub: '10 plugins loaded',         color: '#ec4899' },
    { id: 'routing'     as const, icon: '⊗', label: 'Routing Matrix',sub: '11 active connections',     color: '#06b6d4' },
  ]

  return (
    <div className="h-full overflow-auto p-6" style={{ background: '#08080f' }}>
      {/* Project header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold mb-1" style={{ color: '#e2e8f0' }}>Dark Hardtek Session</h1>
        <p className="text-xs" style={{ color: '#475569' }}>145 BPM · D Minor · Last saved just now</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'BPM',     value: '145'   },
          { label: 'Tracks',  value: '6'     },
          { label: 'Bars',    value: '32'    },
          { label: 'Plugins', value: '10'    },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: '#0c0c14', border: '1px solid #1c1c2e' }}>
            <p className="text-2xl font-bold font-mono" style={{ color: '#e2e8f0' }}>{stat.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* View tiles */}
      <p className="text-[10px] uppercase tracking-widest mb-3 font-semibold" style={{ color: '#334155' }}>Workspace</p>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map(tile => (
          <button
            key={tile.id}
            onClick={() => setView(tile.id)}
            className="text-left rounded-xl p-4 transition-all group"
            style={{ background: '#0c0c14', border: '1px solid #1c1c2e' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${tile.color}40` }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1c1c2e' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-base"
              style={{ background: `${tile.color}18`, color: tile.color }}>
              {tile.icon}
            </div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: '#e2e8f0' }}>{tile.label}</p>
            <p className="text-[10px]" style={{ color: '#475569' }}>{tile.sub}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── DAW Shell ────────────────────────────────────────────────────────────────

function DAWShell() {
  const { activeView, aiPanelOpen } = useUIStore()

  function renderView() {
    switch (activeView) {
      case 'arrangement': return <ArrangementView />
      case 'mixer':       return <MixerView />
      case 'pianoroll':   return <PianoRollView />
      case 'live':        return <LiveMode />
      case 'vst':         return <PluginBrowser />
      case 'routing':     return <RoutingMatrix />
      case 'dashboard':   return <Dashboard />
      default:            return <Dashboard />
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#08080f', overflow: 'hidden' }}>
      <TitleBar />
      <TransportBar />

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-1 min-w-0 min-h-0">
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            {renderView()}
          </div>

          {/* AI panel — docked right */}
          {aiPanelOpen && (
            <div className="shrink-0 overflow-hidden" style={{ width: 340, borderLeft: '1px solid #1c1c2e' }}>
              <AIAssistant />
            </div>
          )}
        </div>
      </div>

      <StatusBar />
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  // Drive transport position display via rAF (must run at root level)
  useTransportSync()

  useEffect(() => {
    window.electronAPI?.onNav(() => {})
    return () => { window.electronAPI?.removeAllListeners?.('nav') }
  }, [])

  if (!token) return <LoginScreen onAuth={setToken} />
  return <DAWShell />
}
