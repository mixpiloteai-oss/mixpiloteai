import { useRef, useCallback, memo }   from 'react'
import { useProjectStore }             from '../../store/projectStore'
import { useMixerStore }               from './useMixerStore'
import MeterCanvas                     from './MeterCanvas'
import EQCurveCanvas                   from './EQCurveCanvas'
import type { Track }                  from '../../types/project'
import type { MixerBus }               from './useMixerStore'

// ─── Level simulation ─────────────────────────────────────────────────────────

function trackHash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

type LevelFn = () => { rmsL: number; rmsR: number; peakL: number; peakR: number }

function makeTrackLevelFn(track: Track): LevelFn {
  const hash  = trackHash(track.id)
  const f1    = 1 + (hash & 0xFF) / 256 * 3
  const f2    = 4 + ((hash >> 8) & 0xFF) / 256 * 7
  const phase = ((hash >> 16) & 0xFF) / 256 * Math.PI * 2
  // Different phase for R channel for stereo illusion
  const phaseR = phase + 0.3

  return () => {
    if (track.muted) return { rmsL: 0, rmsR: 0, peakL: 0, peakR: 0 }
    const gainLin = track.gainDb <= -60 ? 0 : Math.pow(10, track.gainDb / 20)
    const t  = performance.now() / 1000
    const v1 = Math.abs(Math.sin(t * f1 + phase))
    const v2 = Math.abs(Math.sin(t * f2 + phase * 1.3)) * 0.5
    const v1r = Math.abs(Math.sin(t * f1 + phaseR))
    const v2r = Math.abs(Math.sin(t * f2 + phaseR * 1.3)) * 0.5
    // Pan law
    const panL = Math.cos((track.panCenter + 1) * Math.PI / 4)
    const panR = Math.sin((track.panCenter + 1) * Math.PI / 4)
    const baseL = (v1 + v2)  * 0.67 * gainLin * 0.45 * panL
    const baseR = (v1r + v2r)* 0.67 * gainLin * 0.45 * panR
    const peakL = Math.min(1, baseL * (1 + Math.sin(t * 13.7 + phase) * 0.15))
    const peakR = Math.min(1, baseR * (1 + Math.sin(t * 13.7 + phaseR) * 0.15))
    return { rmsL: Math.min(1, baseL), rmsR: Math.min(1, baseR), peakL, peakR }
  }
}

function makeBusLevelFn(bus: MixerBus): LevelFn {
  const hash  = trackHash(bus.id)
  const f1    = 0.8 + (hash & 0xFF) / 256 * 1.5
  const phase = ((hash >> 16) & 0xFF) / 256 * Math.PI * 2
  return () => {
    if (bus.muted) return { rmsL: 0, rmsR: 0, peakL: 0, peakR: 0 }
    const gainLin = bus.gainDb <= -60 ? 0 : Math.pow(10, bus.gainDb / 20)
    const t   = performance.now() / 1000
    const v   = (Math.abs(Math.sin(t * f1 + phase)) * 0.6 + 0.3) * gainLin * 0.55
    const peak = Math.min(1, v * 1.15)
    return { rmsL: Math.min(1, v), rmsR: Math.min(1, v * 0.97), peakL: peak, peakR: Math.min(1, peak * 0.97) }
  }
}

// ─── Fader helpers ────────────────────────────────────────────────────────────

const UNITY_POS = 0.78   // 0 dB is at 78% of fader travel
const MAX_DB    = 6

export function faderPosToDb(pos: number): number {
  if (pos < 0.001) return -Infinity
  if (pos >= UNITY_POS) return (pos - UNITY_POS) / (1 - UNITY_POS) * MAX_DB
  const t = pos / UNITY_POS
  return 40 * Math.log10(t)   // -∞ to 0
}

export function dbToFaderPos(db: number): number {
  if (!isFinite(db) || db <= -60) return 0
  if (db >= 0) return UNITY_POS + (db / MAX_DB) * (1 - UNITY_POS)
  const t = Math.pow(10, db / 40)
  return t * UNITY_POS
}

// ─── Micro components ─────────────────────────────────────────────────────────

