// ─── LoudnessMeterView ────────────────────────────────────────────────────────
// VU bars, LUFS display, LRA, and TruePeak warning.

import { useRef, useEffect } from 'react'
import type { LoudnessMeasurement } from '../../audio/meters/LoudnessMeter'
import type { VuMeterData } from '../../audio/meters/StereoMeter'

interface Props {
  loudness: LoudnessMeasurement | null
  vu:       VuMeterData | null
  width?:   number
  height?:  number
}

const DB_MIN    = -60
const DB_MAX    = 0
const DB_RANGE  = DB_MAX - DB_MIN

function dbToFrac(db: number): number {
  return Math.max(0, Math.min(1, (db - DB_MIN) / DB_RANGE))
}

function barColor(db: number): string {
  if (db > -3)  return '#ef4444'
  if (db > -12) return '#f59e0b'
  return '#10b981'
}

function VuBar({
  db,
  peakDb,
  label,
  height,
}: { db: number; peakDb: number; label: string; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
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

    // Bar fill
    const frac  = dbToFrac(db)
    const barH  = frac * (H - 2)
    const barY  = H - 1 - barH
    ctx.fillStyle = barColor(db)
    ctx.fillRect(1, barY, W - 2, barH)

    // Peak line
    if (isFinite(peakDb)) {
      const peakFrac = dbToFrac(peakDb)
      const peakY    = H - 1 - peakFrac * (H - 2)
      ctx.fillStyle  = '#fff'
      ctx.fillRect(1, peakY, W - 2, 2)
    }

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font      = '8px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(label, W / 2, H - 1)
  }, [db, peakDb, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = 20      * dpr
    canvas.height = height  * dpr
    canvas.style.width  = '20px'
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [height])

  return <canvas ref={canvasRef} className="block" />
}

export function LoudnessMeterView({
  loudness,
  vu,
  width  = 300,
  height = 160,
}: Props) {
  const leftDb      = vu?.leftDb      ?? -Infinity
  const rightDb     = vu?.rightDb     ?? -Infinity
  const leftPeakDb  = vu?.leftPeakDb  ?? -Infinity
  const rightPeakDb = vu?.rightPeakDb ?? -Infinity

  const truePeak    = loudness?.truePeak ?? -Infinity
  const truePeakClipping = truePeak > -0.3

  return (
    <div
      className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300"
      style={{ width }}
    >
      <div className="text-slate-400 mb-2">LOUDNESS</div>

      {/* VU Bars */}
      <div className="flex gap-2 justify-center mb-3" style={{ height }}>
        <VuBar db={leftDb}  peakDb={leftPeakDb}  label="L" height={height} />
        <VuBar db={rightDb} peakDb={rightPeakDb} label="R" height={height} />
      </div>

      {/* LUFS display */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-slate-800 rounded px-2 py-1">
          <div className="text-slate-500">MOMENTARY</div>
          <div className={`font-bold ${loudness && loudness.momentary > -9 ? 'text-red-400' : 'text-green-400'}`}>
            {loudness && isFinite(loudness.momentary)
              ? `${loudness.momentary.toFixed(1)} LUFS`
              : '– LUFS'}
          </div>
        </div>
        <div className="bg-slate-800 rounded px-2 py-1">
          <div className="text-slate-500">SHORT-TERM</div>
          <div className="text-blue-400 font-bold">
            {loudness && isFinite(loudness.shortTerm)
              ? `${loudness.shortTerm.toFixed(1)} LUFS`
              : '– LUFS'}
          </div>
        </div>
        <div className="bg-slate-800 rounded px-2 py-1">
          <div className="text-slate-500">INTEGRATED</div>
          <div className="text-purple-400 font-bold">
            {loudness && isFinite(loudness.integrated)
              ? `${loudness.integrated.toFixed(1)} LUFS`
              : '– LUFS'}
          </div>
        </div>
        <div className="bg-slate-800 rounded px-2 py-1">
          <div className="text-slate-500">LRA</div>
          <div className="text-yellow-400 font-bold">
            {loudness && isFinite(loudness.range)
              ? `${loudness.range.toFixed(1)} LU`
              : '– LU'}
          </div>
        </div>
      </div>

      {/* True Peak */}
      <div className={`mt-2 rounded px-2 py-1 text-[10px] font-bold ${
        truePeakClipping
          ? 'bg-red-900/50 text-red-400'
          : 'bg-slate-800 text-slate-400'
      }`}>
        TRUE PEAK: {isFinite(truePeak) ? `${truePeak.toFixed(2)} dBTP` : '–'}
        {truePeakClipping && ' ⚠ EXCEEDS -0.3 dBTP'}
      </div>
    </div>
  )
}
