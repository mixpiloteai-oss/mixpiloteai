// ─── MeterBar.tsx ─────────────────────────────────────────────────────────────
// Single-channel vertical peak+RMS meter bar with peak hold and clipping indicator.

import React, { useRef, useEffect, useCallback } from 'react'

interface MeterBarProps {
  peak:       number   // 0–1 linear
  rms:        number   // 0–1 linear
  isClipping: boolean
  height?:    number
  width?:     number
}

const PEAK_HOLD_MS = 2000

const dBColor = (db: number): string => {
  if (db >= -3)  return '#ef4444'  // red
  if (db >= -6)  return '#f97316'  // orange
  if (db >= -12) return '#eab308'  // yellow
  return '#22c55e'                 // green
}

export const MeterBar: React.FC<MeterBarProps> = ({ peak, rms, isClipping, height = 120, width = 8 }) => {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const peakHold       = useRef(0)
  const peakHoldTimer  = useRef<number>(0)
  const rafRef         = useRef<number | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio ?? 1
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width  = width  * dpr
      canvas.height = height * dpr
    }
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    // Peak bar
    const peakH = Math.min(1, peak) * height
    const db    = peak > 0 ? 20 * Math.log10(Math.max(peak, 1e-6)) : -Infinity
    ctx.fillStyle = dBColor(db)
    ctx.fillRect(0, height - peakH, width, peakH)

    // RMS overlay (slightly dimmer)
    const rmsH = Math.min(1, rms) * height
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(0, height - peakH, width, peakH - rmsH)

    // Peak hold line
    if (peak > peakHold.current) {
      peakHold.current     = peak
      peakHoldTimer.current = Date.now()
    } else if (Date.now() - peakHoldTimer.current > PEAK_HOLD_MS) {
      peakHold.current = Math.max(0, peakHold.current - 0.01)
    }
    const holdY = height - peakHold.current * height
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(0, holdY - 1, width, 2)

    // Clip indicator
    if (isClipping) {
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(0, 0, width, 4)
    }
  }, [peak, rms, isClipping, height, width])

  useEffect(() => {
    const loop = (): void => { draw(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
      title={`Peak: ${(20 * Math.log10(Math.max(peak, 1e-6))).toFixed(1)} dBFS`}
    />
  )
}

export default MeterBar
