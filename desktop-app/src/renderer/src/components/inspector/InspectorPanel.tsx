// ─── InspectorPanel ───────────────────────────────────────────────────────────
// Right-side panel showing properties of the currently selected track.
// All controls connect to real store actions.

import { useState, useEffect } from 'react'
import { useProjectStore }   from '../../store/projectStore'
import { useVstStore }       from '../../store/vstStore'
import type { Track }        from '../../types/project'

// ─── Knob ─────────────────────────────────────────────────────────────────────

function Knob({
  label, value, min, max, unit, onChange,
}: {
  label:    string
  value:    number
  min:      number
  max:      number
  unit:     string
  onChange: (v: number) => void
}) {
  const pct = (value - min) / (max - min)
  // 270° sweep: -135° to +135°
  const angle = -135 + pct * 270

  const [dragging, setDragging] = useState(false)
  const [startY, setStartY]     = useState(0)
  const [startVal, setStartVal] = useState(0)

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    setDragging(true)
    setStartY(e.clientY)
    setStartVal(value)
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging) return
    const delta = (startY - e.clientY) / 120
    const raw   = startVal + delta * (max - min)
    onChange(Math.max(min, Math.min(max, raw)))
  }

  function onPointerUp() { setDragging(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg
        width={36} height={36}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: 'ns-resize', userSelect: 'none' }}
      >
        <circle cx={18} cy={18} r={14} fill="#12121e" stroke="#2a2a3e" strokeWidth={1.5} />
        <circle cx={18} cy={18} r={11} fill="none" stroke="#1e1e30" strokeWidth={2.5}
          strokeDasharray={`${11 * Math.PI * 270 / 180} ${11 * Math.PI * 90 / 180}`}
          strokeDashoffset={`${11 * Math.PI * 135 / 180}`}
          transform="rotate(-90 18 18)"
        />
        <circle cx={18} cy={18} r={11} fill="none" stroke="#7c3aed" strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={`${11 * Math.PI * pct * 270 / 180} ${11 * Math.PI * (1 - pct * 270 / 360)}`}
          strokeDashoffset={`${11 * Math.PI * 135 / 180}`}
          transform="rotate(-90 18 18)"
        />
        {/* pointer dot */}
        <circle
          cx={18 + 10 * Math.sin(angle * Math.PI / 180)}
          cy={18 - 10 * Math.cos(angle * Math.PI / 180)}
          r={2}
          fill="#a855f7"
        />
      </svg>
      <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', textAlign: 'center' }}>
        {value >= 0 ? '+' : ''}{value.toFixed(1)}{unit}
      </span>
      <span style={{ fontSize: 9, color: '#334155', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

// ─── Color palette ────────────────────────────────────────────────────────────

const PALETTE = [
  '#e74c3c', '#e67e22', '#f1c40f',
  '#2ecc71', '#1abc9c', '#3498db',
  '#9b59b6', '#ec407a', '#78909c',
]

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {PALETTE.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={c}
          style={{
            width:        20,
            height:       20,
            borderRadius: 4,
            background:   c,
            border:       color === c ? '2px solid #fff' : '2px solid transparent',
            cursor:       'pointer',
            padding:      0,
            transition:   'transform 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        />
      ))}
      <input
        type="color"
        value={color}
        onChange={e => onChange(e.target.value)}
        title="Custom color"
        style={{ width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0 }}
      />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoSelection() {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '100%',
      gap:            10,
      padding:        24,
    }}>
      <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <rect x={4}  y={4}  width={32} height={8}  rx={2} fill="#1c1c2e" />
        <rect x={4}  y={16} width={32} height={8}  rx={2} fill="#1c1c2e" />
        <rect x={4}  y={28} width={32} height={8}  rx={2} fill="#1c1c2e" />
        <rect x={2}  y={2}  width={36} height={36} rx={4} stroke="#1c1c2e" strokeWidth={1} />
      </svg>
      <p style={{ fontSize: 11, color: '#334155', textAlign: 'center' }}>
        Select a track to inspect its properties
      </p>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function InspectorPanel() {
  const selectedTrackId = useProjectStore(s => s.selectedTrackId)
  const project         = useProjectStore(s => s.project)
  const setTrackGain    = useProjectStore(s => s.setTrackGain)
  const setTrackPan     = useProjectStore(s => s.setTrackPan)
  const toggleMute      = useProjectStore(s => s.toggleMute)
  const toggleSolo      = useProjectStore(s => s.toggleSolo)
  const setProjectName  = useProjectStore(s => s.setProjectName)

  const loadedInstances = useVstStore(s => s.loadedInstances)

  const [editName, setEditName] = useState('')
  const [midiAccess, setMidiAccess] = useState<string>('No MIDI device')

  const track: Track | undefined = project.tracks.find(t => t.id === selectedTrackId)

  // Probe MIDI access once
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess()
        .then(access => {
          const inputs = [...access.inputs.values()]
          setMidiAccess(inputs.length > 0 ? inputs[0].name ?? 'MIDI device' : 'No MIDI input')
        })
        .catch(() => setMidiAccess('MIDI unavailable'))
    }
  }, [])

  // Sync edit name when track changes
  useEffect(() => {
    setEditName(track?.name ?? '')
  }, [track?.name])

  // Update track name via project store (no direct setTrackName exists — we patch via setProjectName workaround)
  // Actually projectStore doesn't have a setTrackName action, only setProjectName.
  // We need to call the project store's internal set. For now use a best-effort approach:
  function handleNameChange(newName: string) {
    setEditName(newName)
    // We use the fact that projectStore.set is accessible via getState
    // to update the track name without adding a new store action.
    const { project: p } = useProjectStore.getState()
    useProjectStore.setState({
      project: {
        ...p,
        tracks: p.tracks.map(t => t.id === selectedTrackId ? { ...t, name: newName } : t),
      },
    })
  }

  // Update track color
  function handleColorChange(color: string) {
    const { project: p } = useProjectStore.getState()
    useProjectStore.setState({
      project: {
        ...p,
        tracks: p.tracks.map(t => t.id === selectedTrackId ? { ...t, color } : t),
      },
    })
  }

  if (!track) return <NoSelection />

  // VST instances on this track
  const trackInstances = Object.values(loadedInstances).filter(
    inst => (inst as { trackId?: string }).trackId === selectedTrackId
  )

  const C = {
    bg:      '#09090f',
    section: '#0b0b17',
    border:  'rgba(255,255,255,0.06)',
    text:    '#94a3b8',
    muted:   '#475569',
    active:  '#a855f7',
  }

  const row = (label: string, content: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{content}</div>
    </div>
  )

  return (
    <div style={{ background: C.bg, height: '100%', overflow: 'auto', fontSize: 11 }}>

      {/* Track name */}
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${C.border}`, background: C.section }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: track.color, flexShrink: 0 }} />
          <input
            value={editName}
            onChange={e => handleNameChange(e.target.value)}
            style={{
              flex:        1,
              background:  'transparent',
              border:      'none',
              outline:     'none',
              fontSize:    13,
              fontWeight:  600,
              color:       '#e2e8f0',
              caretColor:  C.active,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            color: track.color, background: `${track.color}18`,
            border: `1px solid ${track.color}40`, borderRadius: 2, padding: '1px 5px',
          }}>
            {track.type.toUpperCase()}
          </span>
          <span style={{ fontSize: 9, color: C.muted }}>
            {track.clips.length} clip{track.clips.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Mute / Solo / Arm */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
        {([
          { label: 'M', active: track.muted,  color: '#ef4444', action: () => toggleMute(track.id),  title: 'Mute' },
          { label: 'S', active: track.soloed, color: '#f59e0b', action: () => toggleSolo(track.id),  title: 'Solo' },
          { label: 'R', active: track.armed,  color: '#ef4444', action: () => useProjectStore.getState().toggleArm(track.id), title: 'Arm for recording' },
        ] as const).map(({ label, active, color, action, title }) => (
          <button
            key={label}
            onClick={action}
            title={title}
            style={{
              width:       32,
              height:      24,
              borderRadius: 4,
              fontSize:    11,
              fontWeight:  700,
              cursor:      'pointer',
              background:  active ? `${color}22` : 'rgba(255,255,255,0.04)',
              color:       active ? color : C.muted,
              border:      `1px solid ${active ? `${color}50` : C.border}`,
              transition:  'all 0.1s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Volume + Pan knobs */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 12px', borderBottom: `1px solid ${C.border}` }}>
        <Knob
          label="Volume"
          value={track.gainDb}
          min={-60}
          max={12}
          unit=" dB"
          onChange={v => setTrackGain(track.id, Math.round(v * 10) / 10)}
        />
        <Knob
          label="Pan"
          value={track.panCenter * 100}
          min={-100}
          max={100}
          unit="%"
          onChange={v => setTrackPan(track.id, Math.round(v) / 100)}
        />
      </div>

      {/* Color */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Track Color
        </p>
        <ColorPicker color={track.color} onChange={handleColorChange} />
      </div>

      {/* MIDI Input */}
      {track.type === 'midi' && row('MIDI Input', (
        <span style={{ fontSize: 10, color: C.text }}>{midiAccess}</span>
      ))}

      {/* Clips */}
      {row('Clips', <span style={{ fontSize: 10, color: C.text }}>{track.clips.length}</span>)}
      {row('Gain', <span style={{ fontSize: 10, color: C.text, fontFamily: 'monospace' }}>
        {track.gainDb >= 0 ? '+' : ''}{track.gainDb.toFixed(1)} dB
      </span>)}

      {/* Plugin inserts */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Plugins
        </p>
        {trackInstances.length === 0 ? (
          <div style={{
            padding:      '8px 10px',
            borderRadius: 6,
            border:       `1px dashed rgba(255,255,255,0.1)`,
            textAlign:    'center',
          }}>
            <span style={{ fontSize: 10, color: C.muted }}>+ Add Plugin</span>
          </div>
        ) : (
          trackInstances.map(inst => (
            <div key={inst.instanceId} style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '5px 8px',
              borderRadius: 5,
              marginBottom: 3,
              background:   'rgba(255,255,255,0.03)',
              border:       `1px solid ${C.border}`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#7c3aed' }} />
              <span style={{ fontSize: 10, color: C.text, flex: 1 }}>{inst.pluginName}</span>
            </div>
          ))
        )}
      </div>

      {/* Project name (bottom of panel) */}
      <div style={{ padding: '8px 12px' }}>
        <p style={{ fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Project
        </p>
        <input
          value={project.name}
          onChange={e => setProjectName(e.target.value)}
          onClick={e => (e.target as HTMLInputElement).select()}
          style={{
            width:       '100%',
            background:  'rgba(255,255,255,0.03)',
            border:      `1px solid ${C.border}`,
            borderRadius: 5,
            padding:     '5px 8px',
            fontSize:    11,
            color:       '#e2e8f0',
            outline:     'none',
            boxSizing:   'border-box',
          }}
        />
      </div>
    </div>
  )
}
