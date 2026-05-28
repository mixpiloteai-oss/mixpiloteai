import { useRef, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useArrangementViewStore } from './useArrangementViewStore'

const MINIMAP_H = 36

export default function ArrangementMiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const projRef   = useRef(useProjectStore.getState())
  const viewRef   = useRef(useArrangementViewStore.getState())
  const dragging  = useRef(false)

  useEffect(() => {
    const u1 = useProjectStore.subscribe(s => { projRef.current = s })
    const u2 = useArrangementViewStore.subscribe(s => { viewRef.current = s })

    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!

    let rafId: number
    let lastW = 0

    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      const dpr = window.devicePixelRatio ?? 1
      canvas.width  = r.width  * dpr
      canvas.height = r.height * dpr
      lastW = r.width
    })
    ro.observe(canvas)

    function draw() {
      const dpr = window.devicePixelRatio ?? 1
      const W   = lastW
      const H   = MINIMAP_H
      if (W === 0) { rafId = requestAnimationFrame(draw); return }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const { project } = projRef.current
      const { zoomX, scrollX } = viewRef.current
      const tsTop = project.timeSignatureNumerator
      const totalBeats = project.totalBars * tsTop

      // Scale: fit entire project into minimap width
      const scaleX = W / (totalBeats * Math.max(1, zoomX * project.totalBars * tsTop / W))
      const pxPerBeat = W / totalBeats

      // Background
      ctx.fillStyle = '#05050b'
      ctx.fillRect(0, 0, W, H)

      // Track rows
      const totalTrackH = project.tracks.reduce((s, t) => s + t.height + 1, 0)
      const scaleY = H / Math.max(1, totalTrackH)

      let ty = 0
      for (const track of project.tracks) {
        const rowY = ty * scaleY
        const rowH = Math.max(1, track.height * scaleY)

        // Track bg
        ctx.fillStyle = track.color + '10'
        ctx.fillRect(0, rowY, W, rowH)

        // Clips
        for (const clip of track.clips) {
          const startBeat = (clip.startBar - 1) * tsTop
          const cx = startBeat * pxPerBeat
          const cw = Math.max(1, clip.lengthBars * tsTop * pxPerBeat)
          ctx.fillStyle = clip.muted ? clip.color + '18' : clip.color + '60'
          ctx.fillRect(cx, rowY + 1, cw, rowH - 2)
        }

        ty += track.height + 1
      }

      // Viewport highlight
      const viewStartBeat = scrollX / zoomX
      const viewEndBeat   = viewStartBeat + (lastW / zoomX)
      const vx = viewStartBeat * pxPerBeat
      const vw = Math.max(2, (viewEndBeat - viewStartBeat) * pxPerBeat)

      ctx.fillStyle = 'rgba(124,58,237,0.12)'
      ctx.fillRect(vx, 0, vw, H)
      ctx.strokeStyle = 'rgba(168,85,247,0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(vx + 0.5, 0.5, vw - 1, H - 1)

      // Top edge bar
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.fillRect(0, 0, W, 1)

      void scaleX

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      u1(); u2()
    }
  }, [])

  function pxToBeat(px: number): number {
    const { project }  = projRef.current
    const tsTop        = project.timeSignatureNumerator
    const totalBeats   = project.totalBars * tsTop
    const W            = canvasRef.current?.getBoundingClientRect().width ?? 1
    return (px / W) * totalBeats
  }

  function seekTo(px: number) {
    const { zoomX, scrollY } = viewRef.current
    const beat = pxToBeat(px)
    const newScrollX = beat * zoomX - (canvasRef.current?.getBoundingClientRect().width ?? 0) * 0.2
    useArrangementViewStore.getState().setScroll(Math.max(0, newScrollX), scrollY)
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = canvasRef.current!.getBoundingClientRect()
    seekTo(e.clientX - rect.left)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging.current) return
    const rect = canvasRef.current!.getBoundingClientRect()
    seekTo(e.clientX - rect.left)
  }

  function onPointerUp() {
    dragging.current = false
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: MINIMAP_H, cursor: 'pointer' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
