import { useRef, useEffect } from 'react'
import { useProjectStore }         from '../../store/projectStore'
import { useTransportStore }       from '../../store/transportStore'
import { useArrangementViewStore } from './useArrangementViewStore'

interface Props {
  height: number
}

export default function TimeRuler({ height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cssW      = useRef(0)
  const cssH      = useRef(height)

  // Stable refs — RAF loop reads these
  const projRef  = useRef(useProjectStore.getState())
  const viewRef  = useRef(useArrangementViewStore.getState())
  const transRef = useRef(useTransportStore.getState())

  // Drag refs for loop region and marker dragging
  const dragRef = useRef<
    | { type: 'idle' }
    | { type: 'loop-start'; origBar: number; x0: number }
    | { type: 'loop-end';   origBar: number; x0: number }
    | { type: 'marker'; markerId: string; origBar: number; x0: number }
    | { type: 'seek'; }
  >({ type: 'idle' })

  useEffect(() => {
    const unsub1 = useProjectStore.subscribe(s => { projRef.current = s })
    const unsub2 = useArrangementViewStore.subscribe(s => { viewRef.current = s })
    const unsub3 = useTransportStore.subscribe(s => { transRef.current = s })

    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!

    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      const dpr = window.devicePixelRatio ?? 1
      cssW.current = r.width
      cssH.current = r.height
      canvas.width  = r.width  * dpr
      canvas.height = r.height * dpr
    })
    ro.observe(canvas)

    let rafId: number

    function draw() {
      const dpr = window.devicePixelRatio ?? 1
      const W   = cssW.current
      const H   = cssH.current
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(draw); return }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const { project }     = projRef.current
      const { zoomX, scrollX, markers } = viewRef.current
      const { positionBar } = transRef.current
      const tsTop           = project.timeSignatureNumerator

      // Background
      ctx.fillStyle = '#06060c'
      ctx.fillRect(0, 0, W, H)

      // Loop region
      const loopX1 = (project.loopStart - 1) * tsTop * zoomX - scrollX
      const loopX2 = (project.loopEnd   - 1) * tsTop * zoomX - scrollX
      if (loopX2 > 0 && loopX1 < W) {
        ctx.fillStyle = 'rgba(124,58,237,0.18)'
        ctx.fillRect(Math.max(0, loopX1), 0, Math.min(W, loopX2) - Math.max(0, loopX1), H)
        // Loop boundary lines
        ctx.strokeStyle = 'rgba(168,85,247,0.7)'
        ctx.lineWidth   = 1.5
        if (loopX1 >= 0 && loopX1 <= W) {
          ctx.beginPath(); ctx.moveTo(loopX1, 0); ctx.lineTo(loopX1, H); ctx.stroke()
        }
        if (loopX2 >= 0 && loopX2 <= W) {
          ctx.beginPath(); ctx.moveTo(loopX2, 0); ctx.lineTo(loopX2, H); ctx.stroke()
        }
        // Loop start handle (left bracket)
        if (loopX1 >= 0 && loopX1 <= W) {
          ctx.fillStyle = 'rgba(168,85,247,0.9)'
          ctx.fillRect(loopX1, 0, 6, H * 0.5)
        }
        // Loop end handle (right bracket)
        if (loopX2 >= 0 && loopX2 <= W) {
          ctx.fillStyle = 'rgba(168,85,247,0.9)'
          ctx.fillRect(loopX2 - 6, 0, 6, H * 0.5)
        }
      }

      // Compute visible bar range
      const beat0   = scrollX / zoomX
      const beat1   = (scrollX + W) / zoomX
      const bar0    = Math.floor(beat0 / tsTop)
      const bar1    = Math.ceil(beat1 / tsTop) + 1

      // Adaptive detail: show beats when bars are wide enough
      const barPx   = tsTop * zoomX
      const showBeats = barPx >= 60

      // Beat lines
      if (showBeats) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        for (let bar = bar0; bar <= bar1; bar++) {
          for (let beat = 1; beat < tsTop; beat++) {
            const bx = Math.round((bar * tsTop + beat) * zoomX - scrollX)
            if (bx < 0 || bx > W) continue
            ctx.fillRect(bx, H * 0.65, 1, H * 0.35)
          }
        }
      }

      // Bar lines + labels
      ctx.font      = '600 9px system-ui'
      ctx.textAlign = 'left'
      for (let bar = bar0; bar <= bar1; bar++) {
        const bx = Math.round(bar * tsTop * zoomX - scrollX)
        if (bx < -40 || bx > W + 10) continue

        const isSection = bar % 4 === 0
        ctx.strokeStyle = isSection ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)'
        ctx.lineWidth   = 1
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, H); ctx.stroke()

        // Bar label
        if (bx >= 0) {
          ctx.fillStyle = isSection ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.28)'
          ctx.fillText(String(bar + 1), bx + 3, H - 4)
        }
      }

      // Bottom border
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(0, H - 0.5); ctx.lineTo(W, H - 0.5); ctx.stroke()

      // Markers
      for (const marker of markers) {
        const mx = (marker.bar - 1) * tsTop * zoomX - scrollX
        if (mx < -10 || mx > W + 10) continue

        // Triangle
        ctx.fillStyle = marker.color
        ctx.beginPath()
        ctx.moveTo(mx, 2)
        ctx.lineTo(mx + 8, 2)
        ctx.lineTo(mx, 10)
        ctx.closePath()
        ctx.fill()

        // Line
        ctx.strokeStyle = marker.color + 'aa'
        ctx.lineWidth   = 1
        ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke()

        // Label
        ctx.fillStyle = marker.color
        ctx.font      = '700 9px system-ui'
        ctx.fillText(marker.label, mx + 10, 11)
      }

      // Playhead
      const phX = Math.round((positionBar - 1) * tsTop * zoomX - scrollX)
      if (phX >= 0 && phX <= W) {
        ctx.fillStyle = '#ff3060'
        ctx.fillRect(phX - 0.5, 0, 1.5, H)
        // Downward triangle at top
        ctx.beginPath()
        ctx.moveTo(phX - 5, 0)
        ctx.lineTo(phX + 5, 0)
        ctx.lineTo(phX, 10)
        ctx.closePath()
        ctx.fill()
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      unsub1(); unsub2(); unsub3()
    }
  }, [])

  // ── Pointer events (loop handles, markers, seek) ──────────────────────────

  function hitTestRuler(px: number): 'loop-start' | 'loop-end' | 'marker' | 'seek' {
    const { project }  = projRef.current
    const { zoomX, scrollX, markers } = viewRef.current
    const tsTop        = project.timeSignatureNumerator
    const HANDLE_PX    = 12

    const loopX1 = (project.loopStart - 1) * tsTop * zoomX - scrollX
    const loopX2 = (project.loopEnd   - 1) * tsTop * zoomX - scrollX

    if (Math.abs(px - loopX1) <= HANDLE_PX) return 'loop-start'
    if (Math.abs(px - loopX2) <= HANDLE_PX) return 'loop-end'

    for (const m of markers) {
      const mx = (m.bar - 1) * tsTop * zoomX - scrollX
      if (Math.abs(px - mx) <= 8) return 'marker'
    }
    return 'seek'
  }

  function pxToBar(px: number): number {
    const { zoomX, scrollX } = viewRef.current
    const { project }        = projRef.current
    const tsTop              = project.timeSignatureNumerator
    return (px + scrollX) / (zoomX * tsTop) + 1
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const px   = e.clientX - rect.left
    const hit  = hitTestRuler(px)

    e.currentTarget.setPointerCapture(e.pointerId)

    if (hit === 'loop-start') {
      dragRef.current = { type: 'loop-start', origBar: projRef.current.project.loopStart, x0: px }
    } else if (hit === 'loop-end') {
      dragRef.current = { type: 'loop-end', origBar: projRef.current.project.loopEnd, x0: px }
    } else if (hit === 'marker') {
      const { zoomX, scrollX, markers } = viewRef.current
      const tsTop = projRef.current.project.timeSignatureNumerator
      let closestId = ''
      let minDist   = Infinity
      for (const m of markers) {
        const mx   = (m.bar - 1) * tsTop * zoomX - scrollX
        const dist = Math.abs(px - mx)
        if (dist < minDist) { minDist = dist; closestId = m.id }
      }
      if (closestId) {
        const m = markers.find(mk => mk.id === closestId)!
        if (e.altKey) {
          useArrangementViewStore.getState().removeMarker(closestId)
          return
        }
        dragRef.current = { type: 'marker', markerId: closestId, origBar: m.bar, x0: px }
      }
    } else {
      // Click to add marker on double-click, seek on single
      if (e.detail === 2) {
        const bar = Math.round(Math.max(1, pxToBar(px)))
        useArrangementViewStore.getState().addMarker(bar)
      } else {
        dragRef.current = { type: 'seek' }
        const bar = Math.max(1, pxToBar(px))
        // Just update transport position display (no actual seek yet, transport controls that)
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (drag.type === 'idle') return
    const rect = canvasRef.current!.getBoundingClientRect()
    const px   = e.clientX - rect.left
    const { project }  = projRef.current
    const { zoomX, scrollX } = viewRef.current
    const tsTop        = project.timeSignatureNumerator

    if (drag.type === 'loop-start' || drag.type === 'loop-end') {
      const deltaBars = (px - drag.x0) / (zoomX * tsTop)
      const newBar    = Math.max(1, Math.round(drag.origBar + deltaBars))
      if (drag.type === 'loop-start') {
        useProjectStore.getState().setLoopRegion(Math.min(newBar, project.loopEnd - 1), project.loopEnd)
      } else {
        useProjectStore.getState().setLoopRegion(project.loopStart, Math.max(newBar, project.loopStart + 1))
      }
    } else if (drag.type === 'marker') {
      const deltaBars = (px - drag.x0) / (zoomX * tsTop)
      const newBar    = Math.max(1, Math.round(drag.origBar + deltaBars))
      useArrangementViewStore.getState().moveMarker(drag.markerId, newBar)
    }
  }

  function onPointerUp() {
    dragRef.current = { type: 'idle' }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height, cursor: 'pointer' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
