// ─── AutomationLaneEditor.tsx ─────────────────────────────────────────────────
// Canvas-based automation lane editor with draw/select/erase modes.

import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { AutomationCurveType, AutomationLane, AutomationPoint } from '../../audio/automation/AutomationTypes'
import { evaluateLaneAt } from '../../audio/automation/AutomationCurve'
import { AutomationPointMenu } from './AutomationPointMenu'

interface AutomationLaneEditorProps {
  lane: AutomationLane
  width: number
  height: number
  zoom: number
  scrollBeat: number
  snapBeats: number
  snapEnabled: boolean
  editMode: 'draw' | 'select' | 'erase'
  onPointAdd: (beat: number, value: number) => void
  onPointMove: (pointId: string, beat: number, value: number) => void
  onPointRemove: (pointId: string) => void
  onCurveChange: (pointId: string, curve: AutomationCurveType) => void
}

interface HoverState {
  x: number
  beat: number
  value: number
}

interface ContextMenuState {
  x: number
  y: number
  point: AutomationPoint
}

interface DragState {
  pointId: string
  startX: number
  startY: number
}

function snapBeat(beat: number, snapBeats: number, enabled: boolean): number {
  if (!enabled) return beat
  return Math.round(beat / snapBeats) * snapBeats
}

function findPointNear(
  points: AutomationPoint[],
  x: number,
  y: number,
  zoom: number,
  scrollBeat: number,
  height: number,
  radius: number
): AutomationPoint | null {
  for (const p of points) {
    const px = (p.beat - scrollBeat) * zoom
    const py = (1 - p.value) * height
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2)
    if (dist <= radius) return p
  }
  return null
}

export function AutomationLaneEditor({
  lane,
  width,
  height,
  zoom,
  scrollBeat,
  snapBeats,
  snapEnabled,
  editMode,
  onPointAdd,
  onPointMove,
  onPointRemove,
  onCurveChange,
}: AutomationLaneEditorProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<HoverState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#0d0d1a'
    ctx.fillRect(0, 0, width, height)

    // Grid lines — vertical beats
    const firstBeat = Math.floor(scrollBeat)
    const lastBeat = Math.ceil(scrollBeat + width / zoom) + 1
    for (let beat = firstBeat; beat <= lastBeat; beat++) {
      const x = (beat - scrollBeat) * zoom
      ctx.strokeStyle = beat % 4 === 0 ? '#252540' : '#1a1a2e'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Grid lines — horizontal normalized values
    for (const val of [0.25, 0.5, 0.75]) {
      const y = (1 - val) * height
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw automation curve as filled path
    if (lane.points.length > 0) {
      const startBeat = scrollBeat
      const y0 = (1 - evaluateLaneAt(lane.points, startBeat)) * height

      ctx.beginPath()
      ctx.moveTo(0, height)
      ctx.lineTo(0, y0)

      for (let x = 1; x <= width; x++) {
        const beat = scrollBeat + x / zoom
        const val = evaluateLaneAt(lane.points, beat)
        const y = (1 - val) * height
        ctx.lineTo(x, y)
      }

      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fillStyle = lane.color + '28'
      ctx.fill()

      // Stroke the curve line
      ctx.beginPath()
      ctx.moveTo(0, y0)
      for (let x = 1; x <= width; x++) {
        const beat = scrollBeat + x / zoom
        const val = evaluateLaneAt(lane.points, beat)
        const y = (1 - val) * height
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = lane.color
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Draw points
    for (const point of lane.points) {
      const px = (point.beat - scrollBeat) * zoom
      if (px < -10 || px > width + 10) continue
      const py = (1 - point.value) * height

      // Bezier handles
      if (point.curveType === 'bezier') {
        const inX = px + point.inHandle.dx * zoom
        const inY = py + point.inHandle.dy * height
        const outX = px + point.outHandle.dx * zoom
        const outY = py + point.outHandle.dy * height

        ctx.strokeStyle = lane.color + '88'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(inX, inY)
        ctx.lineTo(px, py)
        ctx.lineTo(outX, outY)
        ctx.stroke()

        // Handle squares
        ctx.fillStyle = lane.color + 'aa'
        ctx.fillRect(inX - 3, inY - 3, 6, 6)
        ctx.fillRect(outX - 3, outY - 3, 6, 6)
      }

      // Point circle
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.strokeStyle = lane.color
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Hover line
    if (hover) {
      ctx.strokeStyle = '#ffffff44'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(hover.x, 0)
      ctx.lineTo(hover.x, height)
      ctx.stroke()
      ctx.setLineDash([])

      // Tooltip
      const label = hover.value.toFixed(3)
      ctx.fillStyle = '#000000cc'
      ctx.fillRect(hover.x + 8, 4, 52, 18)
      ctx.fillStyle = '#fff'
      ctx.font = '11px monospace'
      ctx.fillText(label, hover.x + 12, 17)
    }
  }, [lane, width, height, zoom, scrollBeat, hover])

  const getMousePos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      return { x, y }
    },
    []
  )

  const toBeatValue = useCallback(
    (x: number, y: number) => {
      const beat = scrollBeat + x / zoom
      const value = Math.max(0, Math.min(1, 1 - y / height))
      return { beat, value }
    },
    [scrollBeat, zoom, height]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return
      const { x, y } = getMousePos(e)
      const { beat: rawBeat, value } = toBeatValue(x, y)
      const beat = snapBeat(rawBeat, snapBeats, snapEnabled)

      if (editMode === 'draw') {
        onPointAdd(beat, value)
      } else if (editMode === 'select') {
        const found = findPointNear(lane.points, x, y, zoom, scrollBeat, height, 8)
        if (found) {
          const ds: DragState = { pointId: found.id, startX: x, startY: y }
          setDrag(ds)
          dragRef.current = ds
        }
      } else if (editMode === 'erase') {
        const found = findPointNear(lane.points, x, y, zoom, scrollBeat, height, 12)
        if (found) {
          onPointRemove(found.id)
        }
      }
    },
    [editMode, getMousePos, toBeatValue, lane.points, zoom, scrollBeat, height, snapBeats, snapEnabled, onPointAdd, onPointRemove]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getMousePos(e)
      const { beat, value } = toBeatValue(x, y)
      setHover({ x, beat, value })

      if (dragRef.current) {
        const { beat: rawBeat, value: val } = toBeatValue(x, y)
        const snappedBeat = snapBeat(rawBeat, snapBeats, snapEnabled)
        onPointMove(dragRef.current.pointId, snappedBeat, val)
      }
    },
    [getMousePos, toBeatValue, snapBeats, snapEnabled, onPointMove]
  )

  const handleMouseUp = useCallback(() => {
    setDrag(null)
    dragRef.current = null
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHover(null)
    setDrag(null)
    dragRef.current = null
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const { x, y } = getMousePos(e)
      const found = findPointNear(lane.points, x, y, zoom, scrollBeat, height, 10)
      if (found) {
        setContextMenu({ x: e.clientX, y: e.clientY, point: found })
      }
    },
    [getMousePos, lane.points, zoom, scrollBeat, height]
  )

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: 'block', cursor: editMode === 'erase' ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />
      {contextMenu && (
        <AutomationPointMenu
          x={contextMenu.x}
          y={contextMenu.y}
          currentCurve={contextMenu.point.curveType}
          onSelect={(c) => {
            onCurveChange(contextMenu.point.id, c)
          }}
          onDelete={() => {
            onPointRemove(contextMenu.point.id)
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
      {drag !== null && <div style={{ display: 'none' }} />}
    </div>
  )
}
