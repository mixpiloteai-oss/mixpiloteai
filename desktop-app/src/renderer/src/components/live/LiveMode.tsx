import { useState } from 'react'

const COLS = 8
const ROWS = 6

const CLIP_COLORS = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#a855f7','#ec4899','#14b8a6']

const TRACK_NAMES = ['Kick','Bass','Lead','Chords','Pad','FX']

const INITIAL_CLIPS: (string | null)[][] = [
  ['Kick A', 'Kick B', 'Kick C', null,      null,      null,      null, null],
  ['Bass 1', 'Bass 2', null,     'Bass Arp', null,      null,      null, null],
  ['Acid A', null,     'Acid B', 'Acid C',   null,      'Acid D',  null, null],
  ['Dm7',    'Am7',    'Gm7',    null,       'Full',    null,      null, null],
  ['Pad',    null,     null,     null,        null,     null,      null, null],
  ['Riser',  'Impact', null,     'Fx Hit',    null,     null,      null, null],
]

export default function LiveMode() {
  const [active, setActive] = useState<[number, number] | null>([0, 0])
  const [bpm, setBpm] = useState(145)

  function toggle(row: number, col: number) {
    if (INITIAL_CLIPS[row][col] === null) return
    setActive(prev => (prev && prev[0] === row && prev[1] === col) ? null : [row, col])
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#08080f' }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-4 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#334155' }}>Live Mode</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setBpm(b => Math.max(60, b - 1))} className="text-studio-muted hover:text-studio-text w-5 h-5 flex items-center justify-center rounded hover:bg-white/5 transition-colors text-xs">−</button>
            <span className="font-mono text-xs tabular-nums px-2 py-0.5 rounded"
              style={{ background: '#06060d', border: '1px solid #1c1c2e', color: '#e2e8f0', minWidth: 50, textAlign: 'center' }}>
              {bpm} BPM
            </span>
            <button onClick={() => setBpm(b => Math.min(250, b + 1))} className="text-studio-muted hover:text-studio-text w-5 h-5 flex items-center justify-center rounded hover:bg-white/5 transition-colors text-xs">+</button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-auto p-4 gap-4">
        {/* Clip grid */}
        <div className="flex-1">
          {/* Scene headers */}
          <div className="flex gap-1 mb-1 pl-20">
            {Array.from({ length: COLS }).map((_, ci) => (
              <div key={ci} className="flex-1 text-center text-[9px] font-mono" style={{ color: '#1c1c2e' }}>
                S{ci + 1}
              </div>
            ))}
          </div>

          {/* Rows */}
          {INITIAL_CLIPS.map((row, ri) => (
            <div key={ri} className="flex items-center gap-1 mb-1">
              {/* Track label */}
              <div
                className="w-16 shrink-0 text-[10px] font-semibold text-right pr-2 truncate"
                style={{ color: CLIP_COLORS[ri % CLIP_COLORS.length] }}
              >
                {TRACK_NAMES[ri]}
              </div>

              {/* Clips */}
              {row.map((name, ci) => {
                const isActive = active?.[0] === ri && active?.[1] === ci
                const color    = CLIP_COLORS[ri % CLIP_COLORS.length]
                const empty    = name === null
                return (
                  <button
                    key={ci}
                    onClick={() => toggle(ri, ci)}
                    disabled={empty}
                    className="flex-1 aspect-square rounded-lg flex flex-col items-center justify-center text-[9px] font-medium transition-all duration-100"
                    style={{
                      background: empty
                        ? 'rgba(255,255,255,0.02)'
                        : isActive
                          ? `${color}30`
                          : `${color}12`,
                      border: empty
                        ? '1px solid rgba(255,255,255,0.04)'
                        : `1px solid ${isActive ? color : color + '40'}`,
                      color:  empty ? '#1c1c2e' : isActive ? color : color + 'aa',
                      boxShadow: isActive ? `0 0 12px ${color}40` : 'none',
                    }}
                  >
                    {!empty && (
                      <>
                        <span className="text-base leading-none mb-0.5">{isActive ? '▶' : '▷'}</span>
                        <span className="leading-none text-center px-0.5 truncate w-full text-center">{name}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Scene launch column */}
        <div className="flex flex-col gap-1 shrink-0 w-16">
          <div className="text-[9px] font-semibold uppercase text-center mb-1" style={{ color: '#334155' }}>Scene</div>
          {Array.from({ length: ROWS }).map((_, ri) => (
            <button
              key={ri}
              className="flex-1 rounded-lg flex items-center justify-center text-[10px] transition-all"
              style={{
                background:  'rgba(255,255,255,0.04)',
                border:      '1px solid #1c1c2e',
                color:       '#475569',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#7c3aed50'; (e.currentTarget as HTMLElement).style.color = '#7c3aed' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1c1c2e'; (e.currentTarget as HTMLElement).style.color = '#475569' }}
            >
              ▶
            </button>
          ))}
        </div>
      </div>

      {/* Footer — active clips */}
      <div className="flex items-center gap-3 px-4 h-8 shrink-0 text-[10px]"
        style={{ borderTop: '1px solid #1c1c2e', background: '#0c0c14', color: '#334155' }}>
        {active
          ? <><span style={{ color: CLIP_COLORS[active[0]] }}>▶ {TRACK_NAMES[active[0]]}: {INITIAL_CLIPS[active[0]][active[1]]}</span><span className="animate-pulse ml-1">⣾</span></>
          : <span>No clips playing. Click a clip to launch.</span>
        }
      </div>
    </div>
  )
}
