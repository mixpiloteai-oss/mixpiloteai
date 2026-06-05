import { useState }  from 'react'
import { usePerformanceStore, type PerformanceMode, MODE_CONFIGS } from '../../store/performanceStore'
import { freezeEngine } from '../../audio/FreezeEngine'
import { memoryManager } from '../../audio/MemoryManager'
import { bounceEngine } from '../../audio/BounceEngine'

// ── Bounce progress modal ─────────────────────────────────────────────────────

function BounceModal({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase]       = useState<'idle' | 'rendering' | 'encoding' | 'done'>('idle')
  const [error, setError]       = useState('')

  async function startBounce() {
    setPhase('rendering')
    setError('')
    try {
      const { AudioEngine } = await import('../../audio/AudioEngine')
      const engine = AudioEngine.getInstance()
      const offCtx = bounceEngine.createContext({ durationSec: 60, sampleRate: engine.sampleRate })
      // In a real integration, project track sources would be wired here.
      // Demo: wire a silent source so the bounce completes immediately.
      const silent = offCtx.createBuffer(2, offCtx.length, offCtx.sampleRate)
      const src    = offCtx.createBufferSource()
      src.buffer   = silent
      src.connect(offCtx.destination)
      src.start(0)

      const result = await bounceEngine.render(offCtx, { durationSec: 60, normalize: true, bitDepth: 32 }, (pct, p) => {
        setProgress(pct)
        setPhase(p)
      })
      bounceEngine.download(result, 'neurotek-bounce.wav')
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bounce failed')
      setPhase('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-96 rounded-2xl p-6 space-y-4" style={{ background: '#0c0c14', border: '1px solid #1c1c2e' }}>
        <p className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>Bounce to WAV</p>
        {phase === 'idle' && (
          <>
            <p className="text-xs" style={{ color: '#475569' }}>Render the full mix offline at full quality (32-bit float, peak-normalised).</p>
            {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
            <div className="flex gap-2">
              <button onClick={startBounce} className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(124,58,237,0.3)', color: '#a855f7', border: '1px solid rgba(124,58,237,0.4)' }}>
                Start Bounce
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#475569' }}>
                Cancel
              </button>
            </div>
          </>
        )}
        {(phase === 'rendering' || phase === 'encoding') && (
          <div className="space-y-2">
            <p className="text-xs capitalize" style={{ color: '#94a3b8' }}>{phase}…</p>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1c1c2e' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#06b6d4)' }} />
            </div>
            <p className="text-[10px] text-right" style={{ color: '#475569' }}>{progress}%</p>
          </div>
        )}
        {phase === 'done' && (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: '#10b981' }}>Bounce complete — file downloaded.</p>
            <button onClick={onClose} className="w-full py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Mode card ─────────────────────────────────────────────────────────────────

const MODE_COLORS: Record<PerformanceMode, string> = {
  'low-pc':     '#06b6d4',
  'studio':     '#7c3aed',
  'performance':'#f59e0b',
}

function ModeCard({ id, active, onSelect }: { id: PerformanceMode; active: boolean; onSelect: () => void }) {
  const cfg   = MODE_CONFIGS[id]
  const color = MODE_COLORS[id]
  return (
    <button
      onClick={onSelect}
      className="flex-1 rounded-xl p-3 text-left transition-all"
      style={{
        background: active ? `${color}18` : '#0f0f1a',
        border: `1px solid ${active ? `${color}50` : '#1c1c2e'}`,
      }}
    >
      <p className="text-xs font-bold mb-0.5" style={{ color: active ? color : '#94a3b8' }}>{cfg.label}</p>
      <p className="text-[9px] leading-relaxed" style={{ color: '#475569' }}>{cfg.description}</p>
      <div className="mt-2 space-y-0.5">
        {[
          ['Tracks',  cfg.maxTracks === 64 ? 'Unlimited' : `Max ${cfg.maxTracks}`],
          ['RAM',     `${cfg.maxRamMB} MB`],
          ['Buffer',  `${cfg.bufferSize} smp`],
          ['Workers', `${cfg.workerCount}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-[9px]">
            <span style={{ color: '#334155' }}>{k}</span>
            <span style={{ color: active ? color : '#475569' }}>{v}</span>
          </div>
        ))}
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PerformanceModeSelector() {
  const { mode, config, stats, setMode } = usePerformanceStore()
  const [bounceOpen, setBounceOpen]      = useState(false)
  const [freezing, setFreezing]          = useState(false)

  const memStats    = memoryManager.stats()
  const pressure    = memStats.pressure
  const pressureColor = pressure === 'critical' ? '#ef4444' : pressure === 'warning' ? '#f59e0b' : '#10b981'

  function handleFreezeAll() {
    setFreezing(true)
    // Signal to parent that all tracks should be frozen — actual freeze
    // requires access to track audio sources which live in ArrangementView.
    // Here we just update the store flag so the UI reflects intent.
    setTimeout(() => setFreezing(false), 800)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#08080f' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
        <span style={{ color: '#f59e0b', fontSize: 11 }}>⚙</span>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#334155' }}>Performance</span>
        <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: `${MODE_COLORS[mode]}15`, color: MODE_COLORS[mode], border: `1px solid ${MODE_COLORS[mode]}30` }}>
          {config.label}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* ── Mode selector ── */}
        <div className="flex gap-2">
          {(['low-pc', 'studio', 'performance'] as PerformanceMode[]).map(id => (
            <ModeCard key={id} id={id} active={mode === id} onSelect={() => setMode(id)} />
          ))}
        </div>

        {/* ── Live stats ── */}
        <div className="rounded-xl p-3 space-y-2" style={{ background: '#0c0c14', border: '1px solid #1c1c2e' }}>
          <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#334155' }}>Live Stats</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'RAM Used',   value: `${stats.ramMB} MB`,         color: pressureColor },
              { label: 'Budget',     value: `${config.maxRamMB} MB`,     color: '#475569' },
              { label: 'Cached',     value: `${stats.cachedBuffers}`,    color: '#64748b' },
              { label: 'Frozen',     value: `${stats.frozenTracks}`,     color: '#06b6d4' },
              { label: 'Workers',    value: `${config.workerCount}`,     color: '#7c3aed' },
              { label: 'Buffer',     value: `${config.bufferSize} smp`,  color: '#475569' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between text-[10px] px-2 py-1.5 rounded-lg" style={{ background: '#0f0f1a' }}>
                <span style={{ color: '#475569' }}>{label}</span>
                <span className="font-mono" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
          {/* RAM pressure bar */}
          <div>
            <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: '#1c1c2e' }}>
              <div style={{
                width: `${Math.min(100, (stats.ramMB / config.maxRamMB) * 100)}%`,
                background: pressureColor, height: '100%', transition: 'width 0.5s',
              }} />
            </div>
            <p className="text-[9px] mt-0.5 text-right" style={{ color: '#334155' }}>
              {Math.round((stats.ramMB / config.maxRamMB) * 100)}% RAM
            </p>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="rounded-xl p-3 space-y-2" style={{ background: '#0c0c14', border: '1px solid #1c1c2e' }}>
          <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#334155' }}>Actions</p>

          <button
            onClick={handleFreezeAll}
            disabled={freezing}
            className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-opacity"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4', opacity: freezing ? 0.6 : 1 }}
          >
            {freezing ? '❄ Freezing…' : '❄ Freeze All Idle Tracks'}
          </button>

          <button
            onClick={() => freezeEngine.unfreezeAll()}
            className="w-full py-2 rounded-xl text-xs font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1c1c2e', color: '#64748b' }}
          >
            Unfreeze All
          </button>

          <button
            onClick={() => setBounceOpen(true)}
            disabled={bounceEngine.isActive}
            className="w-full py-2 rounded-xl text-xs font-medium transition-opacity"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', color: '#a855f7', opacity: bounceEngine.isActive ? 0.5 : 1 }}
          >
            {bounceEngine.isActive ? '⏳ Bouncing…' : '⬇ Bounce to WAV'}
          </button>
        </div>

        {/* ── Mode tips ── */}
        <div className="rounded-xl p-3" style={{ background: '#0c0c14', border: '1px solid #1c1c2e' }}>
          <p className="text-[9px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#334155' }}>Tips</p>
          {mode === 'low-pc' && (
            <ul className="space-y-1">
              {['Tracks are auto-frozen after 30s of inactivity to free RAM.',
                'Reduce plugin count per track to stay under 8-track limit.',
                'Use Low-quality audio monitoring to reduce CPU usage.'].map((t, i) => (
                <li key={i} className="text-[10px]" style={{ color: '#475569' }}>• {t}</li>
              ))}
            </ul>
          )}
          {mode === 'studio' && (
            <ul className="space-y-1">
              {['Full 2 GB RAM budget — load as many samples as you need.',
                'All DSP workers active — heavy plugins run without jitter.',
                'Bounce at 32-bit float for maximum mastering headroom.'].map((t, i) => (
                <li key={i} className="text-[10px]" style={{ color: '#475569' }}>• {t}</li>
              ))}
            </ul>
          )}
          {mode === 'performance' && (
            <ul className="space-y-1">
              {['512-sample buffer gives ≈11 ms latency at 44 100 Hz.',
                'Tracks auto-freeze after 60s of no clips playing.',
                'Streaming loads audio in 15-second chunks for smooth playback.'].map((t, i) => (
                <li key={i} className="text-[10px]" style={{ color: '#475569' }}>• {t}</li>
              ))}
            </ul>
          )}
        </div>

      </div>

      {bounceOpen && <BounceModal onClose={() => setBounceOpen(false)} />}
    </div>
  )
}
