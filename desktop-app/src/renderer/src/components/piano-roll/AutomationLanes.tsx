import { useCallback, useRef, useState } from 'react'
import { usePianoRollStore } from './usePianoRollStore'
import type { AutomationParam, AutomationPoint } from './types'

const LANE_H      = 80   // expanded lane height for editing
const LABEL_W     = 140
const POINT_R     = 5    // hit-target radius for points
const POINT_DRAW_R = 4   // visual radius

// ─── Helpers ──────────────────────────────────────────────────────────────────

function beatToX(beat: number, scrollX: number, zoomX: number): number {
  return beat * zoomX - scrollX
}

function xToBeat(x: number, scrollX: number, zoomX: number): number {
  return (x + scrollX) / zoomX
}

function valueToY(value: number, min: number, max: number, height: number): number {
  // top = max, bottom = min
  const ratio = (value - min) / (max - min)
  return height - ratio * height
}

function yToValue(y: number, min: number, max: number, height: number): number {
  const ratio = 1 - y / height
  return min + ratio * (max - min)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ─── SVG Lane ────────────────────────────────────────────────────────────────

function AutoLaneSVG({ param }: { param: AutomationParam }) {
  const scrollX        = usePianoRollStore(s => s.scrollX)
  const zoomX          = usePianoRollStore(s => s.zoomX)
  const addAutoPoint   = usePianoRollStore(s => s.addAutoPoint)
  const moveAutoPoint  = usePianoRollStore(s => s.moveAutoPoint)
  const removeAutoPoint= usePianoRollStore(s => s.removeAutoPoint)

  const svgRef = useRef<SVGSVGElement>(null)
  // Currently dragged point
  const [dragging, setDragging] = useState<string | null>(null)

  // Convert sorted points to SVG polyline points string
  const points = param.points

  const svgPoints = points.map(pt => {
    const x = beatToX(pt.beat, scrollX, zoomX)
    const y = valueToY(pt.value, param.min, param.max, LANE_H)
    return `${x},${y}`
  }).join(' ')

  const getSVGPos = useCallback((e: React.MouseEvent<SVGElement>): { x: number; y: number } => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const findPointAt = useCallback((x: number, y: number): AutomationPoint | null => {
    for (const pt of points) {
      const px = beatToX(pt.beat, scrollX, zoomX)
      const py = valueToY(pt.value, param.min, param.max, LANE_H)
      const dist = Math.hypot(x - px, y - py)
      if (dist <= POINT_R + 2) return pt
    }
    return null
  }, [points, scrollX, zoomX, param.min, param.max])

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGElement>) => {
    const { x, y } = getSVGPos(e)
    const hit = findPointAt(x, y)

    if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
      // Right-click or shift+click → remove
      if (hit) {
        e.preventDefault()
        removeAutoPoint(param.id, hit.id)
      }
      return
    }

    if (e.button !== 0) return

    if (hit) {
      // Start dragging existing point
      setDragging(hit.id)
    } else {
      // Click on empty → add point
      const beat  = clamp(xToBeat(x, scrollX, zoomX), 0, Infinity)
      const value = clamp(yToValue(y, param.min, param.max, LANE_H), param.min, param.max)
      addAutoPoint(param.id, beat, value)
    }
  }, [getSVGPos, findPointAt, removeAutoPoint, addAutoPoint, param, scrollX, zoomX])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGElement>) => {
    if (!dragging) return
    const { x, y } = getSVGPos(e)
    const beat  = clamp(xToBeat(x, scrollX, zoomX), 0, Infinity)
    const value = clamp(yToValue(y, param.min, param.max, LANE_H), param.min, param.max)
    moveAutoPoint(param.id, dragging, beat, value)
  }, [dragging, getSVGPos, scrollX, zoomX, param, moveAutoPoint])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent<SVGElement>) => {
    e.preventDefault()
    const { x, y } = getSVGPos(e)
    const hit = findPointAt(x, y)
    if (hit) removeAutoPoint(param.id, hit.id)
  }, [getSVGPos, findPointAt, removeAutoPoint, param.id])

  return (
    <svg
      ref={svgRef}
      style={{ flex: 1, height: LANE_H, display: 'block', cursor: dragging ? 'grabbing' : 'crosshair', userSelect: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      {/* Background grid line at default value */}
      <line
        x1={0}
        y1={valueToY(param.defaultValue, param.min, param.max, LANE_H)}
        x2="100%"
        y2={valueToY(param.defaultValue, param.min, param.max, LANE_H)}
        stroke={`${param.color}28`}
        strokeWidth={1}
      />

      {/* Line connecting points */}
      {points.length >= 2 && (
        <polyline
          points={svgPoints}
          fill="none"
          stroke={param.color}
          strokeWidth={1.5}
          strokeOpacity={0.7}
        />
      )}

      {/* Control points */}
      {points.map(pt => {
        const cx = beatToX(pt.beat, scrollX, zoomX)
        const cy = valueToY(pt.value, param.min, param.max, LANE_H)
        return (
          <circle
            key={pt.id}
            cx={cx}
            cy={cy}
            r={POINT_DRAW_R}
            fill={param.color}
            stroke="#0a0a14"
            strokeWidth={1.5}
            style={{ cursor: dragging === pt.id ? 'grabbing' : 'grab' }}
          />
        )
      })}

      {/* Hint when empty */}
      {points.length === 0 && (
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={8}
          fill={`${param.color}30`}
          style={{ textTransform: 'uppercase', letterSpacing: '0.15em', pointerEvents: 'none' }}
        >
          Click to add points
        </text>
      )}
    </svg>
  )
}

// ─── Single lane row ──────────────────────────────────────────────────────────

function AutoLane({ param }: { param: AutomationParam }) {
  const toggle = usePianoRollStore(s => s.toggleAutoParam)

  return (
    <div
      style={{
        borderTop:  '1px solid #12121f',
        background: param.visible ? '#0a0a14' : '#080810',
        overflow:   'hidden',
      }}
    >
      {/* Header row (always visible) */}
      <div
        className="flex items-center"
        style={{ height: 32 }}
      >
        <button
          onClick={() => toggle(param.id)}
          className="shrink-0 flex items-center gap-1.5 px-2 h-full transition-colors"
          style={{
            width:       LABEL_W,
            borderRight: '1px solid #12121f',
            background:  '#06060c',
            color:       param.visible ? param.color : '#2a2a3e',
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: param.visible ? param.color : '#1a1a28' }}
          />
          <span className="text-[9px] uppercase tracking-wider font-semibold truncate">
            {param.label}
          </span>
          <span className="ml-auto text-[9px]" style={{ color: '#2a2a3e' }}>
            {param.visible ? '▾' : '▸'}
          </span>
        </button>

        {/* Collapsed preview (flat line) */}
        {!param.visible && (
          <div className="flex-1 h-full flex items-center px-3">
            <span className="text-[8px]" style={{ color: '#1a1a28' }}>—</span>
          </div>
        )}

        {/* Expanded preview strip (thin 32px SVG) */}
        {param.visible && (
          <div style={{ flex: 1, height: 32, position: 'relative', overflow: 'hidden' }}>
            <AutoLaneSVG param={{ ...param }} />
          </div>
        )}
      </div>

      {/* Expanded editing area (extra height) */}
      {param.visible && (
        <div style={{ height: LANE_H, display: 'flex', borderTop: '1px solid #0d0d1a' }}>
          {/* Label spacer */}
          <div
            style={{
              width:       LABEL_W,
              flexShrink:  0,
              borderRight: '1px solid #12121f',
              background:  '#06060c',
              display:     'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding:     '2px 6px',
            }}
          >
            <span style={{ fontSize: 7, color: '#1e1e30' }}>{param.max}</span>
            <span style={{ fontSize: 7, color: '#1e1e30' }}>{param.defaultValue}</span>
            <span style={{ fontSize: 7, color: '#1e1e30' }}>{param.min}</span>
          </div>
          {/* Interactive SVG area */}
          <AutoLaneSVG param={param} />
        </div>
      )}
    </div>
  )
}

// ─── Container ────────────────────────────────────────────────────────────────

export default function AutomationLanes() {
  const params     = usePianoRollStore(s => s.autoParams)
  const anyVisible = params.some(p => p.visible)

  return (
    <div style={{ borderTop: '1px solid #1a1a2e', background: '#07070e' }}>
      {/* Section header */}
      <div
        className="flex items-center gap-2 px-3"
        style={{
          height:       22,
          borderBottom: '1px solid #111120',
          background:   '#05050b',
        }}
      >
        <span className="text-[8px] uppercase tracking-widest font-semibold" style={{ color: '#1e1e30' }}>
          Automation
        </span>
        {!anyVisible && (
          <span className="text-[8px]" style={{ color: '#14142a' }}>
            · click a lane to expand
          </span>
        )}
      </div>

      {params.map(p => (
        <AutoLane key={p.id} param={p} />
      ))}
    </div>
  )
}
