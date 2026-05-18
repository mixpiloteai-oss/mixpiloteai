import { useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrackSpectrum {
  trackId: string
  type: 'midi' | 'audio' | 'bus' | 'master'
  color: string
  getLevel: () => { rmsL: number; rmsR: number; peakL: number; peakR: number }
}

interface Props {
  tracks: TrackSpectrum[]
  height: number  // CSS height (60–80px typically)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NUM_BINS  = 64
const FREQ_MIN  = 20
const FREQ_MAX  = 20000
const LOG_RANGE = Math.log10(FREQ_MAX / FREQ_MIN)

// Pre-compute log-spaced frequency bin centres (Hz)
const BIN_FREQS: number[] = Array.from({ length: NUM_BINS }, (_, i) =>
  FREQ_MIN * Math.pow(10, (i / (NUM_BINS - 1)) * LOG_RANGE)
)

// Grid frequencies and their labels
const GRID_FREQS: Array<{ hz: number; label: string }> = [
  { hz: 100,   label: '100' },
  { hz: 1000,  label: '1k'  },
  { hz: 10000, label: '10k' },
]

// ─── Frequency response profiles ─────────────────────────────────────────────

/** Return amplitude weight [0..1] for a given frequency, based on track type. */
function trackFreqWeight(type: TrackSpectrum['type'], freq: number): number {
  switch (type) {
    case 'midi': {
      // Drum/rhythm bias: peaks at low-mids, rolls off above 5kHz
      const lowBump  = Math.exp(-0.5 * Math.pow((Math.log10(freq) - Math.log10(120))  / 0.25, 2))
      const midBump  = Math.exp(-0.5 * Math.pow((Math.log10(freq) - Math.log10(400))  / 0.35, 2))
      const highRoll = freq > 5000 ? Math.exp(-((freq - 5000) / 8000)) : 1.0
      return Math.min(1, (lowBump * 0.8 + midBump * 0.6 + 0.1)) * highRoll
    }
    case 'audio': {
      // Broadband: relatively flat from 20Hz–20kHz, slight high-freq tilt
      const tilt = Math.exp(-((Math.log10(freq) - Math.log10(FREQ_MIN)) / LOG_RANGE) * 0.4)
      return 0.3 + tilt * 0.7
    }
    case 'bus': {
      // Weighted mid-range presence
      const mid = Math.exp(-0.5 * Math.pow((Math.log10(freq) - Math.log10(1000)) / 0.7, 2))
      return 0.15 + mid * 0.85
    }
    case 'master': {
      // Full spectrum with gentle smile curve
      const lo = Math.exp(-0.5 * Math.pow((Math.log10(freq) - Math.log10(80))    / 0.5, 2))
      const hi = Math.exp(-0.5 * Math.pow((Math.log10(freq) - Math.log10(12000)) / 0.5, 2))
      return 0.2 + (lo * 0.4 + hi * 0.4)
    }
    default:
      return 0.5
  }
}

/** Convert Hz to normalised x position [0..1] on a log scale. */
function freqToX(hz: number): number {
  return Math.log10(hz / FREQ_MIN) / LOG_RANGE
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpectrumCanvas({ tracks, height }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const sizeRef     = useRef({ w: 1, h: height })
  const rafRef      = useRef(0)
  const tracksRef   = useRef(tracks)
  tracksRef.current = tracks  // keep current without breaking RAF stability

  // Smoothed master spectrum — updated every frame
  const smoothedRef = useRef(new Float32Array(NUM_BINS))

  // ── Stable RAF loop ─────────────────────────────────────────────────────
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

      // ── Background ───────────────────────────────────────────────────
      ctx.fillStyle = '#05050a'
      ctx.fillRect(0, 0, W, H)

      // ── Compute current spectrum ──────────────────────────────────────
      // Accumulate each track's contribution into a raw bins array
      const raw = new Float32Array(NUM_BINS)
      const currentTracks = tracksRef.current

      for (const track of currentTracks) {
        const { rmsL, rmsR } = track.getLevel()
        const rms = (rmsL + rmsR) * 0.5
        if (rms < 0.0001) continue

        for (let i = 0; i < NUM_BINS; i++) {
          const w = trackFreqWeight(track.type, BIN_FREQS[i])
          // Add Gaussian noise-like variation seeded by bin index for a natural look
          const variation = 0.85 + 0.15 * Math.abs(Math.sin(i * 2.3 + rms * 10))
          raw[i] += rms * w * variation
        }
      }

      // Smooth: smoothed = smoothed * 0.85 + current * 0.15
      const sm = smoothedRef.current
      for (let i = 0; i < NUM_BINS; i++) {
        sm[i] = sm[i] * 0.85 + raw[i] * 0.15
      }

      // ── dBFS grid lines ───────────────────────────────────────────────
      // Map amplitude 0..1 → y. 0 dBFS at top, -60 at bottom.
      function ampToY(amp: number): number {
        const db = amp < 0.0001 ? -60 : Math.max(-60, 20 * Math.log10(amp))
        return H * (1 - (db + 60) / 60)
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth   = 1
      for (const db of [-20, -40, -60]) {
        const y = H * (1 - (db + 60) / 60)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      // ── Vertical freq grid ────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.fillStyle   = '#2a2a3d'
      ctx.font        = '8px Inter, system-ui, sans-serif'
      ctx.textAlign   = 'center'
      ctx.textBaseline = 'bottom'
      for (const { hz, label } of GRID_FREQS) {
        const x = freqToX(hz) * W
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
        ctx.fillText(label, x, H - 1)
      }

      // ── Draw individual track spectra as thin overlay lines ───────────
      ctx.lineWidth = 0.8
      ctx.globalAlpha = 0.35
      for (const track of currentTracks) {
        const { rmsL, rmsR } = track.getLevel()
        const rms = (rmsL + rmsR) * 0.5
        if (rms < 0.0005) continue

        ctx.strokeStyle = track.color
        ctx.beginPath()
        for (let i = 0; i < NUM_BINS; i++) {
          const x   = (i / (NUM_BINS - 1)) * W
          const amp = rms * trackFreqWeight(track.type, BIN_FREQS[i])
          const y   = ampToY(amp)
          if (i === 0) ctx.moveTo(x, y)
          else         ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0

      // ── Draw master spectrum as filled area ───────────────────────────
      const masterColor = '#7c3aed'

      // Build smooth path using quadratic bezier
      ctx.beginPath()
      const pts: Array<{ x: number; y: number }> = []
      for (let i = 0; i < NUM_BINS; i++) {
        pts.push({
          x: (i / (NUM_BINS - 1)) * W,
          y: ampToY(sm[i]),
        })
      }

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

      // Filled gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0,   'rgba(124,58,237,0.7)')
      grad.addColorStop(0.5, 'rgba(124,58,237,0.3)')
      grad.addColorStop(1,   'rgba(124,58,237,0.0)')
      ctx.fillStyle = grad
      ctx.fill()

      // Glow stroke on top
      ctx.shadowColor = masterColor
      ctx.shadowBlur  = 8
      ctx.strokeStyle = 'rgba(167,139,250,0.9)'
      ctx.lineWidth   = 1.5

      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) * 0.5
        const my = (pts[i].y + pts[i + 1].y) * 0.5
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    function loop() {
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // stable — reads via refs

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
      style={{ width: '100%', height, display: 'block' }}
    />
  )
}
