// ─── MonitorMeter.tsx ─────────────────────────────────────────────────────────
// Live input level meter for a single recording track. Canvas-based, props-driven.

import React, { useRef, useEffect, useCallback } from 'react'

export interface MonitorMeterProps {
  peak:        number   // 0..1 linear
  rms:         number   // 0..1 linear
  color?:      string   // default '#ef4444'
  height?:     number   // default 80
  width?:      number   // default 12
  latencyMs?:  number   // display only
}

const PEAK_HOLD_MS   = 2000
const CLIP_FLASH_MS  = 2000

const segmentColor = (db: number): string => {
  if (db >= -3)  return '#ef4444'  // red   — above -3 dB
  if (db >= -6)  return '#f97316'  // orange — -6 to -3 dB
  if (db >= -12) return '#eab308'  // yellow — -12 to -6 dB
  return '#22c55e'                 // green  — below -12 dB
}

export const MonitorMeter: React.FC<MonitorMeterProps> = ({
  peak,
  rms,
  height = 80,
  width  = 12,
  latencyMs,
}) => {
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const peakHoldLevel   = useRef(0)
  const peakHoldTime    = useRef(0)
  const clipFlashTime   = useRef(0)
  const rafRef          = useRef<number | null>(null)

  // Track latest props in refs so the rAF loop always reads fresh values
  const peakRef = useRef(peak)
  const rmsRef  = useRef(rms)
  peakRef.current = peak
  rmsRef.current  = rms

  // Detect clipping
  if (peak >= 1.0) {
    clipFlashTime.current = Date.now()
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const p   = peakRef.current
    const r   = rmsRef.current
    const now = Date.now()

    const dpr = window.devicePixelRatio ?? 1
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width  = width  * dpr
      canvas.height = height * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    // Peak bar with segmented colors — draw bottom-up in color bands
    const peakH = Math.min(1, p) * height
    const rmsH  = Math.min(1, r) * height

    // Draw colored peak bar using segments
    const dbPeak = p > 0 ? 20 * Math.log10(Math.max(p, 1e-6)) : -Infinity
    ctx.fillStyle = segmentColor(dbPeak)
    ctx.fillRect(0, height - peakH, width, peakH)

    // RMS overlay (dim upper portion of peak bar above rms)
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.fillRect(0, height - peakH, width, peakH - rmsH)

    // Peak hold line
    if (p > peakHoldLevel.current) {
      peakHoldLevel.current = p
      peakHoldTime.current  = now
    } else if (now - peakHoldTime.current > PEAK_HOLD_MS) {
      peakHoldLevel.current = Math.max(0, peakHoldLevel.current - 0.005)
    }
    const holdY     = height - peakHoldLevel.current * height
    const holdDb    = peakHoldLevel.current > 0
      ? 20 * Math.log10(Math.max(peakHoldLevel.current, 1e-6))
      : -Infinity
    ctx.fillStyle   = segmentColor(holdDb)
    ctx.fillRect(0, holdY - 1, width, 2)

    // Clipping flash indicator — red strip at top for 2 s
    if (now - clipFlashTime.current < CLIP_FLASH_MS) {
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(0, 0, width, 4)
    }
  }, [height, width])

  useEffect(() => {
    const loop = (): void => {
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: 'block' }}
        title={`Peak: ${(20 * Math.log10(Math.max(peak, 1e-6))).toFixed(1)} dBFS`}
      />
      {latencyMs !== undefined && (
        <span
          style={{
            fontFamily: 'monospace',
            fontSize:    9,
            color:      '#475569',
            lineHeight: 1,
          }}
        >
          {latencyMs}ms
        </span>
      )}
    </div>
  )
}

export default MonitorMeter
