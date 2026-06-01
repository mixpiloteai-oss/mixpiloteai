// ─── StereoImageView ──────────────────────────────────────────────────────────
// Goniometer Lissajous canvas + correlation meter bar.

import { useRef, useEffect } from 'react'
import type { GoniometerData } from '../../audio/analysis/StereoAnalyzer'

interface Props {
  goniometer:  GoniometerData | null
  correlation: number
  width?:      number
  height?:     number
}

export function StereoImageView({
  goniometer,
  correlation,
  width  = 200,
  height = 200,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const corrRef   = useRef<HTMLCanvasElement>(null)

  // Draw goniometer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !goniometer) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W   = canvas.width  / dpr
    const H   = canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // Center cross
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H)
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2)
    ctx.stroke()

    // Diagonal guides
    ctx.beginPath()
    ctx.moveTo(0, H); ctx.lineTo(W, 0)
    ctx.moveTo(0, 0); ctx.lineTo(W, H)
    ctx.stroke()

    // Lissajous dots
    ctx.fillStyle = 'rgba(16,185,129,0.7)'  // green
    const scale = W / 2 * 0.9
    const cx    = W / 2
    const cy    = H / 2

    const { mid, side } = goniometer
    const N = Math.min(mid.length, side.length)
    for (let i = 0; i < N; i++) {
      const m = mid[i] ?? 0
      const s = side[i] ?? 0
      const x = cx + s * scale
      const y = cy - m * scale
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1)
    }

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font      = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('M', W / 2, 10)
    ctx.fillText('L', 6, H / 2 + 3)
    ctx.fillText('R', W - 6, H / 2 + 3)
  }, [goniometer])

  // Draw correlation meter
  useEffect(() => {
    const canvas = corrRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W   = canvas.width  / dpr
    const H   = canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, W, H)

    // Fill: correlation ranges -1 to +1 → 0 to W
    const fill = ((correlation + 1) / 2) * W
    const color = correlation < -0.3
      ? '#ef4444'
      : correlation < 0
      ? '#f59e0b'
      : '#10b981'

    ctx.fillStyle = color
    ctx.fillRect(0, 2, Math.max(0, fill), H - 4)

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(W / 2, 0)
    ctx.lineTo(W / 2, H)
    ctx.stroke()

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font      = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Corr: ${correlation.toFixed(2)}`, W / 2, H / 2 + 3)
  }, [correlation])

  // Set canvas sizes on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    canvas.style.width  = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [width, height])

  useEffect(() => {
    const canvas = corrRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = width * dpr
    canvas.height = 20   * dpr
    canvas.style.width  = `${width}px`
    canvas.style.height = '20px'
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [width])

  return (
    <div className="flex flex-col gap-1 bg-slate-900 rounded-lg overflow-hidden p-2">
      <div className="text-xs text-slate-400 font-mono mb-1">STEREO IMAGE</div>
      <canvas ref={canvasRef} className="block rounded" />
      <canvas ref={corrRef}   className="block rounded mt-1" />
    </div>
  )
}
