// ─── DawLayout ────────────────────────────────────────────────────────────────
// Professional 4-panel resizable DAW workspace:
//   ┌──────────┬───────────────────────┬────────────┐
//   │ Browser  │   ArrangementView     │ Inspector  │
//   │  (left)  │      (center)         │  (right)   │
//   │          ├───────────────────────┤            │
//   │          │   MixerView (bottom)  │            │
//   └──────────┴───────────────────────┴────────────┘
// All panel sizes are resizable and persisted via layoutStore.

import { useRef, useCallback, useEffect } from 'react'
import ArrangementView           from '../arrangement/ArrangementView'
import MixerView                 from '../mixer/MixerView'
import SampleBrowser             from '../browser/SampleBrowser'
import InspectorPanel            from '../inspector/InspectorPanel'
import LayoutModeSelector        from './LayoutModeSelector'
import { useLayoutStore }        from '../../store/layoutStore'

// ─── Resize handle ────────────────────────────────────────────────────────────

function VResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    onDrag(e.movementX)
  }, [onDrag])

  const onPointerUp = useCallback(() => { dragging.current = false }, [])

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        width:          5,
        cursor:         'col-resize',
        background:     '#0a0a14',
        borderLeft:     '1px solid rgba(255,255,255,0.04)',
        borderRight:    '1px solid rgba(255,255,255,0.04)',
        flexShrink:     0,
        transition:     'background 0.15s',
        zIndex:         10,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.35)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0a0a14' }}
    />
  )
}

function HResizeHandle({ onDrag }: { onDrag: (dy: number) => void }) {
  const dragging = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    onDrag(e.movementY)
  }, [onDrag])

  const onPointerUp = useCallback(() => { dragging.current = false }, [])

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        height:         5,
        cursor:         'row-resize',
        background:     '#0a0a14',
        borderTop:      '1px solid rgba(255,255,255,0.04)',
        borderBottom:   '1px solid rgba(255,255,255,0.04)',
        flexShrink:     0,
        transition:     'background 0.15s',
        zIndex:         10,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.35)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0a0a14' }}
    />
  )
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      height:          28,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
      padding:         '0 10px',
      background:      '#0b0b17',
      borderBottom:    '1px solid rgba(255,255,255,0.06)',
      flexShrink:      0,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {title}
      </span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 2 }}
        title={`Close ${title}`}
      >
        ×
      </button>
    </div>
  )
}

// ─── DawLayout ────────────────────────────────────────────────────────────────

export default function DawLayout() {
  const { panelSizes, setPanelSizes, toggleBrowser, toggleInspector, toggleMixer } = useLayoutStore()
  const { browserW, inspectorW, mixerH, mixerOpen, browserOpen, inspectorOpen } = panelSizes

  // ── Resize handlers ────────────────────────────────────────────────────────

  const resizeBrowserW = useCallback((dx: number) => {
    setPanelSizes({ browserW: Math.max(160, Math.min(440, browserW + dx)) })
  }, [browserW, setPanelSizes])

  const resizeInspectorW = useCallback((dx: number) => {
    setPanelSizes({ inspectorW: Math.max(160, Math.min(440, inspectorW - dx)) })
  }, [inspectorW, setPanelSizes])

  const resizeMixerH = useCallback((dy: number) => {
    setPanelSizes({ mixerH: Math.max(120, Math.min(400, mixerH - dy)) })
  }, [mixerH, setPanelSizes])

  // Debounced save: layout sizes are persisted via zustand/persist automatically,
  // but we also sync the resize state on mouse-up via the handle events.
  useEffect(() => {
    // nothing extra needed — zustand/persist handles it
  }, [])

  return (
    <div
      data-onboarding="daw-layout"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#08080f' }}
    >
      {/* Layout mode selector bar */}
      <LayoutModeSelector />

      {/* Main panels row */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Browser panel (left) ─────────────────────────────────────────── */}
        {browserOpen && (
          <>
            <div style={{ width: browserW, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <PanelHeader title="Browser" onClose={toggleBrowser} />
              <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <SampleBrowser />
              </div>
            </div>
            <VResizeHandle onDrag={resizeBrowserW} />
          </>
        )}

        {/* ── Center column: Arrangement + Mixer ───────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>

          {/* Arrangement */}
          <div
            data-onboarding="arrangement"
            style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
          >
            <ArrangementView />
          </div>

          {/* Mixer (bottom, collapsible) */}
          {mixerOpen && (
            <>
              <HResizeHandle onDrag={resizeMixerH} />
              <div style={{ height: mixerH, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <PanelHeader title="Mixer" onClose={toggleMixer} />
                <div data-onboarding="mixer" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <MixerView />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Inspector panel (right) ──────────────────────────────────────── */}
        {inspectorOpen && (
          <>
            <VResizeHandle onDrag={resizeInspectorW} />
            <div style={{ width: inspectorW, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <PanelHeader title="Inspector" onClose={toggleInspector} />
              <div data-onboarding="inspector" style={{ flex: 1, overflow: 'auto' }}>
                <InspectorPanel />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
