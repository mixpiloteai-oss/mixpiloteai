import { useEffect, useRef, useState, useCallback } from 'react'
import type { RoutingNode } from '../../types/audio'
import { getBusRouter }   from '../../audio'
import type { BusLevel }  from '../../audio/BusRouter'

// ─── Static topology ─────────────────────────────────────────────────────────

const SOURCES: RoutingNode[] = [
  { id: 'kick',   label: 'Kick',       kind: 'track' },
  { id: 'bass',   label: 'Bass Synth', kind: 'track' },
  { id: 'lead',   label: 'Lead Acid',  kind: 'track' },
  { id: 'chords', label: 'Chords',     kind: 'track' },
  { id: 'pad',    label: 'Pad',        kind: 'track' },
  { id: 'fx',     label: 'FX',         kind: 'track' },
]

const TARGETS: RoutingNode[] = [
  { id: 'bus-a',  label: 'Bus A',   kind: 'bus' },
  { id: 'bus-b',  label: 'Bus B',   kind: 'bus' },
  { id: 'rev',    label: 'Reverb',  kind: 'bus' },
  { id: 'del',    label: 'Delay',   kind: 'bus' },
  { id: 'master', label: 'Master',  kind: 'master' },
  { id: 'hw-out', label: 'HW Out',  kind: 'hardware' },
]

/** Initial send matrix: track → bus pairs with defaults. */
interface InitSend {
  fromId:    string
  toId:      string
  gainDb:    number
  postFader: boolean   // true = post-fader send
}

const INIT_SENDS: InitSend[] = [
  { fromId: 'kick',   toId: 'bus-a',  gainDb:  0,  postFader: true  },
  { fromId: 'bass',   toId: 'bus-a',  gainDb:  0,  postFader: true  },
  { fromId: 'lead',   toId: 'bus-b',  gainDb:  0,  postFader: true  },
  { fromId: 'chords', toId: 'bus-b',  gainDb:  0,  postFader: true  },
  { fromId: 'pad',    toId: 'master', gainDb: -6,  postFader: true  },
  { fromId: 'fx',     toId: 'rev',    gainDb: -3,  postFader: true  },
  { fromId: 'lead',   toId: 'rev',    gainDb: -6,  postFader: true  },
  { fromId: 'bus-a',  toId: 'master', gainDb:  0,  postFader: true  },
  { fromId: 'bus-b',  toId: 'master', gainDb:  0,  postFader: true  },
  { fromId: 'rev',    toId: 'master', gainDb: -6,  postFader: true  },
  { fromId: 'master', toId: 'hw-out', gainDb:  0,  postFader: true  },
]

// ─── Visual helpers ───────────────────────────────────────────────────────────

const KIND_COLOR: Record<string, string> = {
  track:    '#7c3aed',
  bus:      '#06b6d4',
  master:   '#a855f7',
  hardware: '#f59e0b',
}

// ─── Send state mirror ────────────────────────────────────────────────────────

/** Lightweight React-visible snapshot of send enabled/gain. */
interface SendState {
  enabled: boolean
  gainDb:  number
}

type SendMap = Map<string, Map<string, SendState>>

