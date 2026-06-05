import { useRef, useEffect } from 'react'
import type { ChannelLevel } from '../../audio/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Live ChannelLevel from useTrackLevel / useBusLevel hook. */
  level: ChannelLevel
  color: string      // track color hex (reserved for future tinting)
  height: number     // CSS height in px (canvas fills this)
  showLufs?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function linToDbFS(v: number): number {
  return v < 0.0001 ? -60 : Math.max(-60, 20 * Math.log10(v))
}

function dbFSToMeterY(db: number, meterH: number): number {
  // -60 = bottom (meterH), 0 = top (0)
  return meterH * (1 - (db + 60) / 60)
}

// ─── Module-level bar painter (avoids ctx narrowing inside closures) ──────────

interface BarOpts {
  ctx:         CanvasRenderingContext2D
  x:           number
  barW:        number
  meterY0:     number
  meterH:      number
  rmsSmoothed: number
  peakHold:    number
}

function paintBar({ ctx, x, barW, meterY0, meterH, rmsSmoothed, peakHold }: BarOpts) {
  const dbRms  = linToDbFS(rmsSmoothed)
  const dbPeak = linToDbFS(peakHold)

  // Inactive (dim) background for the full bar
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fillRect(x, meterY0, barW, meterH)

  // Active fill — draw zone by zone from bottom to top
  const zones: Array<{ bottom: number; top: number; zoneColor: string }> = [
    { bottom: -60, top: -12, zoneColor: '#10b981' },
    { bottom: -12, top: -3,  zoneColor: '#f59e0b' },
    { bottom: -3,  top:  0,  zoneColor: '#ef4444' },
  ]

  for (const zone of zones) {
    if (dbRms <= zone.bottom) continue
    const effectiveTop    = Math.min(dbRms, zone.top)
    const effectiveBottom = zone.bottom

    const yTop    = meterY0 + dbFSToMeterY(effectiveTop,    meterH)
    const yBottom = meterY0 + dbFSToMeterY(effectiveBottom, meterH)

    ctx.fillStyle = zone.zoneColor
    ctx.fillRect(x, yTop, barW, yBottom - yTop)
  }

  // Peak hold line (2px bright line)
  if (peakHold > 0.0001) {
    const py = meterY0 + dbFSToMeterY(dbPeak, meterH)
    ctx.fillStyle = dbPeak >= -3 ? '#ef4444' : '#ffffff'
    ctx.fillRect(x, py - 1, barW, 2)
  }
}

// ─── Scale markings ───────────────────────────────────────────────────────────

const SCALE_DB = [0, -6, -12, -18, -24, -36, -60]
const LUFS_FRAMES    = 180   // ~3s at 60 fps
const PEAK_HOLD_FRAMES = 120 // 2s at 60 fps
const PEAK_DECAY       = 0.985
const SCALE_RIGHT_PAD  = 22  // px reserved for scale labels on the right

// ─── Component ────────────────────────────────────────────────────────────────

