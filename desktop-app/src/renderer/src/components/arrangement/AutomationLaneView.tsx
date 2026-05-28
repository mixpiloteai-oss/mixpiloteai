import { useRef, useCallback } from 'react'
import { useArrangementViewStore } from './useArrangementViewStore'
import { useAutomationStore } from './useAutomationStore'
import { useProjectStore } from '../../store/projectStore'
import { computeTrackLayout } from './arrangementUtils'
import type { AutomationPoint, AutomationLane, AutomationMode } from '../../audio/AutomationEngine'

const MODE_LABELS: Record<AutomationMode, string> = {
  read: 'R', write: 'W', touch: 'T', latch: 'L',
}
const MODE_CYCLE: AutomationMode[] = ['read', 'write', 'touch', 'latch']
const MODE_COLORS: Record<AutomationMode, string> = {
  read: '#06b6d4', write: '#ef4444', touch: '#f59e0b', latch: '#8b5cf6',
}

// ─── Bezier path builder ──────────────────────────────────────────────────────

function buildCurvePath(
  points: AutomationPoint[],
  zoomX: number,
  scrollX: number,
  laneY: number,
  laneH: number,
  minValue: number,
  maxValue: number
): string {
  if (points.length === 0) return ''

  const range = maxValue - minValue || 1
  const beatToPx = (beat: number) => beat * zoomX - scrollX
  const valToY = (v: number) => laneY + laneH - ((v - minValue) / range) * laneH
  const PADDING = 4

  const pts = points.map(p => ({
    x: beatToPx(p.beat),
    y: valToY(p.value),
    curve: p.curve,
    outHandle: p.outHandle,
    inHandle: p.inHandle,
  }))

  if (pts.length === 1) {
    // Single point: horizontal line across the lane
    return `M 0 ${pts[0].y} L 99999 ${pts[0].y}`
  }

  const first = pts[0]
  let d = `M ${first.x} ${Math.max(laneY + PADDING, Math.min(laneY + laneH - PADDING, first.y))}`

  for (let i = 0; i < pts.length - 1; i++) {
    const pa = pts[i]
    const pb = pts[i + 1]
    const span = pb.x - pa.x
    const ay = Math.max(laneY + PADDING, Math.min(laneY + laneH - PADDING, pa.y))
    const by = Math.max(laneY + PADDING, Math.min(laneY + laneH - PADDING, pb.y))

    if (pa.curve === 'bezier') {
      const oh = pa.outHandle
      const ih = pb.inHandle
      // Control points: beat offsets convert to px, value offsets convert to screen
      const c0x = pa.x + (oh ? oh.dx * zoomX : span * 0.333)
      const c0y = ay   + (oh ? -oh.dy / range * laneH : 0)
      const c1x = pb.x + (ih ? ih.dx * zoomX : -span * 0.333)
      const c1y = by   + (ih ? -ih.dy / range * laneH : 0)
      d += ` C ${c0x.toFixed(1)} ${c0y.toFixed(1)} ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${pb.x.toFixed(1)} ${by.toFixed(1)}`
    } else if (pa.curve === 'linear') {
      d += ` L ${pb.x.toFixed(1)} ${by.toFixed(1)}`
    } else if (pa.curve === 'smooth') {
      // Approximate smooth with a symmetric bezier
      const c0x = pa.x + span * 0.5
      const c0y = ay
      const c1x = pa.x + span * 0.5
      const c1y = by
      d += ` C ${c0x.toFixed(1)} ${c0y.toFixed(1)} ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${pb.x.toFixed(1)} ${by.toFixed(1)}`
    } else {
      // step / hold: horizontal then vertical
      d += ` L ${pb.x.toFixed(1)} ${ay.toFixed(1)} L ${pb.x.toFixed(1)} ${by.toFixed(1)}`
    }
  }
  return d
}

// ─── AutomationLaneBand — SVG for a single lane ───────────────────────────────

interface BandProps {
  lane: AutomationLane
  laneY: number
  laneH: number
  zoomX: number
  scrollX: number
}