function MixBtn({
  label, title, active, activeColor, onClick,
}: { label: string; title: string; active: boolean; activeColor: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 20, height: 16, borderRadius: 3, fontSize: 8, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.1s',
        border:     `1px solid ${active ? activeColor + '60' : 'rgba(255,255,255,0.06)'}`,
        background: active ? `${activeColor}25` : 'rgba(255,255,255,0.04)',
        color:      active ? activeColor : '#334155',
      }}
    >{label}</button>
  )
}

function Fader({
  gainDb, color, height = 130,
  onChange, onReset,
}: { gainDb: number; color: string; height?: number; onChange: (db: number) => void; onReset: () => void }) {
  const TRACK_W  = 4
  const THUMB_W  = 20
  const THUMB_H  = 8
  const dragRef  = useRef<{ y0: number; db0: number } | null>(null)
  const pos      = dbToFaderPos(isFinite(gainDb) ? gainDb : -60)
  const thumbY   = (1 - pos) * (height - THUMB_H)

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { y0: e.clientY, db0: isFinite(gainDb) ? gainDb : -60 }
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const dy    = dragRef.current.y0 - e.clientY  // up = positive
    const scale = e.shiftKey ? 0.1 : 1
    const dDb   = (dy / height) * (60 + MAX_DB) * scale
    const newDb = Math.max(-60, Math.min(MAX_DB, dragRef.current.db0 + dDb))
    onChange(newDb)
  }
  function onUp()    { dragRef.current = null }
  function onDblClk(){ onReset() }

  // Tick marks
  const ticks = [6, 3, 0, -5, -10, -20, -30, -40]

  return (
    <div style={{ position: 'relative', width: THUMB_W + 20, height, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      {/* Scale labels */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 16 }}>
        {ticks.map(db => {
          const p   = dbToFaderPos(db)
          const y   = (1 - p) * (height - THUMB_H) + THUMB_H / 2
          return (
            <div key={db} style={{ position: 'absolute', top: y - 4, right: 0, fontSize: 7, color: db === 0 ? '#94a3b8' : '#2a2a40', lineHeight: 1 }}>
              {db > 0 ? `+${db}` : db}
            </div>
          )
        })}
      </div>

      {/* Track */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onDoubleClick={onDblClk}
        style={{
          position:  'absolute',
          left:      2,
          top:       0,
          width:     TRACK_W,
          height,
          cursor:    'ns-resize',
          display:   'flex',
          alignItems:'stretch',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Rail */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 2, background: '#0d0d1a', border: '1px solid #1a1a2e' }} />
          {/* Fill below thumb (active zone) */}
          <div style={{
            position: 'absolute',
            left: 0, right: 0,
            bottom: 0,
            height:  `${pos * 100}%`,
            background: `${color}35`,
            borderRadius: 2,
          }} />
          {/* Unity mark (0 dB) */}
          <div style={{
            position: 'absolute',
            left: -3, right: -3,
            top: (1 - UNITY_POS) * (height - THUMB_H) + THUMB_H / 2 - 0.5,
            height: 1,
            background: '#475569',
          }} />
        </div>
      </div>

      {/* Thumb */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onDoubleClick={onDblClk}
        style={{
          position:  'absolute',
          left:      0,
          top:       thumbY,
          width:     THUMB_W,
          height:    THUMB_H,
          borderRadius: 2,
          background: `linear-gradient(180deg, #2a2a44 0%, #16162a 100%)`,
          border:     `1px solid ${color}80`,
          boxShadow:  `0 0 6px ${color}40`,
          cursor:     'ns-resize',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap:        2,
          zIndex:     2,
        }}
      >
        {/* Ridges */}
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 1, height: 4, background: `${color}60`, borderRadius: 1 }} />
        ))}
      </div>
    </div>
  )
}

