// ─── AutomationMiniLane.tsx ───────────────────────────────────────────────────
// Read-only compact lane view — 16px height, full width.

import React, { useRef, useEffect } from 'react'
import type { AutomationLane } from '../../audio/automation/AutomationTypes'
import { evaluateLaneAt } from '../../audio/automation/AutomationCurve'

interface AutomationMiniLaneProps {
  lane: AutomationLane
  width: number
  totalBeats: number
}

export function AutomationMiniLane({
  lane,
  width,
  totalBeats,
}: AutomationMiniLaneProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const height = 16
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#0d0d1a'
    ctx.fillRect(0, 0, width, height)

    if (lane.points.length === 0) return

    const pixelsPerBeat = width / Math.max(totalBeats, 1)

    ctx.beginPath()
    ctx.moveTo(0, height)

    for (let x = 0; x <= width; x++) {
      const beat = x / pixelsPerBeat
      const val = evaluateLaneAt(lane.points, beat)
      const y = (1 - val) * height
      if (x === 0) {
        ctx.lineTo(0, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fillStyle = lane.color + '28'
    ctx.fill()

    ctx.beginPath()
    for (let x = 0; x <= width; x++) {
      const beat = x / pixelsPerBeat
      const val = evaluateLaneAt(lane.points, beat)
      const y = (1 - val) * height
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = lane.color
    ctx.lineWidth = 1
    ctx.stroke()
  }, [lane, width, totalBeats])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height: 16, display: 'block' }}
    />
  )
}
