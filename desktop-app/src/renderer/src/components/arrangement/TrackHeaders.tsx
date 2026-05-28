import { useRef, useEffect, useState, useCallback } from 'react'
import { useProjectStore }          from '../../store/projectStore'
import { useArrangementViewStore }  from './useArrangementViewStore'
import { useAutomationStore }       from './useAutomationStore'
import { freezeEngine }             from '../../audio/FreezeEngine'
import { getMonitorEngine, getTrackManager } from '../../audio'
import { MidiTrackNode }            from '../../audio/tracks/MidiTrackNode'
import { AudioTrackNode }           from '../../audio/tracks/AudioTrackNode'
import { AUTOMATION_LANE_H }        from './arrangementUtils'
import { AutomationLaneHeader }     from './AutomationLaneView'
import type { Track }               from '../../types/project'

export const HEADER_W = 192

// ─── Track type icons ─────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  midi:   'MIDI',
  audio:  'AUDIO',
  bus:    'BUS',
  master: 'MASTER',
}

// ─── Individual track header ──────────────────────────────────────────────────

function TrackHeader({
  track,
  isSelected,
  isFrozen,
  automationExpanded,
  onSelect,
  onMute,
  onSolo,
  onArm,
  onFreeze,
  onToggleAutomation,
  onHeightDrag,
}: {
  track:               Track
  isSelected:          boolean
  isFrozen:            boolean
  automationExpanded:  boolean
  onSelect:            () => void
  onMute:              () => void
  onSolo:              () => void
  onArm:               () => void
  onFreeze:            () => void
  onToggleAutomation:  () => void
  onHeightDrag:        (newH: number) => void
}) {
  const dragRef = useRef<{ y0: number; h0: number } | null>(null)

  function onResizeDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { y0: e.clientY, h0: track.height }
  }

  function onResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const delta = e.clientY - dragRef.current.y0
    onHeightDrag(Math.max(36, Math.min(200, dragRef.current.h0 + delta)))
  }

  function onResizeUp() {
    dragRef.current = null
  }

  const hasSolo   = track.soloed
  const hasMute   = track.muted

  return (
    <div
      onClick={onSelect}
      style={{
        height:       track.height,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderLeft:   `2px solid ${isSelected ? track.color : 'transparent'}`,
        background:   isSelected ? `${track.color}10` : '#0a0a14',
        display:      'flex',
        flexDirection:'column',
        justifyContent: 'center',
        padding:      '0 8px',
        cursor:       'pointer',
        position:     'relative',
        userSelect:   'none',
        transition:   'background 0.1s',
      }}
    >
      {/* Color strip */}
      <div style={{
        position:   'absolute',
        left:       2,
        top:        8,
        bottom:     8,
        width:      3,
        borderRadius: 2,
        background: track.color,
        opacity:    0.8,
      }} />

      {/* Top row: type badge + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 10 }}>
        <span style={{
          fontSize:    8,
          fontWeight:  700,
          letterSpacing: '0.08em',
          color:       track.color,
          background:  `${track.color}18`,
          border:      `1px solid ${track.color}40`,
          borderRadius: 2,
          padding:     '1px 3px',
        }}>
          {TYPE_LABEL[track.type] ?? track.type.toUpperCase()}
        </span>
      </div>

      {/* Track name */}
      <div style={{
        fontSize:   11,
        fontWeight: 600,
        color:      isSelected ? '#e2e8f0' : '#94a3b8',
        paddingLeft: 10,
        marginTop:  2,
        overflow:   'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {track.name}
      </div>

      {/* Control buttons */}
      <div style={{ display: 'flex', gap: 3, paddingLeft: 10, marginTop: 4 }}>
        <TBtn
          label="M"
          title="Mute"
          active={hasMute}
          activeColor="#f59e0b"
          onClick={e => { e.stopPropagation(); onMute() }}
        />
        <TBtn
          label="S"
          title="Solo"
          active={hasSolo}
          activeColor="#06b6d4"
          onClick={e => { e.stopPropagation(); onSolo() }}
        />
        <TBtn
          label="R"
          title="Record Arm"
          active={track.armed}
          activeColor="#ef4444"
          onClick={e => { e.stopPropagation(); onArm() }}
        />
        {(track.type === 'midi' || track.type === 'audio') && (
          <TBtn
            label="F"
            title={isFrozen ? 'Unfreeze track' : 'Freeze track'}
            active={isFrozen}
            activeColor="#60a5fa"
            onClick={e => { e.stopPropagation(); onFreeze() }}
          />
        )}
        <TBtn
          label="A"
          title={automationExpanded ? 'Hide automation lane' : 'Show automation lane'}
          active={automationExpanded}
          activeColor="#8b5cf6"
          onClick={e => { e.stopPropagation(); onToggleAutomation() }}
        />
      </div>

      {/* Height resize handle */}
      <div
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        style={{
          position:  'absolute',
          bottom:    0,
          left:      0,
          right:     0,
          height:    6,
          cursor:    'ns-resize',
          zIndex:    10,
        }}
      />
    </div>
  )
}

// ─── Small control button ─────────────────────────────────────────────────────

function TBtn({
  label,
  title,
  active,
  activeColor,
  onClick,
}: {
  label:        string
  title:        string
  active:       boolean
  activeColor:  string
  onClick:      (e: React.MouseEvent) => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width:      20,
        height:     16,
        borderRadius: 3,
        fontSize:   8,
        fontWeight: 700,
        cursor:     'pointer',
        border:     `1px solid ${active ? activeColor + '60' : 'rgba(255,255,255,0.06)'}`,
        background: active ? `${activeColor}22` : 'rgba(255,255,255,0.04)',
        color:      active ? activeColor : '#475569',
        transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  )
}

// ─── TrackSlot — track header + optional automation lane header ───────────────

function TrackSlot({
  track, isSelected, isFrozen, automationExpanded,
  onSelect, onMute, onSolo, onArm, onFreeze, onToggleAutomation, onHeightDrag,
}: {
  track: Track; isSelected: boolean; isFrozen: boolean; automationExpanded: boolean
  onSelect: () => void; onMute: () => void; onSolo: () => void; onArm: () => void
  onFreeze: () => void; onToggleAutomation: () => void; onHeightDrag: (h: number) => void
}) {
  const lanes = useAutomationStore(s => s.lanes.filter(l => l.trackId === track.id))
  const activeLane = lanes.find(l => l.enabled) ?? lanes[0]

  return (
    <div>
      <TrackHeader
        track={track}
        isSelected={isSelected}
        isFrozen={isFrozen}
        automationExpanded={automationExpanded}
        onSelect={onSelect}
        onMute={onMute}
        onSolo={onSolo}
        onArm={onArm}
        onFreeze={onFreeze}
        onToggleAutomation={onToggleAutomation}
        onHeightDrag={onHeightDrag}
      />
      {automationExpanded && activeLane && (
        <AutomationLaneHeader lane={activeLane} height={AUTOMATION_LANE_H} />
      )}
      {automationExpanded && !activeLane && (
        <div style={{
          height: AUTOMATION_LANE_H,
          background: `${track.color}08`,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          borderLeft: `2px solid ${track.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 9, color: '#334155' }}>No automation lane</span>
        </div>
      )}
    </div>
  )
}

// ─── Main TrackHeaders panel ──────────────────────────────────────────────────

interface Props {
  scrollY:     number
  rulerHeight: number
}

export default function TrackHeaders({ scrollY, rulerHeight }: Props) {
  const tracks               = useProjectStore(s => s.project.tracks)
  const selectedTrackId      = useProjectStore(s => s.selectedTrackId)
  const selectTrack          = useProjectStore(s => s.selectTrack)
  const toggleMute           = useProjectStore(s => s.toggleMute)
  const toggleSolo           = useProjectStore(s => s.toggleSolo)
  const toggleArm            = useProjectStore(s => s.toggleArm)
  const setTrackHeight       = useProjectStore(s => s.setTrackHeight)
  const addTrack             = useProjectStore(s => s.addTrack)
  const { expandedAutomationTracks, toggleAutomationTrack } = useArrangementViewStore()
  const containerRef         = useRef<HTMLDivElement>(null)
  const [frozenIds, setFrozenIds] = useState<Set<string>>(() => new Set(freezeEngine.getFrozenList()))

  const handleToggleAutomation = useCallback((track: Track) => {
    toggleAutomationTrack(track.id)
    // Seed a lane if none exist yet for this track
    const { lanes, addLane } = useAutomationStore.getState()
    const hasLane = lanes.some(l => l.trackId === track.id)
    if (!hasLane) {
      addLane({
        id: `auto-${track.id}-gainDb-${Date.now()}`,
        trackId: track.id,
        paramName: 'gainDb',
        minValue: -60,
        maxValue: 12,
        defaultValue: 0,
        enabled: true,
        color: track.color,
      })
    }
  }, [toggleAutomationTrack])

  // Sync vertical scroll
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = scrollY
  }, [scrollY])

  // Handle arm toggle with monitoring side-effect
  function handleArm(trackId: string, currentArmed: boolean) {
    toggleArm(trackId)
    const monitor = getMonitorEngine()
    const trackMgr = getTrackManager()
    const node = trackMgr.getTrack(trackId)
    if (!currentArmed) {
      // Arming: enable monitoring, route to track
      if (node instanceof MidiTrackNode || node instanceof AudioTrackNode) {
        const channelInput = node instanceof AudioTrackNode
          ? (node as unknown as { input: AudioNode }).input
          : (node as MidiTrackNode).synthInput
        monitor.routeToTrack(trackId, channelInput)
        monitor.enable({ enabled: true, gainDb: 0, directMonitor: false }).catch(() => {})
      }
    } else {
      // Disarming: unroute from monitoring
      monitor.unrouteTrack(trackId)
    }
  }

  // Handle freeze toggle
  function handleFreeze(trackId: string) {
    if (freezeEngine.isFrozen(trackId)) {
      freezeEngine.unfreeze(trackId)
      setFrozenIds(prev => {
        const next = new Set(prev)
        next.delete(trackId)
        return next
      })
    } else {
      // Freeze requires duration — derive from clip lengths
      const track = tracks.find(t => t.id === trackId)
      const clipEndBar = track && track.clips.length > 0
        ? Math.max(...track.clips.map(c => c.startBar + c.lengthBars - 1))
        : 32
      const bpm = 145
      const durationSec = clipEndBar * 4 * (60 / bpm) + 2
      const { ctx: offCtx } = freezeEngine.prepareContext({ durationSec })
      freezeEngine.renderAndFreeze(trackId, offCtx).then(() => {
        setFrozenIds(prev => new Set([...prev, trackId]))
      }).catch(() => {})
    }
  }

  return (
    <div style={{
      width:    HEADER_W,
      minWidth: HEADER_W,
      display:  'flex',
      flexDirection: 'column',
      background: '#08080e',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    }}>
      {/* Ruler height spacer — matches TimeRuler */}
      <div style={{
        height:      rulerHeight,
        flexShrink:  0,
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        background:  '#06060c',
        display:     'flex',
        alignItems:  'center',
        paddingLeft: 10,
        gap:         6,
      }}>
        <span style={{ fontSize: 9, color: '#1e1e30', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Tracks
        </span>
        <span style={{ fontSize: 9, color: '#2a2a40' }}>
          {tracks.length}
        </span>
      </div>

      {/* Track list (scrollable, synced to canvas scrollY) */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'hidden', overflowX: 'hidden' }}
      >
        {tracks.map(track => (
          <TrackSlot
            key={track.id}
            track={track}
            isSelected={selectedTrackId === track.id}
            isFrozen={frozenIds.has(track.id)}
            automationExpanded={expandedAutomationTracks.has(track.id)}
            onSelect={() => selectTrack(track.id)}
            onMute={() => toggleMute(track.id)}
            onSolo={() => toggleSolo(track.id)}
            onArm={() => handleArm(track.id, track.armed)}
            onFreeze={() => handleFreeze(track.id)}
            onToggleAutomation={() => handleToggleAutomation(track)}
            onHeightDrag={h => setTrackHeight(track.id, h)}
          />
        ))}

        {/* Add Track buttons */}
        <div style={{ padding: '8px 8px 8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(['midi', 'audio', 'bus'] as const).map(type => (
            <button
              key={type}
              onClick={() => addTrack({ id: `tk-${Math.random().toString(36).slice(2)}`, name: `New ${TYPE_LABEL[type]}`, type, color: '#7c3aed', gainDb: 0, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 72, clips: [] })}
              style={{
                width:       '100%',
                height:      22,
                borderRadius: 4,
                fontSize:    9,
                fontWeight:  600,
                cursor:      'pointer',
                background:  'transparent',
                border:      '1px dashed rgba(255,255,255,0.08)',
                color:       '#2a2a44',
                letterSpacing: '0.06em',
                transition:  'all 0.1s',
              }}
            >
              + {TYPE_LABEL[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Re-export scroll sync helper for parent ──────────────────────────────────

export function useTrackScrollY() {
  return useArrangementViewStore(s => s.scrollY)
}
