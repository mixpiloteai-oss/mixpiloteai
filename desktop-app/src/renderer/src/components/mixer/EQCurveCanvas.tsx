import { useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EQBand {
  freq:    number   // Hz (20–20000)
  gain:    number   // dB (-18 to +18)
  q:       number   // 0.1 to 10
  type:    'lowshelf' | 'peak' | 'highshelf' | 'highpass' | 'lowpass'
  enabled: boolean
}

interface Props {
  bands:          EQBand[]
  color:          string
  width:          number    // CSS width
  height:         number    // CSS height (typically 36px)
  enabled:        boolean
  onBandChange?:  (index: number, band: Partial<EQBand>) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NUM_POINTS = 64
const FREQ_MIN   = 20
const FREQ_MAX   = 20000
const LOG_RANGE  = Math.log10(FREQ_MAX / FREQ_MIN)
const DB_RANGE   = 18   // ±18 dB shown

// Pre-compute frequency points
const EVAL_FREQS: number[] = Array.from({ length: NUM_POINTS }, (_, i) =>
  FREQ_MIN * Math.pow(10, (i / (NUM_POINTS - 1)) * LOG_RANGE)
)

const GRID_FREQS: Array<{ hz: number; label: string }> = [
  { hz: 100,   label: '100' },
  { hz: 1000,  label: '1k'  },
  { hz: 10000, label: '10k' },
]

// ─── EQ band response calculation ────────────────────────────────────────────

/**
 * Compute dB gain contribution of a single band at frequency `f`.
 * Uses simplified display-quality formulas (not biquad coefficients).
 */
function bandGainAt(band: EQBand, f: number): number {
  if (!band.enabled || band.gain === 0) {
    // Pass-through filters still contribute shape at 0 dB
    if (band.type === 'highpass' || band.type === 'lowpass') {
      // Fall through to shape calculation
    } else {
      return 0
    }
  }

  const fc = band.freq
  const G  = band.gain
  const Q  = Math.max(0.1, band.q)

  switch (band.type) {
    case 'peak': {
      // Lorentzian bell: G / (1 + ((f/fc - fc/f) * Q)^2)
      const norm = (f / fc - fc / f) * Q
      return G / (1 + norm * norm)
    }

    case 'lowshelf': {
      // Smooth low shelf: full gain below fc, tapers above
      const slope = Q * 2  // Q controls slope steepness
      const x     = Math.log10(f / fc) * slope
      // Sigmoid: G * (1 - 1/(1+exp(-x*3)))
      return G * (1 - 1 / (1 + Math.exp(-x * 3)))
    }

    case 'highshelf': {
      // Smooth high shelf: full gain above fc, tapers below
      const slope = Q * 2
      const x     = Math.log10(f / fc) * slope
      return G * (1 / (1 + Math.exp(-x * 3)))
    }

    case 'highpass': {
      // Display as a gentle gain reduction below fc
      if (f >= fc) return 0
      // 2nd-order style roll-off for display
      const rolloff = -12 * Math.log10(1 + Math.pow(fc / f, 2 * Q))
      return Math.max(-DB_RANGE, rolloff * 0.5) * (band.enabled ? 1 : 0)
    }

    case 'lowpass': {
      // Display as a gentle gain reduction above fc
      if (f <= fc) return 0
      const rolloff = -12 * Math.log10(1 + Math.pow(f / fc, 2 * Q))
      return Math.max(-DB_RANGE, rolloff * 0.5) * (band.enabled ? 1 : 0)
    }

    default:
      return 0
  }
}

/** Sum all band contributions at frequency f. */
function totalGainAt(bands: EQBand[], f: number): number {
  let total = 0
  for (const band of bands) {
    total += bandGainAt(band, f)
  }
  return Math.max(-DB_RANGE, Math.min(DB_RANGE, total))
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function freqToX(hz: number, W: number): number {
  return (Math.log10(hz / FREQ_MIN) / LOG_RANGE) * W
}

function dbToY(db: number, H: number): number {
  // 0 dB = center, +DB_RANGE = top, -DB_RANGE = bottom
  return H * 0.5 * (1 - db / DB_RANGE)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EQCurveCanvas({ bands, color, width, height, enabled, onBandChange: _onBandChange }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const sizeRef    = useRef({ w: width, h: height })
  const rafRef     = useRef(0)

  // Mirror props into refs so the stable RAF closure always reads latest
  const bandsRef   = useRef(bands)
  const colorRef   = useRef(color)
  const enabledRef = useRef(enabled)
  bandsRef.current   = bands
  colorRef.current   = color
  enabledRef.current = enabled

  // ── Stable RAF draw loop ─────────────────────────────────────────────────
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

      const currentBands   = bandsRef.current
      const currentColor   = colorRef.current
      const currentEnabled = enabledRef.current

      // ── Background ───────────────────────────────────────────────────
      ctx.fillStyle = '#070710'
      ctx.fillRect(0, 0, W, H)

      // ── 0 dB reference line ───────────────────────────────────────────
      const zeroY = dbToY(0, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth   = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(0, zeroY)
      ctx.lineTo(W, zeroY)
      ctx.stroke()
      ctx.setLineDash([])

      // ── Vertical frequency grid ───────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth   = 1
      ctx.fillStyle   = '#2a2a3d'
      ctx.font        = '7px Inter, system-ui, sans-serif'
      ctx.textAlign   = 'center'
      ctx.textBaseline = 'bottom'

      for (const { hz, label } of GRID_FREQS) {
        const x = freqToX(hz, W)
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
        ctx.fillText(label, x, H)
      }

      // ── Compute EQ curve points ───────────────────────────────────────
      const pts: Array<{ x: number; y: number }> = EVAL_FREQS.map(f => ({
        x: freqToX(f, W),
        y: dbToY(totalGainAt(currentBands, f), H),
      }))

      // ── Fill below the curve ──────────────────────────────────────────
      const fillColor = currentEnabled
        ? currentColor + '18'
        : 'rgba(255,255,255,0.04)'

      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) * 0.5
        const my = (pts[i].y + pts[i + 1].y) * 0.5
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.closePath()
      ctx.fillStyle = fillColor
      ctx.fill()

      // ── Stroke the EQ curve ───────────────────────────────────────────
      const strokeColor = currentEnabled
        ? currentColor + 'cc'
        : 'rgba(255,255,255,0.20)'

      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) * 0.5
        const my = (pts[i].y + pts[i + 1].y) * 0.5
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth   = 1.5
      ctx.stroke()

      // ── Band frequency dot markers ────────────────────────────────────
      if (currentEnabled) {
        for (const band of currentBands) {
          if (!band.enabled) continue
          const bx = freqToX(band.freq, W)
          const by = dbToY(totalGainAt(currentBands, band.freq), H)
          ctx.beginPath()
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = currentColor
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'
          ctx.lineWidth   = 0.75
          ctx.stroke()
        }
      }
    }

    function loop() {
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // stable — reads everything via refs

  // ── Resize observer ──────────────────────────────────────────────────────
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
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.scale(dpr, dpr)
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  )
}
