import { useRef, useEffect, useCallback } from 'react'
import { usePianoRollStore }               from './usePianoRollStore'
import type { PRNote }                     from './types'

const PAD_TOP    = 6
const BAR_MIN_H  = 3
const BAR_HALF_W = 3

type VelDrag = { noteId: string; y0: number; origVel: number } | null

function hitVelBar(
  px: number, notes: PRNote[], zoomX: number, scrollX: number,
): PRNote | null {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]
    const x = n.startBeat * zoomX - scrollX
    if (Math.abs(px - x) <= BAR_HALF_W + 1) return n
  }
  return null
}

export default function VelocityLane() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const sizeRef    = useRef({ w: 1, h: 1 })
  const rafRef     = useRef(0)
  const storeRef   = useRef(usePianoRollStore.getState())
  const dragRef    = useRef<VelDrag>(null)

  useEffect(() => {
    return usePianoRollStore.subscribe(s => { storeRef.current = s })
  }, [])

  const store = useCallback(() => usePianoRollStore.getState(), [])

  // ── Draw ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { w: W, h: H } = sizeRef.current
      const { notes, zoomX, scrollX } = storeRef.current
      const usableH = H - PAD_TOP

      ctx.clearRect(0, 0, W, H)

      // Header label area
      ctx.fillStyle = '#0b0b16'
      ctx.fillRect(0, 0, W, H)

      // Faint horizontal reference line at 100% and 50%
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.fillRect(0, PAD_TOP, W, 1)
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      ctx.fillRect(0, PAD_TOP + usableH * 0.5, W, 1)

      for (const note of notes) {
        const x    = note.startBeat * zoomX - scrollX
        if (x + BAR_HALF_W < 0 || x - BAR_HALF_W > W) continue

        const barH    = Math.max(BAR_MIN_H, (note.velocity / 127) * usableH)
        const y       = H - barH
        const alpha   = note.selected ? 0.95 : 0.65
        const fill    = note.selected
          ? `rgba(167,139,250,${alpha})`
          : `rgba(124,58,237,${alpha})`
        const topLine = note.selected ? '#c4b5fd' : 'rgba(168,85,247,0.9)'

        // Bar body
        ctx.fillStyle = fill
        ctx.fillRect(x - BAR_HALF_W, y, BAR_HALF_W * 2, barH)

        // Top cap
        ctx.fillStyle = topLine
        ctx.fillRect(x - BAR_HALF_W, y, BAR_HALF_W * 2, 2)
      }

      // Drag active: show value tooltip hint
      const d = dragRef.current
      if (d) {
        const note = notes.find(n => n.id === d.noteId)
        if (note) {
          const x    = note.startBeat * zoomX - scrollX
          const barH = Math.max(BAR_MIN_H, (note.velocity / 127) * usableH)
          const y    = H - barH - 14
          ctx.fillStyle = 'rgba(12,12,20,0.9)'
          ctx.strokeStyle = 'rgba(124,58,237,0.5)'
          ctx.lineWidth = 1
          const lbl = `${note.velocity}`
          ctx.font = '9px Inter, system-ui, sans-serif'
          const tw = ctx.measureText(lbl).width + 8
          const tx = Math.max(2, Math.min(W - tw - 2, x - tw / 2))
          ctx.beginPath()
          ctx.roundRect(tx, y, tw, 12, 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#a855f7'
          ctx.fillText(lbl, tx + 4, y + 9)
        }
      }
    }

    function loop() {
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Resize observer ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const ro  = new ResizeObserver(entries => {
      for (const e of entries) {
        const { inlineSize: w, blockSize: h } = e.contentBoxSize[0]
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

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const s   = store()
    const px  = e.nativeEvent.offsetX
    const hit = hitVelBar(px, s.notes, s.zoomX, s.scrollX)
    if (!hit) return
    dragRef.current = { noteId: hit.id, y0: e.clientY, origVel: hit.velocity }
    if (!hit.selected) {
      s.deselectAll()
      s.selectNote(hit.id, false)
    }
  }, [store])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) return
    const s       = store()
    const { h: H } = sizeRef.current
    const usableH = H - PAD_TOP
    const dy      = d.y0 - e.clientY   // drag up = increase
    const delta   = Math.round(dy / usableH * 127)
    const newVel  = Math.max(1, Math.min(127, d.origVel + delta))
    // Apply to all selected notes proportionally (scale to the dragged note)
    const scale   = (d.origVel > 0 && d.origVel !== 127)
      ? newVel / d.origVel
      : 1
    for (const n of s.notes) {
      if (!n.selected) continue
      const v = n.id === d.noteId
        ? newVel
        : Math.max(1, Math.min(127, Math.round(n.velocity * scale)))
      s.setVelocity(n.id, v)
    }
  }, [store])

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null
  }, [])

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const s = store()
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      s.setScroll(s.scrollX + e.deltaY * 0.6, s.scrollY)
    } else {
      s.setScroll(s.scrollX + e.deltaX * 0.6, s.scrollY)
    }
  }, [store])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      style={{ cursor: 'ns-resize', touchAction: 'none' }}
    />
  )
}