/** Build composite key. */
function sendKey(fromId: string, toId: string): string {
  return `${fromId}→${toId}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoutingMatrix() {
  // React-visible mirror of BusRouter send enabled/gain state
  const [sendMap, setSendMap] = useState<SendMap>(() => {
    const m: SendMap = new Map()
    for (const s of INIT_SENDS) {
      if (!m.has(s.fromId)) m.set(s.fromId, new Map())
      m.get(s.fromId)!.set(s.toId, { enabled: true, gainDb: s.gainDb })
    }
    return m
  })

  // Live bus levels for column header meters (busId → BusLevel)
  const [busLevels, setBusLevels] = useState<Record<string, BusLevel>>({})
  const rafRef = useRef<number | null>(null)

  // ── Mount: register buses and sends in BusRouter ──────────────────────────

  useEffect(() => {
    const router = getBusRouter()

    // Register all target buses that don't already exist in BusRouter
    for (const tgt of TARGETS) {
      if (!router.getBus(tgt.id)) {
        router.addBus({ id: tgt.id, name: tgt.label, gainDb: 0, pan: 0 })
      }
    }

    // Register sends.  addSend needs real AudioNodes but BusRouter.addSend
    // requires a pre- and post-fader source node.  In the matrix context the
    // underlying track audio nodes may not exist yet (tracks are owned by
    // TrackManager).  We create placeholder PassThrough GainNodes for each
    // source that isn't already wired so the BusRouter graph reflects the
    // intended topology.  When the real TrackManager wires up the same IDs it
    // will call addSend again, replacing these placeholder nodes.
    for (const s of INIT_SENDS) {
      const busTarget = router.getBus(s.toId)
      if (!busTarget) continue   // target bus not registered (e.g. hw-out has no BusChannel)

      // Skip if already registered — don't double-add
      const existingSends = router.getSendState(s.fromId, s.toId)
      if (existingSends !== undefined) continue

      // Create minimal passthrough nodes so BusRouter can wire the GainNode chain
      // These are replaced when the real TrackManager calls addSend for the same pair.
      try {
        // We need an AudioContext to create nodes.
        // BusRouter holds an AudioEngine reference; access its ctx via the engine.
        const ctx = (router as unknown as { engine: { ctx: AudioContext } }).engine.ctx
        const placeholder = ctx.createGain()
        router.addSend(
          { fromId: s.fromId, toId: s.toId, gainDb: s.gainDb, preFader: !s.postFader, enabled: true },
          placeholder,  // pre-fader source
          placeholder,  // post-fader source (same placeholder; real nodes wired by TrackManager)
        )
      } catch {
        // AudioContext unavailable (SSR / test) — skip silently
      }
    }
  }, [])

  // ── rAF metering loop at ~30 fps ──────────────────────────────────────────

  const startMetering = useCallback(() => {
    let lastFrame = 0
    const INTERVAL_MS = 1000 / 30   // 30 fps

    const loop = (ts: number) => {
      if (ts - lastFrame >= INTERVAL_MS) {
        lastFrame = ts
        const levels = getBusRouter().getAllBusLevels()
        setBusLevels(levels)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  useEffect(() => {
    startMetering()
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [startMetering])

  // ── Toggle handler ────────────────────────────────────────────────────────

  function toggle(fromId: string, toId: string) {
    const router   = getBusRouter()
    const current  = sendMap.get(fromId)?.get(toId)
    const nowEnabled = !(current?.enabled ?? false)

    if (current !== undefined) {
      // Send exists in BusRouter — toggle it
      router.setSendEnabled(fromId, toId, nowEnabled)
    } else {
      // New send: attempt to add to BusRouter
      const busTarget = router.getBus(toId)
      if (busTarget) {
        try {
          const ctx = (router as unknown as { engine: { ctx: AudioContext } }).engine.ctx
          const placeholder = ctx.createGain()
          const gainDb = 0
          router.addSend(
            { fromId, toId, gainDb, preFader: false, enabled: true },
            placeholder,
            placeholder,
          )
        } catch {
          // Audio context unavailable
        }
      }
    }

    setSendMap(prev => {
      const next = new Map(prev)
      if (!next.has(fromId)) next.set(fromId, new Map())
      const inner = new Map(next.get(fromId)!)
      const existing = inner.get(toId)
      inner.set(toId, { enabled: nowEnabled, gainDb: existing?.gainDb ?? 0 })
      next.set(fromId, inner)
      return next
    })
  }

  // ── Gain slider handler ───────────────────────────────────────────────────

  function handleGainChange(fromId: string, toId: string, gainDb: number) {
    getBusRouter().setSendGain(fromId, toId, gainDb)
    setSendMap(prev => {
      const next  = new Map(prev)
      const inner = new Map(next.get(fromId) ?? new Map<string, SendState>())
      const cur   = inner.get(toId)
      inner.set(toId, { enabled: cur?.enabled ?? true, gainDb })
      next.set(fromId, inner)
      return next
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getState(fromId: string, toId: string): SendState | undefined {
    return sendMap.get(fromId)?.get(toId)
  }

  /** Render a small dBFS bar (0–1 normalised height) for the bus column header. */
  function renderLevelBar(busId: string) {
    const lvl = busLevels[busId]
    if (!lvl) return null
    // Map dbfs range -60..0 to 0..1 for bar height
    const dbfs      = Math.max(-60, Math.min(0, lvl.dbfs))
    const fraction  = (dbfs + 60) / 60      // 0 = silence, 1 = 0 dBFS
    const isClip    = lvl.peak >= 1.0
    return (
      <div className="w-4 mx-auto mt-1" style={{ height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
        <div
          style={{
            height:        `${fraction * 100}%`,
            marginTop:     `${(1 - fraction) * 100}%`,
            background:    isClip ? '#ef4444' : '#22d3ee',
            borderRadius:  2,
            transition:    'height 0.05s linear',
          }}
        />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#08080f' }}>
      {/* Header */}
      <div className="flex items-center px-4 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#334155' }}>Routing Matrix</span>
        <span className="ml-3 text-[10px]" style={{ color: '#1c1c2e' }}>Click cell to toggle · scroll for gain</span>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto p-6">
        <div className="inline-block">
          {/* Column headers (targets) with live level meters */}
          <div className="flex">
            {/* Corner */}
            <div style={{ width: 100, minWidth: 100 }} />
            {TARGETS.map(t => (
              <div key={t.id}
                className="flex flex-col items-center pb-1"
                style={{ width: 64, minWidth: 64 }}>
                {/* Level bar */}
                {renderLevelBar(t.id)}
                {/* Label */}
                <div
                  className="text-[10px] font-medium text-center"
                  style={{
                    color:        KIND_COLOR[t.kind],
                    writingMode:  'vertical-lr',
                    transform:    'rotate(180deg)',
                    height:       48,
                    marginTop:    4,
                  }}>
                  {t.label}
                </div>
              </div>
            ))}
          </div>

          {/* Rows (sources) */}
          {SOURCES.map(src => (
            <div key={src.id} className="flex items-center">
              {/* Row header */}
              <div
                className="text-[10px] font-medium text-right pr-3 shrink-0"
                style={{ width: 100, color: KIND_COLOR[src.kind] }}
              >
                {src.label}
              </div>

              {/* Cells */}
              {TARGETS.map(tgt => {
                const state    = getState(src.id, tgt.id)
                const active   = state?.enabled ?? false
                const gainDb   = state?.gainDb  ?? 0
                const canRoute = src.id !== tgt.id && src.kind !== 'hardware'
                return (
                  <button
                    key={tgt.id}
                    disabled={!canRoute}
                    onClick={() => toggle(src.id, tgt.id)}
                    className="flex flex-col items-center justify-center transition-all m-0.5 rounded"
                    style={{
                      width:      60,
                      height:     36,
                      background: active
                        ? `${KIND_COLOR[tgt.kind]}20`
                        : canRoute ? 'rgba(255,255,255,0.02)' : 'transparent',
                      border:     active
                        ? `1px solid ${KIND_COLOR[tgt.kind]}60`
                        : canRoute ? '1px solid #13131f' : '1px solid transparent',
                      boxShadow:  active ? `0 0 8px ${KIND_COLOR[tgt.kind]}20` : 'none',
                      cursor:     canRoute ? 'pointer' : 'default',
                    }}
                  >
                    {active && (
                      <div className="flex flex-col items-center gap-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[tgt.kind] }} />
                        {gainDb !== 0 && (
                          <span className="text-[8px] font-mono leading-none mt-0.5" style={{ color: KIND_COLOR[tgt.kind] }}>
                            {gainDb > 0 ? '+' : ''}{gainDb}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {/* Gain sliders — one row per active send */}
          <div className="mt-4 flex flex-col gap-1">
            {SOURCES.flatMap(src =>
              TARGETS.map(tgt => {
                const state = getState(src.id, tgt.id)
                if (!state?.enabled) return null
                const key = sendKey(src.id, tgt.id)
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[9px] w-28 text-right shrink-0" style={{ color: KIND_COLOR[src.kind] }}>
                      {src.label}
                    </span>
                    <span className="text-[9px]" style={{ color: '#334155' }}>→</span>
                    <span className="text-[9px] w-12 shrink-0" style={{ color: KIND_COLOR[tgt.kind] }}>
                      {tgt.label}
                    </span>
                    <input
                      type="range"
                      min={-60}
                      max={12}
                      step={0.5}
                      value={state.gainDb}
                      onChange={e => handleGainChange(src.id, tgt.id, parseFloat(e.target.value))}
                      className="flex-1 h-1 accent-cyan-400"
                      style={{ minWidth: 80 }}
                    />
                    <span className="text-[9px] font-mono w-8 text-right" style={{ color: '#475569' }}>
                      {state.gainDb > 0 ? '+' : ''}{state.gainDb.toFixed(1)}
                    </span>
                  </div>
                )
              }).filter(Boolean)
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap gap-4">
          {Object.entries(KIND_COLOR).map(([kind, color]) => (
            <div key={kind} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-[10px] capitalize" style={{ color: '#475569' }}>{kind}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-4 rounded border flex items-center justify-center" style={{ border: '1px solid #7c3aed60', background: 'rgba(124,58,237,0.15)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-studio-purple" />
            </div>
            <span className="text-[10px]" style={{ color: '#475569' }}>Active connection</span>
          </div>
        </div>
      </div>
    </div>
  )
}
