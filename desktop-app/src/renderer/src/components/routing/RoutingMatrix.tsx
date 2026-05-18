import { useState } from 'react'
import type { RoutingNode, RoutingConnection } from '../../types/audio'

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

const INIT_CONNECTIONS: RoutingConnection[] = [
  { fromId: 'kick',   toId: 'bus-a',  gainDb: 0,  enabled: true  },
  { fromId: 'bass',   toId: 'bus-a',  gainDb: 0,  enabled: true  },
  { fromId: 'lead',   toId: 'bus-b',  gainDb: 0,  enabled: true  },
  { fromId: 'chords', toId: 'bus-b',  gainDb: 0,  enabled: true  },
  { fromId: 'pad',    toId: 'master', gainDb: -6, enabled: true  },
  { fromId: 'fx',     toId: 'rev',    gainDb: -3, enabled: true  },
  { fromId: 'lead',   toId: 'rev',    gainDb: -6, enabled: true  },
  { fromId: 'bus-a',  toId: 'master', gainDb: 0,  enabled: true  },
  { fromId: 'bus-b',  toId: 'master', gainDb: 0,  enabled: true  },
  { fromId: 'rev',    toId: 'master', gainDb: -6, enabled: true  },
  { fromId: 'master', toId: 'hw-out', gainDb: 0,  enabled: true  },
]

function getConnection(connections: RoutingConnection[], from: string, to: string): RoutingConnection | undefined {
  return connections.find(c => c.fromId === from && c.toId === to)
}

const KIND_COLOR: Record<string, string> = {
  track:    '#7c3aed',
  bus:      '#06b6d4',
  master:   '#a855f7',
  hardware: '#f59e0b',
}

export default function RoutingMatrix() {
  const [connections, setConnections] = useState<RoutingConnection[]>(INIT_CONNECTIONS)

  function toggle(from: string, to: string) {
    const existing = getConnection(connections, from, to)
    if (existing) {
      setConnections(cs => cs.map(c =>
        c.fromId === from && c.toId === to ? { ...c, enabled: !c.enabled } : c
      ))
    } else {
      setConnections(cs => [...cs, { fromId: from, toId: to, gainDb: 0, enabled: true }])
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#08080f' }}>
      {/* Header */}
      <div className="flex items-center px-4 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#334155' }}>Routing Matrix</span>
        <span className="ml-3 text-[10px]" style={{ color: '#1c1c2e' }}>Click cell to toggle connection</span>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto p-6">
        <div className="inline-block">
          {/* Column headers (targets) */}
          <div className="flex">
            {/* Corner */}
            <div style={{ width: 100, minWidth: 100 }} />
            {TARGETS.map(t => (
              <div key={t.id}
                className="text-[10px] font-medium text-center pb-2"
                style={{ width: 64, minWidth: 64, color: KIND_COLOR[t.kind], writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: 80 }}>
                {t.label}
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
                const conn    = getConnection(connections, src.id, tgt.id)
                const active  = conn?.enabled ?? false
                const canRoute = src.id !== tgt.id && !(src.kind === 'hardware')
                return (
                  <button
                    key={tgt.id}
                    disabled={!canRoute}
                    onClick={() => toggle(src.id, tgt.id)}
                    className="flex items-center justify-center transition-all m-0.5 rounded"
                    style={{
                      width:      60,
                      height:     32,
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
                      <div className="flex items-center gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[tgt.kind] }} />
                        {conn && conn.gainDb !== 0 && (
                          <span className="text-[8px] font-mono" style={{ color: KIND_COLOR[tgt.kind] }}>
                            {conn.gainDb > 0 ? '+' : ''}{conn.gainDb}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
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
