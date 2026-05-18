import { usePianoRollStore } from './usePianoRollStore'
import type { AutomationParam } from './types'

const LANE_H = 32

function AutoLane({ param }: { param: AutomationParam }) {
  const toggle = usePianoRollStore(s => s.toggleAutoParam)

  return (
    <div
      className="flex items-center"
      style={{
        height:       LANE_H,
        borderTop:    '1px solid #12121f',
        background:   param.visible ? '#0a0a14' : '#080810',
        overflow:     'hidden',
      }}
    >
      {/* Label / toggle */}
      <button
        onClick={() => toggle(param.id)}
        className="shrink-0 flex items-center gap-1.5 px-2 h-full transition-colors"
        style={{
          width:       140,
          borderRight: '1px solid #12121f',
          background:  '#06060c',
          color:       param.visible ? param.color : '#2a2a3e',
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: param.visible ? param.color : '#1a1a28' }}
        />
        <span className="text-[9px] uppercase tracking-wider font-semibold truncate">
          {param.label}
        </span>
        <span className="ml-auto text-[9px]" style={{ color: '#2a2a3e' }}>
          {param.visible ? '▾' : '▸'}
        </span>
      </button>

      {/* Lane content */}
      {param.visible ? (
        <div className="flex-1 h-full relative overflow-hidden">
          {/* Flat baseline (no automation data yet) */}
          <div
            className="absolute left-0 right-0"
            style={{
              top:        LANE_H / 2 - 0.5,
              height:     1,
              background: `${param.color}28`,
            }}
          />
          {/* "Add automation" hint */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ pointerEvents: 'none' }}
          >
            <span
              className="text-[8px] uppercase tracking-widest"
              style={{ color: `${param.color}30` }}
            >
              Draw automation here
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 h-full flex items-center px-3">
          <span className="text-[8px]" style={{ color: '#1a1a28' }}>—</span>
        </div>
      )}
    </div>
  )
}

export default function AutomationLanes() {
  const params = usePianoRollStore(s => s.autoParams)
  const anyVisible = params.some(p => p.visible)

  return (
    <div style={{ borderTop: '1px solid #1a1a2e', background: '#07070e' }}>
      {/* Section header */}
      <div
        className="flex items-center gap-2 px-3"
        style={{
          height:      22,
          borderBottom: '1px solid #111120',
          background:   '#05050b',
        }}
      >
        <span className="text-[8px] uppercase tracking-widest font-semibold" style={{ color: '#1e1e30' }}>
          Automation
        </span>
        {!anyVisible && (
          <span className="text-[8px]" style={{ color: '#14142a' }}>
            · click a lane to add
          </span>
        )}
      </div>

      {params.map(p => (
        <AutoLane key={p.id} param={p} />
      ))}
    </div>
  )
}
