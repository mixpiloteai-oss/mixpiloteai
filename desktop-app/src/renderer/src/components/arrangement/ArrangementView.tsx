import { useCallback }                from 'react'
import { useArrangementViewStore }    from './useArrangementViewStore'
import { useProjectStore }            from '../../store/projectStore'
import TrackHeaders, { HEADER_W }     from './TrackHeaders'
import TimeRuler                      from './TimeRuler'
import ArrangementCanvas              from './ArrangementCanvas'
import ArrangementMiniMap             from './ArrangementMiniMap'
import type { ARTool, ARSnap }        from './useArrangementViewStore'
import type { AutomationMode }        from '../../audio/AutomationEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const RULER_H    = 32
const TOOLS: { id: ARTool; label: string; key: string }[] = [
  { id: 'pointer', label: 'Select',  key: 'V' },
  { id: 'pencil',  label: 'Draw',    key: 'B' },
  { id: 'split',   label: 'Split',   key: 'C' },
  { id: 'erase',   label: 'Erase',   key: 'E' },
]
const SNAP_OPTIONS: ARSnap[] = ['off', '1/32', '1/16', '1/8', '1/4', '1/2', '1/1', '2/1', '4/1']

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolBtn({ id: _id, label, shortcut, active, onClick }: {
  id:        ARTool
  label:     string
  shortcut:  string
  active:    boolean
  onClick:   () => void
}) {
  return (
    <button
      title={`${label} [${shortcut}]`}
      onClick={onClick}
      style={{
        padding:      '2px 9px',
        borderRadius: 4,
        fontSize:     10,
        fontWeight:   active ? 600 : 400,
        cursor:       'pointer',
        background:   active ? 'rgba(124,58,237,0.22)' : 'transparent',
        color:        active ? '#a855f7' : '#475569',
        border:       `1px solid ${active ? 'rgba(124,58,237,0.40)' : 'transparent'}`,
        transition:   'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 14, background: '#1c1c2e', margin: '0 4px' }} />
}

// ─── ArrangementView ─────────────────────────────────────────────────────────

const AUTO_MODE_LABELS: Record<AutomationMode, string> = {
  read: 'Read', write: 'Write', touch: 'Touch', latch: 'Latch',
}
const AUTO_MODE_COLORS: Record<AutomationMode, string> = {
  read: '#06b6d4', write: '#ef4444', touch: '#f59e0b', latch: '#8b5cf6',
}

export default function ArrangementView() {
  const { tool, snap, zoomX, scrollY, setTool, setSnap, setZoom, setScroll, selectedClipIds, deselectAll,
          followPlayhead, toggleFollowPlayhead, rippleEdit, toggleRippleEdit,
          automationMode, setAutomationMode } =
    useArrangementViewStore()
  const { project, deleteClips, duplicateClips, consolidateClips } = useProjectStore()

  // ── Toolbar actions ───────────────────────────────────────────────────────

  const handleZoomIn  = useCallback(() => {
    const { zoomX: zx, scrollX: sx } = useArrangementViewStore.getState()
    setZoom(zx * 1.25)
    setScroll(sx * 1.25, useArrangementViewStore.getState().scrollY)
  }, [setZoom, setScroll])

  const handleZoomOut = useCallback(() => {
    const { zoomX: zx, scrollX: sx } = useArrangementViewStore.getState()
    const newZx = Math.max(2, zx / 1.25)
    setZoom(newZx)
    setScroll(Math.max(0, sx / 1.25), useArrangementViewStore.getState().scrollY)
  }, [setZoom, setScroll])

  const handleZoomFit = useCallback(() => {
    const containerW = window.innerWidth - HEADER_W
    const { totalBars, timeSignatureNumerator } = project
    const fitZoom = containerW / (totalBars * timeSignatureNumerator)
    setZoom(fitZoom)
    setScroll(0, useArrangementViewStore.getState().scrollY)
  }, [project, setZoom, setScroll])

  const handleDeleteSelected = useCallback(() => {
    const ids = [...useArrangementViewStore.getState().selectedClipIds]
    if (ids.length) { deleteClips(ids); deselectAll() }
  }, [deleteClips, deselectAll])

  const handleDuplicateSelected = useCallback(() => {
    const ids = [...useArrangementViewStore.getState().selectedClipIds]
    if (ids.length) duplicateClips(ids)
  }, [duplicateClips])

  const handleConsolidateSelected = useCallback(() => {
    const ids = [...useArrangementViewStore.getState().selectedClipIds]
    if (ids.length >= 2) { consolidateClips(ids); deselectAll() }
  }, [consolidateClips, deselectAll])

  const selCount = selectedClipIds.size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#08080f', overflow: 'hidden' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           6,
        padding:       '0 12px',
        height:        36,
        flexShrink:    0,
        background:    '#0b0b14',
        borderBottom:  '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Title */}
        <span style={{
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.12em',
          color:         '#2d2d42',
          textTransform: 'uppercase',
          marginRight:   4,
        }}>
          Arrangement
        </span>

        {/* Tools */}
        {TOOLS.map(t => (
          <ToolBtn
            key={t.id}
            id={t.id}
            label={t.label}
            shortcut={t.key}
            active={tool === t.id}
            onClick={() => setTool(t.id)}
          />
        ))}

        <Sep />

        {/* Snap */}
        <span style={{ fontSize: 9, color: '#334155' }}>SNAP</span>
        <select
          value={snap}
          onChange={e => setSnap(e.target.value as ARSnap)}
          style={{
            fontSize:     10,
            padding:      '1px 4px',
            borderRadius: 4,
            background:   '#0e0e1c',
            border:       '1px solid #1c1c2e',
            color:        '#64748b',
            outline:      'none',
            cursor:       'pointer',
          }}
        >
          {SNAP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        <Sep />

        {/* Zoom */}
        <span style={{ fontSize: 9, color: '#334155' }}>ZOOM</span>
        <button onClick={handleZoomOut} style={zoomBtnStyle}>−</button>
        <div style={{
          fontSize:  9,
          color:     '#334155',
          width:     40,
          textAlign: 'center',
          fontFamily:'monospace',
        }}>
          {zoomX < 10 ? zoomX.toFixed(1) : Math.round(zoomX)}×
        </div>
        <button onClick={handleZoomIn}  style={zoomBtnStyle}>+</button>
        <button onClick={handleZoomFit} style={{ ...zoomBtnStyle, width: 'auto', padding: '0 6px', fontSize: 9 }}>Fit</button>

        <Sep />

        {/* Edit actions */}
        <button
          onClick={handleDuplicateSelected}
          disabled={selCount === 0}
          title="Duplicate selected [Ctrl+D]"
          style={{ ...actionBtnStyle, opacity: selCount > 0 ? 1 : 0.35 }}
        >
          Dup {selCount > 0 ? `(${selCount})` : ''}
        </button>
        <button
          onClick={handleConsolidateSelected}
          disabled={selCount < 2}
          title="Consolidate selected clips [Ctrl+J]"
          style={{ ...actionBtnStyle, opacity: selCount >= 2 ? 1 : 0.35 }}
        >
          Merge
        </button>
        <button
          onClick={handleDeleteSelected}
          disabled={selCount === 0}
          title="Delete selected [Delete]"
          style={{ ...actionBtnStyle, opacity: selCount > 0 ? 1 : 0.35 }}
        >
          Del
        </button>

        <Sep />

        {/* Ripple editing */}
        <button
          onClick={toggleRippleEdit}
          title="Ripple editing — shift later clips when moving [R]"
          style={{
            padding:      '2px 8px',
            borderRadius: 4,
            fontSize:     10,
            fontWeight:   rippleEdit ? 600 : 400,
            background:   rippleEdit ? 'rgba(6,182,212,0.22)' : 'transparent',
            color:        rippleEdit ? '#06b6d4' : '#475569',
            border:       `1px solid ${rippleEdit ? 'rgba(6,182,212,0.4)' : 'transparent'}`,
            cursor:       'pointer',
            transition:   'all 0.12s',
          }}
        >
          Ripple
        </button>

        <Sep />

        {/* Automation mode */}
        <span style={{ fontSize: 9, color: '#334155' }}>AUTO</span>
        {(['read', 'write', 'touch', 'latch'] as AutomationMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setAutomationMode(mode)}
            title={`Automation: ${AUTO_MODE_LABELS[mode]}`}
            style={{
              padding:      '1px 6px',
              borderRadius: 3,
              fontSize:     9,
              fontWeight:   automationMode === mode ? 700 : 400,
              background:   automationMode === mode ? `${AUTO_MODE_COLORS[mode]}22` : 'transparent',
              color:        automationMode === mode ? AUTO_MODE_COLORS[mode] : '#334155',
              border:       `1px solid ${automationMode === mode ? AUTO_MODE_COLORS[mode] + '60' : 'transparent'}`,
              cursor:       'pointer',
              transition:   'all 0.1s',
            }}
          >
            {AUTO_MODE_LABELS[mode]}
          </button>
        ))}

        <Sep />

        {/* Follow playhead toggle */}
        <button
          onClick={toggleFollowPlayhead}
          title="Follow playhead"
          style={{
            padding:      '2px 8px',
            borderRadius: 4,
            fontSize:     10,
            fontWeight:   followPlayhead ? 600 : 400,
            background:   followPlayhead ? 'rgba(6,182,212,0.22)' : 'transparent',
            color:        followPlayhead ? '#06b6d4' : '#475569',
            border:       `1px solid ${followPlayhead ? 'rgba(6,182,212,0.4)' : 'transparent'}`,
            cursor:       'pointer',
            transition:   'all 0.12s',
          }}
        >
          Follow
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Project stats */}
        <span style={{ fontSize: 9, color: '#1c1c2e', fontFamily: 'monospace' }}>
          {project.totalBars} bars · {project.bpm} BPM
        </span>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>

        {/* Main timeline row */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Track headers (fixed left) */}
          <TrackHeaders scrollY={scrollY} rulerHeight={RULER_H} />

          {/* Timeline area (right of headers) */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

            {/* Time ruler (fixed top) */}
            <div style={{ height: RULER_H, flexShrink: 0, overflow: 'hidden' }}>
              <TimeRuler height={RULER_H} />
            </div>

            {/* Main canvas (fills remaining space) */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <ArrangementCanvas headerWidth={HEADER_W} rulerHeight={RULER_H} />
            </div>
          </div>
        </div>

        {/* Mini-map (full width, below timeline) */}
        <div style={{
          flexShrink:  0,
          borderTop:   '1px solid rgba(255,255,255,0.05)',
          background:  '#05050b',
          overflow:    'hidden',
        }}>
          <ArrangementMiniMap />
        </div>
      </div>
    </div>
  )
}

// ─── Button styles ────────────────────────────────────────────────────────────

const zoomBtnStyle: React.CSSProperties = {
  width:         22,
  height:        22,
  borderRadius:  3,
  background:    '#0e0e1c',
  border:        '1px solid #1c1c2e',
  color:         '#475569',
  fontSize:      14,
  lineHeight:    '20px',
  cursor:        'pointer',
  display:       'flex',
  alignItems:    'center',
  justifyContent:'center',
  padding:       0,
}

const actionBtnStyle: React.CSSProperties = {
  padding:      '2px 8px',
  borderRadius: 4,
  background:   'transparent',
  border:       '1px solid #1c1c2e',
  color:        '#475569',
  fontSize:     10,
  cursor:       'pointer',
}
