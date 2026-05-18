import { useProjectStore } from '../../store/projectStore'
import type { Track } from '../../types/project'

export default function MixerView() {
  const { project, toggleMute, toggleSolo, setTrackGain, setTrackPan } = useProjectStore()

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: '#08080f' }}
    >
      {/* Header */}
      <div className="flex items-center px-4 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#334155' }}>Mixer</span>
      </div>

      {/* Channel strips */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-px p-3" style={{ background: '#0a0a0f' }}>
          {project.tracks.map(track => (
            <ChannelStrip
              key={track.id}
              track={track}
              onMute={() => toggleMute(track.id)}
              onSolo={() => toggleSolo(track.id)}
              onGain={(db) => setTrackGain(track.id, db)}
              onPan={(p) => setTrackPan(track.id, p)}
            />
          ))}

          {/* Master */}
          <MasterStrip gainDb={project.masterGainDb} />
        </div>
      </div>
    </div>
  )
}

function ChannelStrip({ track, onMute, onSolo, onGain, onPan }: {
  track: Track
  onMute: () => void
  onSolo: () => void
  onGain: (db: number) => void
  onPan: (p: number) => void
}) {
  const faderPct = dbToFaderPct(track.gainDb)

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 shrink-0"
      style={{ width: 72, background: '#0f0f1a', border: '1px solid #1c1c2e' }}
    >
      {/* Track name */}
      <p
        className="text-[10px] font-semibold uppercase tracking-wide text-center truncate w-full"
        style={{ color: track.color }}
      >
        {track.name}
      </p>

      {/* FX placeholder */}
      <div className="w-full h-6 rounded-md flex items-center justify-center text-[9px] cursor-pointer hover:bg-white/5 transition-colors"
        style={{ border: '1px dashed #1c1c2e', color: '#334155' }}>
        + FX
      </div>

      {/* Pan knob */}
      <div className="relative">
        <Knob value={track.panCenter} min={-1} max={1} onChange={onPan} color={track.color} size={32} />
        <p className="text-[9px] text-center mt-0.5" style={{ color: '#334155' }}>
          {track.panCenter === 0 ? 'C' : track.panCenter > 0 ? `R${Math.round(track.panCenter * 50)}` : `L${Math.round(-track.panCenter * 50)}`}
        </p>
      </div>

      {/* VU + Fader */}
      <div className="flex gap-1 flex-1 items-end w-full">
        {/* VU meter */}
        <VUMeter level={track.muted ? 0 : 0.4 + Math.random() * 0.4} color={track.color} />

        {/* Fader */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <Fader value={faderPct} onChange={(pct) => onGain(faderPctToDb(pct))} color={track.color} />
          <span className="text-[9px] font-mono tabular-nums" style={{ color: '#475569' }}>
            {track.gainDb === 0 ? '0.0' : track.gainDb.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-1 w-full">
        <MixBtn active={track.muted}  onClick={onMute}  activeColor="#f59e0b" label="M" />
        <MixBtn active={track.soloed} onClick={onSolo}  activeColor="#06b6d4" label="S" />
      </div>
    </div>
  )
}

function MasterStrip({ gainDb }: { gainDb: number }) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 shrink-0 ml-2"
      style={{ width: 72, background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.2)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: '#7c3aed' }}>
        Master
      </p>
      <div className="w-full h-6" />
      <div className="relative">
        <Knob value={0} min={-1} max={1} onChange={() => {}} color="#7c3aed" size={32} />
        <p className="text-[9px] text-center mt-0.5" style={{ color: '#334155' }}>C</p>
      </div>
      <div className="flex gap-1 flex-1 items-end w-full">
        <VUMeter level={0.7} color="#7c3aed" master />
        <div className="flex-1 flex flex-col items-center gap-1">
          <Fader value={dbToFaderPct(gainDb)} onChange={() => {}} color="#7c3aed" />
          <span className="text-[9px] font-mono tabular-nums" style={{ color: '#475569' }}>0.0</span>
        </div>
      </div>
      <div className="h-6" />
    </div>
  )
}

function Knob({ value, min, max, onChange, color, size }: {
  value: number; min: number; max: number; onChange: (v: number) => void; color: string; size: number
}) {
  const pct  = (value - min) / (max - min)
  const deg  = -135 + pct * 270
  return (
    <div
      className="rounded-full cursor-pointer relative flex items-center justify-center"
      style={{
        width: size, height: size,
        background:   `conic-gradient(${color}40, ${color}15, ${color}40)`,
        border:        `2px solid ${color}40`,
        boxShadow:     `0 0 8px ${color}20`,
      }}
      onWheel={e => {
        const range = max - min
        const step  = range / 100
        onChange(Math.max(min, Math.min(max, value + (e.deltaY < 0 ? step : -step))))
      }}
    >
      <div className="absolute w-1 rounded-full" style={{
        height:           '40%',
        background:       color,
        transformOrigin:  'bottom center',
        bottom:           '50%',
        left:             'calc(50% - 2px)',
        transform:        `rotate(${deg}deg)`,
      }} />
    </div>
  )
}

function Fader({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const height = 100
  const thumbY = height - (value * height)
  return (
    <div
      className="relative rounded-full cursor-ns-resize"
      style={{ width: 6, height, background: '#1c1c2e' }}
      onWheel={e => onChange(Math.max(0, Math.min(1, value + (e.deltaY < 0 ? 0.02 : -0.02))))}
    >
      {/* Fill */}
      <div className="absolute bottom-0 left-0 right-0 rounded-full" style={{ height: `${value * 100}%`, background: `${color}40` }} />
      {/* Thumb */}
      <div
        className="absolute left-1/2 rounded-sm shadow"
        style={{
          width: 16, height: 6,
          background:    color,
          transform:     'translateX(-50%)',
          top:           thumbY - 3,
          boxShadow:     `0 0 6px ${color}80`,
        }}
      />
    </div>
  )
}

function VUMeter({ level, color, master = false }: { level: number; color: string; master?: boolean }) {
  const bars   = master ? 24 : 16
  const active = Math.round(level * bars)
  return (
    <div className="flex flex-col-reverse gap-px" style={{ height: 100 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const on  = i < active
        const hot = i > bars * 0.85
        return (
          <div
            key={i}
            className="rounded-sm"
            style={{
              flex:       1,
              background: on
                ? hot ? '#ef4444' : i > bars * 0.6 ? '#f59e0b' : color
                : '#1c1c2e',
              opacity:    on ? 1 : 0.3,
            }}
          />
        )
      })}
    </div>
  )
}

function MixBtn({ active, onClick, activeColor, label }: {
  active: boolean; onClick: () => void; activeColor: string; label: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 h-5 rounded text-[9px] font-bold transition-all"
      style={{
        background: active ? `${activeColor}25` : 'rgba(255,255,255,0.04)',
        color:      active ? activeColor : '#334155',
        border:     `1px solid ${active ? activeColor + '50' : '#1c1c2e'}`,
      }}
    >
      {label}
    </button>
  )
}

function dbToFaderPct(db: number): number {
  if (db <= -60) return 0
  return (db + 60) / 66
}

function faderPctToDb(pct: number): number {
  return pct * 66 - 60
}