function PanKnob({ pan, color, onChange, onReset }: {
  pan: number; color: string; onChange: (p: number) => void; onReset: () => void
}) {
  const SIZE    = 28
  const dragRef = useRef<{ y0: number; pan0: number } | null>(null)
  const angle   = pan * 135  // -135° to +135°

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { y0: e.clientY, pan0: pan }
    e.stopPropagation()
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const dy   = dragRef.current.y0 - e.clientY
    const delta = e.shiftKey ? dy / 500 : dy / 100
    onChange(Math.max(-1, Math.min(1, dragRef.current.pan0 + delta)))
  }
  function onUp()    { dragRef.current = null }
  function onDblClk(){ onReset() }

  // Draw indicator line
  const rad    = (angle - 90) * Math.PI / 180
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 3
  const ex = cx + r * 0.55 * Math.cos(rad)
  const ey = cy + r * 0.55 * Math.sin(rad)

  return (
    <div title={`Pan: ${pan >= 0 ? 'R' : 'L'}${Math.round(Math.abs(pan) * 100)}  (dblclick reset)`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDblClk}
      style={{
        width: SIZE, height: SIZE, borderRadius: '50%', cursor: 'ns-resize', position: 'relative', flexShrink: 0,
        background: `radial-gradient(circle, #1a1a2e 60%, #0d0d1a 100%)`,
        border: `1px solid ${color}40`,
        boxShadow: `0 0 6px ${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width={SIZE} height={SIZE} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Arc track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2}
          strokeDasharray={`${r * Math.PI * 1.5} ${r * Math.PI * 2}`}
          strokeDashoffset={-r * Math.PI * 0.25}
          strokeLinecap="round"
        />
        {/* Indicator */}
        <line x1={cx} y1={cy} x2={ex} y2={ey}
          stroke={color} strokeWidth={2} strokeLinecap="round" />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={2} fill={color} opacity={0.6} />
      </svg>
    </div>
  )
}

// ─── Sends section ────────────────────────────────────────────────────────────

function SendsSection({ trackId, buses }: { trackId: string; buses: MixerBus[] }) {
  const { getOrCreate, setSend } = useMixerStore()
  const ch = getOrCreate(trackId)

  return (
    <div style={{ padding: '4px 0' }}>
      {ch.sends.map(send => {
        const bus = buses.find(b => b.id === send.busId)
        if (!bus || bus.type === 'master') return null
        return (
          <div key={send.busId} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px' }}>
            <div
              onClick={() => setSend(trackId, send.busId, { enabled: !send.enabled })}
              style={{
                width: 6, height: 6, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                background: send.enabled ? bus.color : '#1a1a2e',
                border: `1px solid ${bus.color}60`,
              }}
            />
            <span style={{ fontSize: 8, color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bus.name}
            </span>
            <span style={{ fontSize: 8, color: send.enabled ? bus.color : '#334155', fontFamily: 'monospace', flexShrink: 0 }}>
              {send.gainDb <= -60 ? '−∞' : `${send.gainDb > 0 ? '+' : ''}${send.gainDb.toFixed(0)}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Insert slots ─────────────────────────────────────────────────────────────

function InsertsSection({ trackId }: { trackId: string }) {
  const { getOrCreate, toggleInsert } = useMixerStore()
  const ch = getOrCreate(trackId)

  return (
    <div style={{ padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {[0, 1, 2, 3].map(i => {
        const ins = ch.inserts[i]
        return (
          <div key={i}
            onClick={ins ? () => toggleInsert(trackId, ins.id) : undefined}
            style={{
              height:     14,
              borderRadius: 2,
              fontSize:   8,
              display:    'flex',
              alignItems: 'center',
              paddingLeft: 4,
              cursor:     ins ? 'pointer' : 'default',
              background: ins ? (ins.enabled ? `${ins.color}22` : 'rgba(255,255,255,0.03)') : 'rgba(255,255,255,0.02)',
              border:     `1px solid ${ins ? (ins.enabled ? ins.color + '50' : '#1a1a2e') : '#12121f'}`,
              color:      ins ? (ins.enabled ? ins.color : '#334155') : '#1a1a2e',
              overflow:   'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ins?.name ?? '—'}
          </div>
        )
      })}
    </div>
  )
}

// ─── Strip section header ──────────────────────────────────────────────────────

function SectionLabel({ label, color: _color }: { label: string; color: string }) {
  return (
    <div style={{
      fontSize: 7, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
      color: '#2a2a40', borderBottom: '1px solid #12121f',
      padding: '2px 6px',
    }}>
      {label}
    </div>
  )
}

// ─── Track ChannelStrip ───────────────────────────────────────────────────────

interface TrackStripProps {
  track:      Track
  channelNum: number
  levelFn:   LevelFn
}

const TrackChannelStrip = memo(function TrackChannelStrip({ track, channelNum, levelFn }: TrackStripProps) {
  const { toggleMute, toggleSolo, toggleArm, setTrackGain, setTrackPan } = useProjectStore()
  const { buses, getOrCreate, setEQEnabled, toggleSection: _toggleSection } = useMixerStore()
  const ch = getOrCreate(track.id)

  const handleGain    = useCallback((db: number) => setTrackGain(track.id, db), [track.id, setTrackGain])
  const handlePan     = useCallback((p: number)  => setTrackPan(track.id, p),  [track.id, setTrackPan])
  const handleGainReset = useCallback(() => setTrackGain(track.id, 0),          [track.id, setTrackGain])
  const handlePanReset  = useCallback(() => setTrackPan(track.id, 0),           [track.id, setTrackPan])

  const isAnyMuted = track.muted
  const isSoloed   = track.soloed

  return (
    <div style={{
      width:         68,
      minWidth:      68,
      flexShrink:    0,
      display:       'flex',
      flexDirection: 'column',
      background:    '#0d0d1a',
      border:        '1px solid #15152a',
      borderRadius:  6,
      overflow:      'hidden',
      borderTop:     `2px solid ${track.color}`,
    }}>

      {/* Channel name + type */}
      <div style={{ padding: '5px 6px 3px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: track.color, background: `${track.color}15`, borderRadius: 2, padding: '1px 3px', alignSelf: 'flex-start' }}>
          {track.type.toUpperCase()}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={track.name}>
          {track.name}
        </div>
        <div style={{ fontSize: 8, color: '#2a2a40' }}>#{channelNum}</div>
      </div>

      {/* Inserts */}
      <SectionLabel label="FX" color={track.color} />
      <InsertsSection trackId={track.id} />

      {/* EQ mini curve */}
      <SectionLabel label="EQ" color={track.color} />
      <div style={{ padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 2px' }}>
          <div
            onClick={() => setEQEnabled(track.id, !ch.eqEnabled)}
            style={{
              width: 14, height: 14, borderRadius: 2, fontSize: 7, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: ch.eqEnabled ? `${track.color}30` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${ch.eqEnabled ? track.color + '60' : '#1a1a2e'}`,
              color:  ch.eqEnabled ? track.color : '#334155',
            }}
          >E</div>
          <EQCurveCanvas bands={ch.eqBands} color={track.color} width={44} height={28} enabled={ch.eqEnabled} />
        </div>
      </div>

      {/* Sends */}
      <SectionLabel label="SEND" color={track.color} />
      <SendsSection trackId={track.id} buses={buses} />

      {/* Group */}
      <SectionLabel label="GRP" color={track.color} />
      <div style={{ padding: '2px 6px' }}>
        <div style={{ fontSize: 8, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ch.groupId ? (buses.find(b => b.id === ch.groupId)?.name ?? '—') : '—'}
        </div>
      </div>

      {/* Pan */}
      <SectionLabel label="PAN" color={track.color} />
      <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <PanKnob pan={track.panCenter} color={track.color} onChange={handlePan} onReset={handlePanReset} />
        <span style={{ fontSize: 7, color: '#334155', fontFamily: 'monospace' }}>
          {track.panCenter === 0 ? 'C' : `${track.panCenter > 0 ? 'R' : 'L'}${Math.round(Math.abs(track.panCenter) * 100)}`}
        </span>
      </div>

      {/* M / S / R */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 3, padding: '3px 4px', borderTop: '1px solid #12121f' }}>
        <MixBtn label="M" title="Mute"        active={isAnyMuted} activeColor="#f59e0b" onClick={e => { e.stopPropagation(); toggleMute(track.id) }} />
        <MixBtn label="S" title="Solo"        active={isSoloed}   activeColor="#06b6d4" onClick={e => { e.stopPropagation(); toggleSolo(track.id) }} />
        <MixBtn label="R" title="Record Arm"  active={track.armed} activeColor="#ef4444" onClick={e => { e.stopPropagation(); toggleArm(track.id) }} />
      </div>

      {/* Meter */}
      <div style={{ background: '#050509', flexShrink: 0, padding: '2px 0' }}>
        <MeterCanvas getLevel={levelFn} color={track.color} height={148} showLufs />
      </div>

      {/* Fader */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 4px', background: '#0a0a16', borderTop: '1px solid #12121f' }}>
        <Fader gainDb={track.gainDb} color={track.color} onChange={handleGain} onReset={handleGainReset} />
      </div>

      {/* dB readout */}
      <div style={{ textAlign: 'center', padding: '2px 0 4px', background: '#0a0a16', borderTop: '1px solid #12121f' }}>
        <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
          {!isFinite(track.gainDb) || track.gainDb <= -60 ? '−∞' : `${track.gainDb > 0 ? '+' : ''}${track.gainDb.toFixed(1)}`} dB
        </span>
      </div>
    </div>
  )
})

// ─── Bus ChannelStrip ─────────────────────────────────────────────────────────

interface BusStripProps {
  bus:       MixerBus
  levelFn:  LevelFn
  isMaster: boolean
}

const BusChannelStrip = memo(function BusChannelStrip({ bus, levelFn, isMaster }: BusStripProps) {
  const { setBusGain, setBusPan, toggleBusMute, toggleBusSolo } = useMixerStore()
  const width = isMaster ? 88 : 68

  const handleGain    = useCallback((db: number) => setBusGain(bus.id, db), [bus.id, setBusGain])
  const handleGainReset = useCallback(() => setBusGain(bus.id, 0),           [bus.id, setBusGain])
  const handlePan     = useCallback((p: number)  => setBusPan(bus.id, p),   [bus.id, setBusPan])
  const handlePanReset  = useCallback(() => setBusPan(bus.id, 0),            [bus.id, setBusPan])

  return (
    <div style={{
      width,
      minWidth: width,
      flexShrink: 0,
      display:   'flex',
      flexDirection: 'column',
      background: isMaster ? '#0e0e1c' : '#0b0b17',
      border:    `1px solid ${isMaster ? '#2a2a42' : '#15152a'}`,
      borderRadius: 6,
      overflow:  'hidden',
      borderTop: `2px solid ${bus.color}`,
    }}>
      {/* Name */}
      <div style={{ padding: '5px 6px 3px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: bus.color, background: `${bus.color}15`, borderRadius: 2, padding: '1px 3px', alignSelf: 'flex-start' }}>
          {bus.type === 'master' ? 'MASTER' : bus.type === 'fx-return' ? 'FX RTN' : 'GROUP'}
        </div>
        <div style={{ fontSize: isMaster ? 11 : 10, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bus.name}
        </div>
      </div>

      {/* Pan */}
      <div style={{ padding: '4px 0 3px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderBottom: '1px solid #12121f' }}>
        <PanKnob pan={bus.panCenter} color={bus.color} onChange={handlePan} onReset={handlePanReset} />
        <span style={{ fontSize: 7, color: '#334155', fontFamily: 'monospace' }}>
          {bus.panCenter === 0 ? 'C' : `${bus.panCenter > 0 ? 'R' : 'L'}${Math.round(Math.abs(bus.panCenter) * 100)}`}
        </span>
      </div>

      {/* M / S */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 3, padding: '3px 4px', borderBottom: '1px solid #12121f' }}>
        <MixBtn label="M" title="Mute" active={bus.muted}  activeColor="#f59e0b" onClick={e => { e.stopPropagation(); toggleBusMute(bus.id) }} />
        <MixBtn label="S" title="Solo" active={bus.soloed} activeColor="#06b6d4" onClick={e => { e.stopPropagation(); toggleBusSolo(bus.id) }} />
      </div>

      {/* Meter (taller for master) */}
      <div style={{ background: '#050509', flexShrink: 0, padding: '2px 0' }}>
        <MeterCanvas getLevel={levelFn} color={bus.color} height={isMaster ? 180 : 148} showLufs />
      </div>

      {/* Fader */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 4px', background: '#0a0a16', borderTop: '1px solid #12121f' }}>
        <Fader gainDb={bus.gainDb} color={bus.color} onChange={handleGain} onReset={handleGainReset} />
      </div>

      {/* dB readout */}
      <div style={{ textAlign: 'center', padding: '2px 0 4px', background: '#0a0a16', borderTop: '1px solid #12121f' }}>
        <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
          {!isFinite(bus.gainDb) || bus.gainDb <= -60 ? '−∞' : `${bus.gainDb > 0 ? '+' : ''}${bus.gainDb.toFixed(1)}`} dB
        </span>
      </div>
    </div>
  )
})

// ─── Exports ──────────────────────────────────────────────────────────────────

export { TrackChannelStrip, BusChannelStrip, makeTrackLevelFn, makeBusLevelFn }
export type { LevelFn }
