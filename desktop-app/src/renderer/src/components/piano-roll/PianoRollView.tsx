import { useState } from 'react'

const KEYS_W   = 48
const NOTE_H   = 14
const BEAT_W   = 60
const BEATS    = 32  // 8 bars × 4 beats

const NOTES = ['B','A#','A','G#','G','F#','F','E','D#','D','C#','C']
const OCTAVES = [6, 5, 4, 3]

const SEED_NOTES: { pitch: number; startBeat: number; lengthBeats: number; velocity: number }[] = [
  { pitch: 62, startBeat: 0,   lengthBeats: 1,   velocity: 100 },
  { pitch: 65, startBeat: 1,   lengthBeats: 0.5, velocity: 90  },
  { pitch: 67, startBeat: 2,   lengthBeats: 1,   velocity: 95  },
  { pitch: 69, startBeat: 4,   lengthBeats: 2,   velocity: 85  },
  { pitch: 65, startBeat: 6,   lengthBeats: 0.5, velocity: 92  },
  { pitch: 62, startBeat: 8,   lengthBeats: 1,   velocity: 100 },
  { pitch: 60, startBeat: 10,  lengthBeats: 2,   velocity: 88  },
  { pitch: 62, startBeat: 12,  lengthBeats: 0.5, velocity: 95  },
  { pitch: 64, startBeat: 13,  lengthBeats: 0.5, velocity: 90  },
  { pitch: 65, startBeat: 14,  lengthBeats: 2,   velocity: 100 },
]

function pitchToRow(pitch: number): number {
  return (OCTAVES.length * 12) - 1 - (pitch - (OCTAVES[OCTAVES.length - 1] * 12))
}

function isBlackKey(name: string): boolean {
  return name.includes('#')
}

export default function PianoRollView() {
  const [tool, setTool] = useState<'pointer' | 'pencil' | 'erase'>('pencil')
  const [quantize, setQuantize] = useState('1/16')
  const totalNotes = OCTAVES.length * 12

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#08080f' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
        <span className="text-xs font-semibold uppercase tracking-widest mr-2" style={{ color: '#334155' }}>Piano Roll</span>

        {/* Tools */}
        <div className="flex gap-0.5">
          {(['pointer', 'pencil', 'erase'] as const).map(t => (
            <button key={t} onClick={() => setTool(t)}
              className="px-2 py-1 rounded text-[10px] capitalize transition-all"
              style={{
                background: tool === t ? 'rgba(124,58,237,0.2)' : 'transparent',
                color:      tool === t ? '#a855f7' : '#475569',
                border:     `1px solid ${tool === t ? 'rgba(124,58,237,0.35)' : 'transparent'}`,
              }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: '#1c1c2e' }} />

        {/* Quantize */}
        <select
          value={quantize}
          onChange={e => setQuantize(e.target.value)}
          className="text-[10px] px-1.5 py-0.5 rounded outline-none"
          style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#64748b' }}
        >
          {['1/4','1/8','1/16','1/32'].map(q => <option key={q}>{q}</option>)}
        </select>
        <span className="text-[10px]" style={{ color: '#334155' }}>Quantize</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Piano keys */}
        <div className="shrink-0 overflow-y-auto" style={{ width: KEYS_W, background: '#06060d', borderRight: '1px solid #1c1c2e' }}>
          {OCTAVES.flatMap(oct =>
            NOTES.map(note => {
              const black = isBlackKey(note)
              const label = `${note}${oct}`
              return (
                <div
                  key={label}
                  title={label}
                  className="flex items-center justify-end pr-1 cursor-pointer transition-colors"
                  style={{
                    height:     NOTE_H,
                    background: black ? '#0a0a12' : '#10101a',
                    borderBottom: '1px solid #1c1c2e',
                    color:        black ? '#334155' : '#475569',
                    fontSize:     9,
                  }}
                >
                  {note === 'C' && <span style={{ color: '#7c3aed', fontSize: 9 }}>{label}</span>}
                </div>
              )
            })
          )}
        </div>

        {/* Grid + notes */}
        <div className="flex-1 overflow-auto relative">
          <div style={{ width: BEATS * BEAT_W, height: totalNotes * NOTE_H, position: 'relative' }}>
            {/* Row backgrounds */}
            {OCTAVES.flatMap(oct =>
              NOTES.map((note, ni) => {
                const rowIdx = OCTAVES.indexOf(oct) * 12 + ni
                return (
                  <div key={`${note}${oct}`}
                    className="absolute"
                    style={{
                      top:        rowIdx * NOTE_H,
                      left:       0,
                      right:      0,
                      height:     NOTE_H,
                      background: isBlackKey(note) ? 'rgba(0,0,0,0.25)' : 'transparent',
                      borderBottom: '1px solid #13131f',
                    }}
                  />
                )
              })
            )}

            {/* Beat grid */}
            {Array.from({ length: BEATS }).map((_, i) => (
              <div key={i} className="absolute top-0 bottom-0" style={{
                left:       i * BEAT_W,
                width:      1,
                background: i % 4 === 0 ? '#1c1c2e' : '#13131f',
              }} />
            ))}

            {/* Notes */}
            {SEED_NOTES.map((n, i) => {
              const row = pitchToRow(n.pitch)
              if (row < 0 || row >= totalNotes) return null
              return (
                <div key={i}
                  className="absolute rounded-sm cursor-pointer"
                  style={{
                    top:          row * NOTE_H + 1,
                    left:         n.startBeat * BEAT_W + 1,
                    width:        n.lengthBeats * BEAT_W - 2,
                    height:       NOTE_H - 2,
                    background:   `rgba(124,58,237,${0.5 + n.velocity / 255})`,
                    border:       '1px solid rgba(168,85,247,0.6)',
                    boxShadow:    '0 0 4px rgba(124,58,237,0.3)',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Velocity lane */}
      <div className="shrink-0 flex" style={{ height: 48, borderTop: '1px solid #1c1c2e', background: '#08080f' }}>
        <div style={{ width: KEYS_W, borderRight: '1px solid #1c1c2e', background: '#06060d', color: '#334155' }}
          className="flex items-center justify-center text-[9px]">
          VEL
        </div>
        <div className="flex-1 flex items-end gap-1 px-2 pb-1 overflow-hidden">
          {SEED_NOTES.map((n, i) => (
            <div key={i} className="rounded-t-sm" style={{
              width:      Math.max(3, n.lengthBeats * BEAT_W - 2),
              height:     `${(n.velocity / 127) * 100}%`,
              background: 'rgba(124,58,237,0.5)',
              border:     '1px solid rgba(168,85,247,0.4)',
              minHeight:  4,
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
