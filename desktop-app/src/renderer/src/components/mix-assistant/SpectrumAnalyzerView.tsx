// ─── SpectrumAnalyzerView ─────────────────────────────────────────────────────
// HiDPI canvas spectrum analyzer: 64 log bars, green/yellow/red, labeled axes.

import { useRef, useEffect, useCallback } from 'react'
import type { SpectrumData } from '../../audio/analysis/FrequencyAnalyzer'
import { SpectrumMeter } from '../../audio/meters/SpectrumMeter'

interface Props {
  spectrum:   SpectrumData | null
  sampleRate: number
  width?:     number
  height?:    number
}

const NUM_BARS   = 64
const DB_MIN     = -80
const DB_MAX     = 0
const DB_RANGE   = DB_MAX - DB_MIN

const FREQ_LABELS = [50, 100, 200, 500, '1k', '2k', '5k', '10k', '20k']

function dbToY(db: number, canvasH: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db))
  return canvasH * (1 - (clamped - DB_MIN) / DB_RANGE)
}

function barColor(db: number): string {
  if (db > -6)  return '#ef4444'  // red
  if (db > -18) return '#f59e0b'  // yellow
  return '#10b981'                // green
}

export function SpectrumAnalyzerView({
  spectrum,
  sampleRate,
  width = 600,
  height = 200,
}: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const meterRef    = useRef(new SpectrumMeter())
  const prevBarsRef = useRef<Float32Array>(new Float32Array(NUM_BARS).fill(-120))

  const draw = useCallback((bars: Float32Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W   = canvas.width  / dpr
    const H   = canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth   = 1
    const dbSteps = [-60, -48, -36, -24, -12, -6]
    for (const db of dbSteps) {
      const y = dbToY(db, H - 24)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // Bars
    const barW   = (W - 4) / NUM_BARS
    const plotH  = H - 24
    for (let i = 0; i < NUM_BARS; i++) {
      const db   = bars[i] ?? -120
      const x    = 2 + i * barW
      const barH = Math.max(1, plotH - dbToY(db, plotH))
      const y    = plotH - barH

      ctx.fillStyle = barColor(db)
      ctx.fillRect(x, y, barW - 1, barH)
    }

    // Frequency axis labels
    ctx.fillStyle    = 'rgba(255,255,255,0.4)'
    ctx.font         = '9px sans-serif'
    ctx.textAlign    = 'center'
    const nyquist    = sampleRate / 2
    for (const label of FREQ_LABELS) {
      const freqHz = typeof label === 'string'
        ? parseFloat(label) * 1000
        : label
      const barIdx = Math.round(
        (Math.log(freqHz / 20) / Math.log(nyquist / 20)) * NUM_BARS,
      )
      if (barIdx >= 0 && barIdx < NUM_BARS) {
        const x = 2 + barIdx * barW + barW / 2
        ctx.fillText(String(label), x, H - 6)
      }
    }

    // dB labels
    ctx.textAlign = 'right'
    for (const db of [-60, -24, -12, -6]) {
      const y = dbToY(db, plotH)
      ctx.fillText(`${db}`, W - 2, y + 3)
    }
  }, [sampleRate])

  // React to spectrum prop changes
  useEffect(() => {
    if (!spectrum) return

    const meter = meterRef.current
    const rawBars = meter.computeBarHeights(spectrum, NUM_BARS, sampleRate)
    const smooth  = meter.computeSmoothedSpectrum(prevBarsRef.current, rawBars, 0.75)
    prevBarsRef.current = smooth
    draw(smooth)
  }, [spectrum, sampleRate, draw])

  // Set canvas size on mount / resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    canvas.style.width  = `${width}px`
    canvas.style.height = `${height}px`
    ctx_transform(canvas, dpr)
  }, [width, height])

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden">
      <canvas ref={canvasRef} className="block" />
      <div className="absolute top-1 left-2 text-xs text-slate-400 font-mono">
        SPECTRUM
      </div>
    </div>
  )
}

function ctx_transform(canvas: HTMLCanvasElement, dpr: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