function AutomationLaneBand({ lane, laneY, laneH, zoomX, scrollX }: BandProps) {
  const { addPoint, removePoint, movePoint } = useAutomationStore.getState()
  const range = lane.maxValue - lane.minValue || 1
  const PADDING = 4

  const dragRef = useRef<{
    pointBeat: number
    startX: number
    startY: number
  } | null>(null)

  const beatToPx = (beat: number) => beat * zoomX - scrollX
  const valToY = (v: number) => laneY + laneH - ((v - lane.minValue) / range) * laneH
  const pxToBeat = (px: number) => (px + scrollX) / zoomX
  const yToVal = (py: number) =>
    lane.minValue + ((laneY + laneH - py) / laneH) * range

  const curvePath = buildCurvePath(lane.points, zoomX, scrollX, laneY, laneH, lane.minValue, lane.maxValue)
  const color = lane.color ?? '#7c3aed'

  function onSvgPointerDown(e: React.PointerEvent<SVGRectElement>) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const svgEl = (e.currentTarget as SVGElement).ownerSVGElement
    if (!svgEl) return
    const rect = svgEl.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    // Check if near an existing point
    const hit = lane.points.find(p => {
      const px2 = beatToPx(p.beat)
      const py2 = valToY(p.value)
      return Math.hypot(px - px2, py - py2) < 10
    })

    if (hit) {
      if (e.altKey || e.button === 2) {
        removePoint(lane.id, hit.beat)
      } else {
        dragRef.current = { pointBeat: hit.beat, startX: px, startY: py }
      }
    } else {
      // Add new point
      const beat = pxToBeat(px)
      const value = Math.max(lane.minValue, Math.min(lane.maxValue, yToVal(py)))
      addPoint(lane.id, { beat, value, curve: 'bezier' })
      dragRef.current = { pointBeat: beat, startX: px, startY: py }
    }
  }

  function onSvgPointerMove(e: React.PointerEvent<SVGRectElement>) {
    if (!dragRef.current) return
    const svgEl = (e.currentTarget as SVGElement).ownerSVGElement
    if (!svgEl) return
    const rect = svgEl.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const newBeat = Math.max(0, pxToBeat(px))
    const newValue = Math.max(lane.minValue, Math.min(lane.maxValue, yToVal(py)))
    movePoint(lane.id, dragRef.current.pointBeat, newBeat, newValue)
    dragRef.current.pointBeat = newBeat
  }

  function onSvgPointerUp() {
    dragRef.current = null
  }

  return (
    <g>
      {/* Background */}
      <rect x={0} y={laneY} width="100%" height={laneH}
        fill={`${color}08`} stroke={`${color}20`} strokeWidth={1}
      />

      {/* Zero / default line */}
      {(() => {
        const defY = valToY(lane.defaultValue)
        if (defY > laneY && defY < laneY + laneH) {
          return <line x1={0} y1={defY} x2="100%" y2={defY}
            stroke={`${color}20`} strokeWidth={1} strokeDasharray="4 4" />
        }
        return null
      })()}

      {/* Curve path — fill below */}
      {curvePath && (
        <>
          <path
            d={`${curvePath} L 99999 ${laneY + laneH} L 0 ${laneY + laneH} Z`}
            fill={`${color}14`}
            fillRule="nonzero"
          />
          <path
            d={curvePath}
            fill="none"
            stroke={lane.enabled ? color : `${color}40`}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Automation points */}
      {lane.points.map((p, i) => {
        const px = beatToPx(p.beat)
        const py = Math.max(laneY + PADDING, Math.min(laneY + laneH - PADDING, valToY(p.value)))
        if (px < -20 || px > 99999) return null

        return (
          <g key={i}>
            {/* Bezier handles when curve = bezier */}
            {p.curve === 'bezier' && p.outHandle && (
              <line
                x1={px} y1={py}
                x2={px + p.outHandle.dx * zoomX}
                y2={py - p.outHandle.dy / range * laneH}
                stroke={`${color}60`} strokeWidth={1}
              />
            )}
            {p.curve === 'bezier' && p.inHandle && (
              <line
                x1={px} y1={py}
                x2={px + p.inHandle.dx * zoomX}
                y2={py - p.inHandle.dy / range * laneH}
                stroke={`${color}60`} strokeWidth={1}
              />
            )}
            {/* Point circle */}
            <circle cx={px} cy={py} r={5}
              fill={`${color}cc`} stroke={color} strokeWidth={1.5}
              style={{ cursor: 'grab' }}
            />
          </g>
        )
      })}

      {/* Invisible interaction rect — captures all clicks in the lane area */}
      <rect
        x={0} y={laneY} width="100%" height={laneH}
        fill="transparent"
        style={{ cursor: 'crosshair', pointerEvents: 'all' }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onContextMenu={e => e.preventDefault()}
      />
    </g>
  )
}

// ─── AutomationLaneHeader — left panel label for an expanded lane ─────────────

export function AutomationLaneHeader({
  lane,
  height,
}: {
  lane: AutomationLane
  height: number
}) {
  const { setLaneMode, toggleLaneEnabled } = useAutomationStore.getState()
  const color = lane.color ?? '#7c3aed'

  function cycleMode() {
    const idx = MODE_CYCLE.indexOf(lane.mode)
    setLaneMode(lane.id, MODE_CYCLE[(idx + 1) % MODE_CYCLE.length])
  }

  return (
    <div style={{
      height,
      background: `${color}08`,
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      borderLeft: `2px solid ${color}40`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 10px 0 18px',
      gap: 3,
    }}>
      {/* Param name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
          {lane.paramName}
        </span>
      </div>

      {/* Mode + enable controls */}
      <div style={{ display: 'flex', gap: 3 }}>
        {MODE_CYCLE.map(m => (
          <button
            key={m}
            onClick={() => setLaneMode(lane.id, m)}
            style={{
              width: 16, height: 14, borderRadius: 2,
              fontSize: 8, fontWeight: 700, cursor: 'pointer',
              background: lane.mode === m ? `${MODE_COLORS[m]}22` : 'transparent',
              border: `1px solid ${lane.mode === m ? MODE_COLORS[m] + '60' : 'rgba(255,255,255,0.06)'}`,
              color: lane.mode === m ? MODE_COLORS[m] : '#334155',
            }}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
        <button
          onClick={() => toggleLaneEnabled(lane.id)}
          title={lane.enabled ? 'Disable lane' : 'Enable lane'}
          style={{
            width: 16, height: 14, borderRadius: 2,
            fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: lane.enabled ? `${color}22` : 'transparent',
            border: `1px solid ${lane.enabled ? color + '60' : 'rgba(255,255,255,0.06)'}`,
            color: lane.enabled ? color : '#334155',
          }}
        >
          E
        </button>
      </div>
    </div>
  )
}

// ─── AutomationLaneView — SVG overlay over the arrangement canvas ─────────────

export default function AutomationLaneView() {
  const { zoomX, scrollX, scrollY, expandedAutomationTracks } = useArrangementViewStore()
  const { project } = useProjectStore()
  const { lanes } = useAutomationStore()

  if (expandedAutomationTracks.size === 0) return null

  const trackLayout = computeTrackLayout(project.tracks, scrollY, expandedAutomationTracks)

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {trackLayout.map((tl) => {
        if (tl.autoH === 0) return null
        const trackLanes = lanes.filter(l => l.trackId === tl.id)
        if (trackLanes.length === 0) return null

        // Show the first enabled lane (or first lane overall)
        const activeLane = trackLanes.find(l => l.enabled) ?? trackLanes[0]

        return (
          <AutomationLaneBand
            key={activeLane.id}
            lane={activeLane}
            laneY={tl.autoY}
            laneH={tl.autoH}
            zoomX={zoomX}
            scrollX={scrollX}
          />
        )
      })}
    </svg>
  )
}

// ─── Helper: get lane for a track (for header rendering) ─────────────────────

export function useTrackAutomationLanes(trackId: string) {
  return useAutomationStore(s => s.lanes.filter(l => l.trackId === trackId))
}

export function useAddAutomationLane() {
  return useCallback((trackId: string, paramName: string, color: string) => {
    useAutomationStore.getState().addLane({
      id: `auto-${trackId}-${paramName}-${Date.now()}`,
      trackId,
      paramName,
      minValue: paramName === 'gainDb' ? -60 : paramName === 'panCenter' ? -1 : 0,
      maxValue: paramName === 'gainDb' ? 12  : paramName === 'panCenter' ?  1 : 1,
      defaultValue: 0,
      enabled: true,
      color,
    })
  }, [])
}
