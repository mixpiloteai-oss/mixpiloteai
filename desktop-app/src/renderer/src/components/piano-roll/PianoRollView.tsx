import { useCallback, useEffect }  from 'react'
import { usePianoRollStore }       from './usePianoRollStore'
import { useProjectStore }         from '../../store/projectStore'
import PianoKeys                   from './PianoKeys'
import NoteGrid                    from './NoteGrid'
import VelocityLane                from './VelocityLane'
import AutomationLanes             from './AutomationLanes'
import ScalePanel                  from './ScalePanel'
import AIPanel                     from './AIPanel'
import type { PRTool, SnapGrid }   from './types'

// ─── Toolbar constants ────────────────────────────────────────────────────────

const TOOLS: { id: PRTool; label: string; key: string }[] = [
  { id: 'pointer',  label: 'Select',   key: 'S' },
  { id: 'pencil',   label: 'Draw',     key: 'D' },
  { id: 'erase',    label: 'Erase',    key: 'E' },
  { id: 'velocity', label: 'Velocity', key: 'V' },
]

const SNAP_OPTIONS: SnapGrid[] = ['off', '1/32', '1/16', '1/8', '1/4', '1/2', '1/1']
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToolButton({ id, label, shortcut }: { id: PRTool; label: string; shortcut: string }) {
  const { tool, setTool } = usePianoRollStore(s => ({ tool: s.tool, setTool: s.setTool }))
  const active = tool === id
  return (
    <button
      onClick={() => setTool(id)}
      title={`${label} [${shortcut}]`}
      style={{
        padding:    '2px 8px',
        borderRadius: 4,
        fontSize:   10,
        fontWeight: active ? 600 : 400,
        background: active ? 'rgba(124,58,237,0.22)' : 'transparent',
        color:      active ? '#a855f7' : '#475569',
        border:     `1px solid ${active ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
        cursor:     'pointer',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

function Separator() {
  return <div style={{ width: 1, height: 14, background: '#1c1c2e', margin: '0 4px' }} />
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PianoRollView() {
  const snap              = usePianoRollStore(s => s.snap)
  const setSnap           = usePianoRollStore(s => s.setSnap)
  const zoomX             = usePianoRollStore(s => s.zoomX)
  const zoomY             = usePianoRollStore(s => s.zoomY)
  const setZoom           = usePianoRollStore(s => s.setZoom)
  const totalBeats        = usePianoRollStore(s => s.totalBeats)
  const timeSigTop        = usePianoRollStore(s => s.timeSigTop)
  const notes             = usePianoRollStore(s => s.notes)
  const duplicateSelected  = usePianoRollStore(s => s.duplicateSelected)
  const deleteSelected    = usePianoRollStore(s => s.deleteSelected)
  const selectAll         = usePianoRollStore(s => s.selectAll)
  const deselectAll       = usePianoRollStore(s => s.deselectAll)
  const scaleEnabled      = usePianoRollStore(s => s.scaleEnabled)
  const aiPanelOpen       = usePianoRollStore(s => s.aiPanelOpen)
  const scalePanelOpen    = usePianoRollStore(s => s.scalePanelOpen)
  const toggleAIPanel     = usePianoRollStore(s => s.toggleAIPanel)
  const toggleScalePanel  = usePianoRollStore(s => s.toggleScalePanel)
  const isPreviewPlaying  = usePianoRollStore(s => s.isPreviewPlaying)
  const startPreview      = usePianoRollStore(s => s.startPreview)
  const stopPreview       = usePianoRollStore(s => s.stopPreview)
  const selectedTrackId   = useProjectStore(s => s.selectedTrackId)

  // Space bar toggles preview playback
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      e.preventDefault()
      if (isPreviewPlaying) {
        stopPreview()
      } else {
        const trackId = selectedTrackId ?? useProjectStore.getState().project.tracks
          .find(t => t.type === 'midi')?.id ?? ''
        if (trackId) startPreview(trackId)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPreviewPlaying, startPreview, stopPreview, selectedTrackId])

  const zoomXIdx  = ZOOM_STEPS.findIndex(z => Math.abs(z - zoomX / 64) < 0.01)
  const zoomXNorm = zoomXIdx >= 0 ? zoomXIdx : 2

  const handleZoomX = useCallback((dir: 1 | -1) => {
    const idx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, zoomXNorm + dir))
    setZoom(ZOOM_STEPS[idx] * 64, zoomY)
  }, [zoomXNorm, zoomY, setZoom])

  const handleZoomY = useCallback((dir: 1 | -1) => {
    setZoom(zoomX, Math.max(8, Math.min(32, zoomY + dir * 2)))
  }, [zoomX, zoomY, setZoom])

  const bars = Math.ceil(totalBeats / timeSigTop)

  return (
    <div
      className="flex flex-col"
      style={{ height: '100%', background: '#08080f', overflow: 'hidden' }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           6,
          padding:       '0 12px',
          height:        36,
          flexShrink:    0,
          background:    '#0b0b14',
          borderBottom:  '1px solid #1a1a2e',
        }}
      >
        {/* Title */}
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#2d2d42', textTransform: 'uppercase', marginRight: 4 }}>
          Piano Roll
        </span>

        {/* Tool buttons */}
        {TOOLS.map(t => (
          <ToolButton key={t.id} id={t.id} label={t.label} shortcut={t.key} />
        ))}

        <Separator />

        {/* Snap */}
        <span style={{ fontSize: 9, color: '#334155', marginRight: 2 }}>SNAP</span>
        <select
          value={snap}
          onChange={e => setSnap(e.target.value as SnapGrid)}
          style={{
            fontSize:   10,
            padding:    '1px 4px',
            borderRadius: 4,
            background: '#0e0e1c',
            border:     '1px solid #1c1c2e',
            color:      '#64748b',
            outline:    'none',
            cursor:     'pointer',
          }}
        >
          {SNAP_OPTIONS.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        <Separator />

        {/* Zoom X */}
        <span style={{ fontSize: 9, color: '#334155' }}>ZOOM H</span>
        <button onClick={() => handleZoomX(-1)} style={zoomBtnStyle}>−</button>
        <button onClick={() => handleZoomX( 1)} style={zoomBtnStyle}>+</button>

        {/* Zoom Y */}
        <span style={{ fontSize: 9, color: '#334155', marginLeft: 4 }}>V</span>
        <button onClick={() => handleZoomY(-1)} style={zoomBtnStyle}>−</button>
        <button onClick={() => handleZoomY( 1)} style={zoomBtnStyle}>+</button>

        <Separator />

        {/* Edit actions */}
        <button onClick={selectAll}         style={actionBtnStyle}>All</button>
        <button onClick={deselectAll}       style={actionBtnStyle}>None</button>
        <button onClick={duplicateSelected} style={actionBtnStyle}>Dup</button>
        <button onClick={deleteSelected}    style={actionBtnStyle}>Del</button>

        <Separator />

        {/* Scale toggle */}
        <button
          onClick={toggleScalePanel}
          style={{
            padding:      '2px 8px',
            borderRadius: 4,
            fontSize:     10,
            fontWeight:   scalePanelOpen ? 600 : 400,
            background:   (scalePanelOpen || scaleEnabled) ? 'rgba(124,58,237,0.22)' : 'transparent',
            color:        (scalePanelOpen || scaleEnabled) ? '#a855f7' : '#475569',
            border:       `1px solid ${(scalePanelOpen || scaleEnabled) ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
            cursor:       'pointer',
            transition:   'all 0.12s',
          }}
          title="Toggle scale panel"
        >
          Scale
        </button>

        {/* AI toggle */}
        <button
          onClick={toggleAIPanel}
          style={{
            padding:      '2px 8px',
            borderRadius: 4,
            fontSize:     10,
            fontWeight:   aiPanelOpen ? 600 : 400,
            background:   aiPanelOpen ? 'rgba(139,92,246,0.22)' : 'transparent',
            color:        aiPanelOpen ? '#c084fc' : '#475569',
            border:       `1px solid ${aiPanelOpen ? 'rgba(139,92,246,0.4)' : 'transparent'}`,
            cursor:       'pointer',
            transition:   'all 0.12s',
          }}
          title="Toggle AI generation panel"
        >
          AI
        </button>

        <Separator />

        {/* Preview playback */}
        <button
          onClick={() => {
            if (isPreviewPlaying) {
              stopPreview()
            } else {
              const trackId = selectedTrackId ?? useProjectStore.getState().project.tracks
                .find(t => t.type === 'midi')?.id ?? ''
              if (trackId) startPreview(trackId)
            }
          }}
          title={isPreviewPlaying ? 'Stop Preview [Space]' : 'Preview [Space]'}
          style={{
            padding:      '2px 8px',
            borderRadius: 4,
            fontSize:     11,
            fontWeight:   isPreviewPlaying ? 600 : 400,
            background:   isPreviewPlaying ? 'rgba(16,185,129,0.22)' : 'transparent',
            color:        isPreviewPlaying ? '#10b981' : '#475569',
            border:       `1px solid ${isPreviewPlaying ? 'rgba(16,185,129,0.4)' : 'transparent'}`,
            cursor:       'pointer',
            transition:   'all 0.12s',
          }}
        >
          {isPreviewPlaying ? '■' : '▶'}
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Project info */}
        <span style={{ fontSize: 9, color: '#1c1c2e' }}>
          {bars} bars · {notes.length} notes
        </span>
      </div>

      {/* ── Scale panel (collapsible) ───────────────────────────────────────── */}
      {scalePanelOpen && <ScalePanel />}

      {/* ── AI panel (collapsible) ──────────────────────────────────────────── */}
      {aiPanelOpen && <AIPanel />}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Piano keyboard + NoteGrid side by side */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <PianoKeys />
          <NoteGrid />
        </div>
      </div>

      {/* ── Velocity lane ───────────────────────────────────────────────────── */}
      <VelocityLane />

      {/* ── Automation lanes ────────────────────────────────────────────────── */}
      <AutomationLanes />
    </div>
  )
}

// ─── Shared button styles ─────────────────────────────────────────────────────

const zoomBtnStyle: React.CSSProperties = {
  width:      20,
  height:     20,
  borderRadius: 3,
  background: '#0e0e1c',
  border:     '1px solid #1c1c2e',
  color:      '#475569',
  fontSize:   13,
  lineHeight: '18px',
  cursor:     'pointer',
  display:    'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding:    0,
}

const actionBtnStyle: React.CSSProperties = {
  padding:    '2px 7px',
  borderRadius: 4,
  background: 'transparent',
  border:     '1px solid #1c1c2e',
  color:      '#475569',
  fontSize:   10,
  cursor:     'pointer',
}
