// ─── EnergyTimelineBar.tsx ────────────────────────────────────────────────────
// Thin horizontal energy timeline bar with section labels and playhead.

import { useRef, useEffect } from 'react'
import type { MusicContext } from '../../audio/ai/MusicContextEngine'

interface EnergyTimelineBarProps {
  context: MusicContext | null
  playheadBar?: number    // current playhead position in bars
  isPlaying?: boolean
}

export default function EnergyTimelineBar({ context, playheadBar, isPlaying }: EnergyTimelineBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !context) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const curve = context.arrangement.energyCurve
    const n = curve.length

    ctx.clearRect(0, 0, w, h)

    if (n === 0) {
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(0, 0, w, h)
      return
    }

    // Draw energy as gradient blocks
    for (let i = 0; i < n; i++) {
      const val = curve[i] ?? 0
      const x = (i / n) * w
      const barW = (1 / n) * w + 1

      // Color gradient: low=#1e1b4b mid=#7c3aed high=#ec4899
      let r: number, g: number, b: number
      if (val < 0.5) {
        const t = val * 2
        r = Math.round(30 + t * (124 - 30))
        g = Math.round(27 + t * (58 - 27))
        b = Math.round(75 + t * (237 - 75))
      } else {
        const t = (val - 0.5) * 2
        r = Math.round(124 + t * (236 - 124))
        g = Math.round(58 + t * (72 - 58))
        b = Math.round(237 + t * (153 - 237))
      }

      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(Math.floor(x), 8, Math.ceil(barW), h - 8)
    }

    // Draw section labels above
    for (const section of context.arrangement.sections) {
      const x = (section.startBar / n) * w
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '8px monospace'
      ctx.fillText(section.label.slice(0, 4), x + 2, 7)
    }

    // Draw playhead
    if (isPlaying && playheadBar !== undefined && n > 0) {
      const px = (playheadBar / n) * w
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(px - 1, 0, 2, h)
    }
  }, [context, playheadBar, isPlaying])

  if (!context) {
    return (
      <div
        className="w-full rounded overflow-hidden bg-gray-800"
        style={{ height: 24 }}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={24}
      className="w-full rounded overflow-hidden"
      style={{ height: 24, imageRendering: 'pixelated' }}
      title="Energy timeline — hover for section info"
    />
  )
}