export default function MeterCanvas({ level, color: _color, height, showLufs = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef   = useRef({ w: 1, h: height })
  const rafRef    = useRef(0)

  // Ballistic state — all in refs, never triggers React re-render
  const rmsLRef        = useRef(0)
  const rmsRRef        = useRef(0)
  const peakLRef       = useRef(0)
  const peakRRef       = useRef(0)
  const peakLHoldRef   = useRef(0)   // held peak value (linear)
  const peakRHoldRef   = useRef(0)
  const peakLTimerRef  = useRef(0)   // frames remaining at hold
  const peakRTimerRef  = useRef(0)
  const clipLRef       = useRef(false)
  const clipRRef       = useRef(false)

  // LUFS: circular buffer of ~180 frames for short-term LUFS estimate
  const lufsLBufRef = useRef(new Float32Array(LUFS_FRAMES))
  const lufsRBufRef = useRef(new Float32Array(LUFS_FRAMES))
  const lufsIdxRef  = useRef(0)

  // Mirror showLufs into a ref so the stable RAF closure can read it
  const showLufsRef = useRef(showLufs)
  showLufsRef.current = showLufs

  // Mirror level into a ref so the RAF closure always reads the latest value
  const levelRef = useRef(level)
  levelRef.current = level

  // ── Stable RAF draw loop ──────────────────────────────────────────────────
  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const { w: W, h: H } = sizeRef.current
      const dpr = window.devicePixelRatio || 1

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // ── Update ballistics ─────────────────────────────────────────────
      // Convert mono ChannelLevel to stereo (rms used for both L and R)
      const { rms, peak } = levelRef.current
      const rmsL = rms, rmsR = rms, peakL = peak, peakR = peak

      // RMS smoothing: fast attack (0.5), slow release (0.94)
      rmsLRef.current = rmsL > rmsLRef.current
        ? rmsLRef.current + (rmsL - rmsLRef.current) * 0.5
        : rmsLRef.current * 0.94
      rmsRRef.current = rmsR > rmsRRef.current
        ? rmsRRef.current + (rmsR - rmsRRef.current) * 0.5
        : rmsRRef.current * 0.94

      // Peak envelope (fast attack, medium release)
      peakLRef.current = Math.max(peakLRef.current * 0.98, peakL)
      peakRRef.current = Math.max(peakRRef.current * 0.98, peakR)

      // Peak hold logic
      if (peakL >= peakLHoldRef.current) {
        peakLHoldRef.current  = peakL
        peakLTimerRef.current = PEAK_HOLD_FRAMES
      } else if (peakLTimerRef.current > 0) {
        peakLTimerRef.current--
      } else {
        peakLHoldRef.current *= PEAK_DECAY
      }

      if (peakR >= peakRHoldRef.current) {
        peakRHoldRef.current  = peakR
        peakRTimerRef.current = PEAK_HOLD_FRAMES
      } else if (peakRTimerRef.current > 0) {
        peakRTimerRef.current--
      } else {
        peakRHoldRef.current *= PEAK_DECAY
      }

      // Latch clip indicators
      if (peakL >= 0.99) clipLRef.current = true
      if (peakR >= 0.99) clipRRef.current = true

      // LUFS circular buffer update
      const idx = lufsIdxRef.current
      lufsLBufRef.current[idx] = rmsLRef.current
      lufsRBufRef.current[idx] = rmsRRef.current
      lufsIdxRef.current = (idx + 1) % LUFS_FRAMES

      // ── Layout ───────────────────────────────────────────────────────
      const lufsH   = showLufsRef.current ? 18 : 0
      const clipH   = 4
      const meterH  = H - lufsH - clipH - 2
      const meterY0 = clipH + 2

      const meterW  = Math.max(1, W - SCALE_RIGHT_PAD)
      const barW    = Math.max(2, Math.floor((meterW - 2) / 2))
      const gap     = 2
      const lx      = 0
      const rx      = barW + gap

      // ── Background ───────────────────────────────────────────────────
      ctx.fillStyle = '#050509'
      ctx.fillRect(0, 0, W, H)

      // ── Meter bars ────────────────────────────────────────────────────
      paintBar({ ctx, x: lx, barW, meterY0, meterH, rmsSmoothed: rmsLRef.current, peakHold: peakLHoldRef.current })
      paintBar({ ctx, x: rx, barW, meterY0, meterH, rmsSmoothed: rmsRRef.current, peakHold: peakRHoldRef.current })

      // ── Clip indicators (3px strip at top) ───────────────────────────
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(lx, 0, barW, clipH - 1)
      ctx.fillRect(rx, 0, barW, clipH - 1)

      if (clipLRef.current) {
        ctx.shadowColor = '#ef4444'
        ctx.shadowBlur  = 6
        ctx.fillStyle   = '#ef4444'
        ctx.fillRect(lx, 0, barW, clipH - 1)
        ctx.shadowBlur  = 0
      }
      if (clipRRef.current) {
        ctx.shadowColor = '#ef4444'
        ctx.shadowBlur  = 6
        ctx.fillStyle   = '#ef4444'
        ctx.fillRect(rx, 0, barW, clipH - 1)
        ctx.shadowBlur  = 0
      }

      // ── Scale labels ──────────────────────────────────────────────────
      ctx.fillStyle    = '#2a2a3d'
      ctx.font         = '8px Inter, system-ui, sans-serif'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'middle'
      const scaleX = meterW + 2
      for (const db of SCALE_DB) {
        const y = meterY0 + dbFSToMeterY(db, meterH)
        ctx.fillText(db === 0 ? '0' : String(db), scaleX, y)
      }

      // ── LUFS display ──────────────────────────────────────────────────
      if (showLufsRef.current) {
        let sumL = 0, sumR = 0
        const bufL = lufsLBufRef.current
        const bufR = lufsRBufRef.current
        for (let i = 0; i < LUFS_FRAMES; i++) {
          sumL += bufL[i] * bufL[i]
          sumR += bufR[i] * bufR[i]
        }
        const meanRms   = Math.sqrt((sumL + sumR) / (2 * LUFS_FRAMES))
        const lufsVal   = meanRms < 0.0001 ? -60 : Math.max(-60, 20 * Math.log10(meanRms))
        const lufsColor = lufsVal > -9 ? '#ef4444' : lufsVal > -16 ? '#f59e0b' : '#10b981'

        const ty = H - lufsH + 10
        ctx.fillStyle    = '#334155'
        ctx.font         = '8px Inter, system-ui, sans-serif'
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText('LU', 0, ty)

        ctx.fillStyle = lufsColor
        ctx.font      = '8px "SF Mono", "Fira Code", monospace'
        ctx.fillText(lufsVal.toFixed(1), 14, ty)
      }
    }

    function loop() {
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // stable — reads everything via refs

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const ro  = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { inlineSize: w, blockSize: h } = entry.contentBoxSize[0]
        sizeRef.current = { w, h }
        canvas.width    = Math.round(w * dpr)
        canvas.height   = Math.round(h * dpr)
        const c = canvas.getContext('2d')
        if (c) c.scale(dpr, dpr)
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, display: 'block' }}
    />
  )
}
