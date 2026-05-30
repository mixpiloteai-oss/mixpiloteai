import { useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useTransportStore } from '../../store/transportStore'
import { useArrangementViewStore } from './useArrangementViewStore'
import { computeTrackLayout, snapBeat, clamp, SNAP_BEATS_MAP } from './arrangementUtils'
import AutomationLaneView from './AutomationLaneView'
import type { Clip, Track } from '../../types/project'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  headerWidth: number
  rulerHeight: number
}

// ─── LCG seeded noise for waveform ────────────────────────────────────────────

function lcgRand(seed: number): { value: number; next: number } {
  const next = ((seed * 1664525 + 1013904223) | 0) >>> 0
  return { value: next / 0xffffffff, next }
}

function clipSeed(clipId: string): number {
  let s = 0
  for (let i = 0; i < clipId.length; i++) s = ((s * 31 + clipId.charCodeAt(i)) | 0) >>> 0
  return s || 1
}

// ─── Viewport culling ──────────────────────────────────────────────────────────

function isClipVisible(cx: number, cw: number, W: number): boolean {
  return cx + cw > 0 && cx < W
}
function isTrackVisible(ty: number, th: number, H: number): boolean {
  return ty + th > 0 && ty < H
}

// ─── Drag state ────────────────────────────────────────────────────────────────

type DragState =
  | { type: 'idle' }
  | {
      type: 'move'
      clipIds: string[]
      origClips: Map<string, { startBar: number; trackId: string }>
      beat0: number
      trackIdx0: number
      dBeat: number
      dTrackIdx: number
    }
  | { type: 'resize-start'; clipId: string; trackId: string; origStart: number; origLen: number; x0: number }
  | { type: 'resize-end'; clipId: string; trackId: string; origLen: number; origStart: number; x0: number }
  | { type: 'stretch'; clipId: string; trackId: string; origLen: number; origStart: number; origRate: number; x0: number }
  | { type: 'select'; x0: number; y0: number; x1: number; y1: number }
  | { type: 'draw'; trackId: string; startBeat: number; endBeat: number }
  | { type: 'split-hover'; clipId: string; beat: number }
  | { type: 'marker-drag'; markerId: string; origBar: number; x0: number }
  | { type: 'pan'; lastX: number; lastY: number; vx: number; vy: number; lastT: number }

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ArrangementCanvas({ headerWidth: _headerWidth, rulerHeight: _rulerHeight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const sizeRef      = useRef({ w: 1, h: 1 })
  const rafRef       = useRef(0)
  const dragRef      = useRef<DragState>({ type: 'idle' })
  const canvasRectRef= useRef<DOMRect | null>(null)
  const _lastScrollX = useRef(-1)
  const _lastScrollY = useRef(-1)
  const _lastZoom    = useRef(-1)
  const _lastAutoSz  = useRef(-1)
  const inertiaRafRef= useRef(0)
  const inertiaVRef  = useRef({ vx: 0, vy: 0 })

  // Store refs — read in RAF / event handlers without re-renders
  const projectStoreRef  = useRef(useProjectStore.getState())
  const viewStoreRef     = useRef(useArrangementViewStore.getState())
  const transportStoreRef= useRef(useTransportStore.getState())

  useEffect(() => {
    const u1 = useProjectStore.subscribe(s => { projectStoreRef.current = s })
    const u2 = useArrangementViewStore.subscribe(s => { viewStoreRef.current = s })
    const u3 = useTransportStore.subscribe(s => { transportStoreRef.current = s })
    return () => { u1(); u2(); u3() }
  }, [])

  // ── Inertia helper ───────────────────────────────────────────────────────────
  const startInertia = useCallback((vx: number, vy: number) => {
    cancelAnimationFrame(inertiaRafRef.current)
    inertiaVRef.current = { vx, vy }
    function step() {
      const { vx: cvx, vy: cvy } = inertiaVRef.current
      if (Math.abs(cvx) < 0.1 && Math.abs(cvy) < 0.1) return
      const { scrollX, scrollY } = viewStoreRef.current
      viewStoreRef.current.setScroll(Math.max(0, scrollX + cvx), Math.max(0, scrollY + cvy))
      inertiaVRef.current = { vx: cvx * 0.93, vy: cvy * 0.93 }
      inertiaRafRef.current = requestAnimationFrame(step)
    }
    inertiaRafRef.current = requestAnimationFrame(step)
  }, [])

  // ── RAF draw loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const { w: W, h: H } = sizeRef.current

      const { project } = projectStoreRef.current
      const { zoomX, scrollX, scrollY, selectedClipIds, markers, snap, followPlayhead,
              expandedAutomationTracks } = viewStoreRef.current
      const { positionBar, playing } = transportStoreRef.current
      const drag = dragRef.current

      // Follow-playhead auto-scroll
      if (followPlayhead && playing) {
        const tsT = project.timeSignatureNumerator
        const phBeat = (positionBar - 1) * tsT
        const phPx   = phBeat * zoomX
        const targetSX = phPx - W * 0.3
        if (Math.abs(targetSX - scrollX) > 2) {
          viewStoreRef.current.setScroll(Math.max(0, targetSX), scrollY)
        }
      }

      // Dirty-rect skip
      const autoSz = expandedAutomationTracks.size
      if (
        drag.type === 'idle' &&
        _lastScrollX.current === scrollX &&
        _lastScrollY.current === scrollY &&
        _lastZoom.current === zoomX &&
        _lastAutoSz.current === autoSz
      ) return

      _lastScrollX.current = scrollX
      _lastScrollY.current = scrollY
      _lastZoom.current    = zoomX
      _lastAutoSz.current  = autoSz

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const tsTop      = project.timeSignatureNumerator
      const barToBeat  = (bar: number) => (bar - 1) * tsTop
      const beatToPx   = (beat: number) => beat * zoomX - scrollX
      const beatToBar  = (beat: number) => beat / tsTop + 1

      const trackLayout = computeTrackLayout(project.tracks, scrollY, expandedAutomationTracks)

      // 1. Track row backgrounds
      for (let i = 0; i < project.tracks.length; i++) {
        const track = project.tracks[i]
        const tl = trackLayout[i]
        if (tl.y + tl.h < 0 || tl.y > H) continue

        // Clip area bg
        ctx.fillStyle = i % 2 === 0 ? '#0d0d1a' : '#0a0a14'
        ctx.fillRect(0, tl.y, W, tl.clipH)
        if (projectStoreRef.current.selectedTrackId === track.id) {
          ctx.fillStyle = 'rgba(124,58,237,0.05)'
          ctx.fillRect(0, tl.y, W, tl.clipH)
        }
        ctx.fillStyle = track.color + '08'
        ctx.fillRect(0, tl.y, W, tl.clipH)

        // Move drag highlight
        if (drag.type === 'move') {
          const firstOrig = drag.origClips.values().next().value as { startBar: number; trackId: string } | undefined
          if (firstOrig) {
            const origIdx = project.tracks.findIndex(t => t.id === firstOrig.trackId)
            const newIdx = clamp(origIdx + drag.dTrackIdx, 0, project.tracks.length - 1)
            if (i === newIdx) {
              ctx.fillStyle = 'rgba(124,58,237,0.06)'
              ctx.fillRect(0, tl.y, W, tl.clipH)
            }
          }
        }

        // Automation lane area bg (if expanded)
        if (tl.autoH > 0) {
          ctx.fillStyle = '#070710'
          ctx.fillRect(0, tl.autoY, W, tl.autoH)
          ctx.fillStyle = 'rgba(255,255,255,0.02)'
          ctx.fillRect(0, tl.autoY, W, 1)
        }
      }

      // 2. Vertical grid lines
      const totalBeats = project.totalBars * tsTop
      const firstBeat  = Math.floor(scrollX / zoomX)
      const lastBeat   = Math.ceil((scrollX + W) / zoomX) + 1

      for (let beat = Math.max(0, firstBeat); beat <= Math.min(totalBeats, lastBeat); beat += 0.5) {
        const isBar      = beat % tsTop === 0
        const isHalf     = beat % 0.5 === 0 && beat % 1 !== 0
        const isBeat     = beat % 1 === 0 && !isBar
        const isEvery4   = isBar && ((beat / tsTop) % 4 === 0)

        if (isHalf && zoomX < 48) continue
        if (isBeat && zoomX < 12) continue
        if (!isBar && !isBeat && !isHalf) continue

        const x = Math.floor(beatToPx(beat))
        if (x < -1 || x > W + 1) continue

        ctx.fillStyle = isEvery4
          ? 'rgba(255,255,255,0.18)'
          : isBar   ? 'rgba(255,255,255,0.10)'
          : isBeat  ? 'rgba(255,255,255,0.04)'
          : 'rgba(255,255,255,0.02)'
        ctx.fillRect(x, 0, isBar ? 1.5 : 1, H)
      }

      // 3. Track separators
      for (const tl of trackLayout) {
        const sepY = tl.y + tl.h
        if (sepY < 0 || sepY > H) continue
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(0, sepY, W, 1)
      }

      // 4. Loop region
      const loopStartBeat = barToBeat(project.loopStart)
      const loopEndBeat   = barToBeat(project.loopEnd)
      const loopX0 = beatToPx(loopStartBeat)
      const loopX1 = beatToPx(loopEndBeat)
      if (loopX1 > 0 && loopX0 < W) {
        ctx.fillStyle = 'rgba(124,58,237,0.10)'
        ctx.fillRect(loopX0, 0, loopX1 - loopX0, H)
        ctx.fillStyle = 'rgba(124,58,237,0.30)'
        ctx.fillRect(loopX0, 0, 1, H)
        ctx.fillRect(loopX1 - 1, 0, 1, H)
      }

      // 5. Clips
      for (let ti = 0; ti < project.tracks.length; ti++) {
        const track  = project.tracks[ti]
        const tl     = trackLayout[ti]
        if (!tl || !isTrackVisible(tl.y, tl.clipH, H)) continue

        for (const clip of track.clips) {
          let displayStartBar = clip.startBar
          let displayTi = ti

          if (drag.type === 'move' && drag.clipIds.includes(clip.id)) {
            const orig = drag.origClips.get(clip.id)
            if (orig) {
              const origBeat = barToBeat(orig.startBar)
              const newBeat  = snapBeat(origBeat + drag.dBeat * tsTop, snap)
              displayStartBar = Math.max(1, beatToBar(newBeat))
              const origIdx = project.tracks.findIndex(t => t.id === orig.trackId)
              displayTi = clamp(origIdx + drag.dTrackIdx, 0, project.tracks.length - 1)
            }
          }

          const displayTl = drag.type === 'move' && drag.clipIds.includes(clip.id)
            ? trackLayout[displayTi]
            : tl
          if (!displayTl) continue

          const clipX = beatToPx(barToBeat(displayStartBar))
          const clipW = clip.lengthBars * tsTop * zoomX
          const clipY = displayTl.y + 2
          const clipH = displayTl.clipH - 4

          if (clipW < 0.5 || !isClipVisible(clipX, clipW, W)) continue

          const isSelected = selectedClipIds.has(clip.id)
          const isMuted    = clip.muted || track.muted

          // Ghost for move drag
          if (drag.type === 'move' && drag.clipIds.includes(clip.id)) {
            const ghostX = beatToPx(barToBeat(clip.startBar))
            ctx.save()
            ctx.setLineDash([4, 4])
            ctx.strokeStyle = clip.color + '60'
            ctx.lineWidth = 1
            ctx.strokeRect(ghostX + 0.5, tl.y + 2.5, clipW - 1, tl.clipH - 5)
            ctx.setLineDash([])
            ctx.restore()
          }

          // Clip background
          const rr = ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }
          ctx.beginPath()
          rr.roundRect(clipX, clipY, clipW, clipH, 4)
          ctx.fillStyle = isMuted
            ? clip.color + '10'
            : drag.type === 'move' && drag.clipIds.includes(clip.id)
              ? clip.color + '1a'
              : clip.color + '28'
          ctx.fill()

          // Top color bar
          ctx.fillStyle = isMuted ? clip.color + '44' : clip.color + 'cc'
          ctx.fillRect(clipX, clipY, clipW, 3)

          // Content
          if (clipW > 20) {
            if (track.type === 'audio') {
              const barCount = Math.floor(clipW / 3)
              let seed = clipSeed(clip.id)
              ctx.fillStyle = isMuted ? clip.color + '20' : clip.color + '55'
              const centerY = clipY + clipH / 2
              const maxAmp  = (clipH - 8) / 2
              for (let b = 0; b < barCount; b++) {
                const res = lcgRand(seed); seed = res.next
                const amp = res.value * maxAmp
                ctx.fillRect(clipX + 3 + b * 3, centerY - amp, 2, amp * 2)
              }
            } else if (track.type === 'midi' && clip.notes.length > 0) {
              const noteAreaY = clipY + 4
              const noteAreaH = clipH - 8
              ctx.fillStyle = isMuted ? clip.color + '40' : clip.color + 'aa'
              for (const note of clip.notes) {
                const nX = clipX + (note.startBeat / (clip.lengthBars * tsTop)) * clipW
                const nY = noteAreaY + ((127 - note.pitch) / 127) * noteAreaH
                const nW = Math.max(2, (note.lengthBeats / (clip.lengthBars * tsTop)) * clipW)
                ctx.fillRect(nX, nY, nW, 2)
              }
            }
          }

          // Stretch rate indicator
          if (clip.playbackRate !== undefined && Math.abs(clip.playbackRate - 1) > 0.01 && clipW > 32) {
            ctx.font = '500 8px monospace'
            ctx.fillStyle = clip.color + 'aa'
            ctx.fillText(`${clip.playbackRate.toFixed(2)}×`, clipX + 6, clipY + clipH - 4)
          }

          // Clip name
          if (clipW > 30) {
            ctx.font = '600 10px system-ui'
            ctx.fillStyle = isMuted ? clip.color + '80' : clip.color
            ctx.fillText(clip.name, clipX + 6, clipY + 14)
          }

          // Muted stripe
          if (isMuted) {
            ctx.save()
            ctx.globalAlpha = 0.15
            ctx.strokeStyle = clip.color
            ctx.lineWidth = 1
            ctx.beginPath()
            for (let off = -clipH; off < clipW + clipH; off += 8) {
              ctx.moveTo(clipX + off, clipY)
              ctx.lineTo(clipX + off + clipH, clipY + clipH)
            }
            ctx.save(); rr.roundRect(clipX, clipY, clipW, clipH, 4); ctx.clip()
            ctx.stroke()
            ctx.restore()
            ctx.restore()
          }

          // Selected border + glow + resize handles
          if (isSelected) {
            ctx.save()
            ctx.shadowColor = clip.color
            ctx.shadowBlur  = 6
            ctx.strokeStyle = clip.color
            ctx.lineWidth   = 1.5
            ctx.beginPath()
            rr.roundRect(clipX + 0.75, clipY + 0.75, clipW - 1.5, clipH - 1.5, 4)
            ctx.stroke()
            ctx.restore()
            if (clipW > 16) {
              ctx.fillStyle = clip.color + 'cc'
              ctx.fillRect(clipX, clipY, 4, clipH)
              ctx.fillRect(clipX + clipW - 4, clipY, 4, clipH)
            }
          }

          // Split hover line
          if (drag.type === 'split-hover' && drag.clipId === clip.id) {
            const splitX = beatToPx(drag.beat)
            ctx.save()
            ctx.strokeStyle = '#ff3060'
            ctx.lineWidth   = 1.5
            ctx.setLineDash([4, 3])
            ctx.beginPath()
            ctx.moveTo(splitX, clipY)
            ctx.lineTo(splitX, clipY + clipH)
            ctx.stroke()
            ctx.restore()
          }
        }
      }

      // 6. Selection rect
      if (drag.type === 'select') {
        const sx = Math.min(drag.x0, drag.x1)
        const sy = Math.min(drag.y0, drag.y1)
        const sw = Math.abs(drag.x1 - drag.x0)
        const sh = Math.abs(drag.y1 - drag.y0)
        ctx.fillStyle = 'rgba(124,58,237,0.08)'
        ctx.fillRect(sx, sy, sw, sh)
        ctx.strokeStyle = 'rgba(168,85,247,0.5)'
        ctx.lineWidth = 1
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1)
      }

      // 7. Draw preview
      if (drag.type === 'draw') {
        const drawTi = project.tracks.findIndex(t => t.id === drag.trackId)
        const drawTl = trackLayout[drawTi]
        if (drawTl) {
          const startBeat = Math.min(drag.startBeat, drag.endBeat)
          const endBeat   = Math.max(drag.startBeat, drag.endBeat)
          const drawX = beatToPx(startBeat)
          const drawW = (endBeat - startBeat) * zoomX
          const rr2 = ctx as typeof ctx & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }
          ctx.save()
          ctx.setLineDash([5, 4])
          ctx.strokeStyle = 'rgba(168,85,247,0.8)'
          ctx.lineWidth = 1.5
          ctx.fillStyle = 'rgba(124,58,237,0.15)'
          ctx.beginPath()
          rr2.roundRect(drawX, drawTl.y + 2, Math.max(8, drawW), drawTl.clipH - 4, 4)
          ctx.fill()
          ctx.stroke()
          ctx.restore()
        }
      }

      // 8. Playhead
      const playBeat = barToBeat(positionBar)
      const phX = Math.floor(beatToPx(playBeat))
      if (phX >= -2 && phX <= W + 2) {
        ctx.fillStyle = '#ff3060'
        ctx.fillRect(phX, 0, 1.5, H)
        ctx.beginPath()
        ctx.moveTo(phX - 5, 0)
        ctx.lineTo(phX + 6, 0)
        ctx.lineTo(phX + 0.75, 8)
        ctx.closePath()
        ctx.fill()
      }

      // 9. Markers
      for (const marker of markers) {
        const mx = Math.floor(beatToPx(barToBeat(marker.bar)))
        if (mx < -10 || mx > W + 10) continue
        ctx.fillStyle = marker.color
        ctx.beginPath()
        ctx.moveTo(mx, 0); ctx.lineTo(mx + 8, 0); ctx.lineTo(mx, 8)
        ctx.closePath(); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(mx, 8, 1, H - 8)
      }

      // 10. Ripple indicator
      if (viewStoreRef.current.rippleEdit) {
        ctx.fillStyle = 'rgba(6,182,212,0.04)'
        ctx.fillRect(0, 0, W, H)
        ctx.font = '600 10px system-ui'
        ctx.fillStyle = 'rgba(6,182,212,0.4)'
        ctx.fillText('RIPPLE', 6, H - 6)
      }
    }

    function loop() { draw(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      cancelAnimationFrame(inertiaRafRef.current)
    }
  }, []) // stable — reads from refs

  // ── ResizeObserver ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { inlineSize: w, blockSize: h } = entry.contentBoxSize[0]
        sizeRef.current = { w, h }
        canvas.width  = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvasRectRef.current = canvas.getBoundingClientRect()
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── Hit test ─────────────────────────────────────────────────────────────────
  const hitTestClip = useCallback((px: number, py: number): {
    clip: Clip; track: Track; trackIdx: number
    zone: 'resize-start' | 'resize-end' | 'body'
  } | null => {
    const { project } = projectStoreRef.current
    const { zoomX, scrollX, scrollY, expandedAutomationTracks } = viewStoreRef.current
    const tsTop = project.timeSignatureNumerator
    const beatToPx = (beat: number) => beat * zoomX - scrollX
    const layout = computeTrackLayout(project.tracks, scrollY, expandedAutomationTracks)

    for (let ti = project.tracks.length - 1; ti >= 0; ti--) {
      const track = project.tracks[ti]
      const tl = layout[ti]
      if (!tl) continue
      if (py < tl.y || py > tl.y + tl.clipH) continue
      for (let ci = track.clips.length - 1; ci >= 0; ci--) {
        const clip = track.clips[ci]
        const cx = beatToPx((clip.startBar - 1) * tsTop)
        const cw = clip.lengthBars * tsTop * zoomX
        if (px < cx - 1 || px > cx + cw + 1) continue
        const R = 8
        let zone: 'resize-start' | 'resize-end' | 'body' = 'body'
        if (cw > 16) {
          if (px < cx + R) zone = 'resize-start'
          else if (px > cx + cw - R) zone = 'resize-end'
        }
        return { clip, track, trackIdx: ti, zone }
      }
    }
    return null
  }, [])

  const pxToTrackIdx = useCallback((py: number): number => {
    const { project } = projectStoreRef.current
    const { scrollY, expandedAutomationTracks } = viewStoreRef.current
    const layout = computeTrackLayout(project.tracks, scrollY, expandedAutomationTracks)
    for (let i = 0; i < layout.length; i++) {
      const l = layout[i]
      if (py >= l.y && py <= l.y + l.clipH) return i
    }
    return -1
  }, [])

  // ── Pointer down ─────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    cancelAnimationFrame(inertiaRafRef.current)
    e.currentTarget.setPointerCapture(e.pointerId)
    canvasRectRef.current = e.currentTarget.getBoundingClientRect()

    const { project } = projectStoreRef.current
    const { tool, zoomX, scrollX, snap } = viewStoreRef.current
    const { selectClips, deselectAll, toggleSelectClip } = useArrangementViewStore.getState()

    const px = e.nativeEvent.offsetX
    const py = e.nativeEvent.offsetY
    const tsTop = project.timeSignatureNumerator
    const pxToBeat = (x: number) => (x + scrollX) / zoomX
    const beatToBar = (beat: number) => beat / tsTop + 1

    // Middle button → pan with inertia
    if (e.button === 1) {
      dragRef.current = { type: 'pan', lastX: px, lastY: py, vx: 0, vy: 0, lastT: performance.now() }
      return
    }

    const hit = hitTestClip(px, py)
    const trackIdx = pxToTrackIdx(py)
    const trackUnder = trackIdx >= 0 ? project.tracks[trackIdx] : null

    if (tool === 'pointer') {
      if (hit) {
        const { clip, track } = hit
        const { selectedClipIds } = viewStoreRef.current

        if (e.shiftKey) {
          toggleSelectClip(clip.id)
        } else if (!selectedClipIds.has(clip.id)) {
          selectClips([clip.id])
        }

        if (hit.zone === 'resize-start') {
          dragRef.current = { type: 'resize-start', clipId: clip.id, trackId: track.id,
            origStart: clip.startBar, origLen: clip.lengthBars, x0: px }
        } else if (hit.zone === 'resize-end') {
          if (e.altKey) {
            // Stretch mode
            dragRef.current = { type: 'stretch', clipId: clip.id, trackId: track.id,
              origLen: clip.lengthBars, origStart: clip.startBar, origRate: clip.playbackRate ?? 1, x0: px }
          } else {
            dragRef.current = { type: 'resize-end', clipId: clip.id, trackId: track.id,
              origLen: clip.lengthBars, origStart: clip.startBar, x0: px }
          }
        } else {
          const { selectedClipIds: selIds } = viewStoreRef.current
          const clipIds = selIds.has(clip.id) ? [...selIds] : [clip.id]
          const origClips = new Map<string, { startBar: number; trackId: string }>()
          project.tracks.forEach(t => {
            t.clips.forEach(c => {
              if (clipIds.includes(c.id)) origClips.set(c.id, { startBar: c.startBar, trackId: t.id })
            })
          })
          dragRef.current = { type: 'move', clipIds, origClips, beat0: pxToBeat(px), trackIdx0: trackIdx, dBeat: 0, dTrackIdx: 0 }
        }
        useProjectStore.getState().selectTrack(track.id)
      } else {
        if (!e.shiftKey) deselectAll()
        dragRef.current = { type: 'select', x0: px, y0: py, x1: px, y1: py }
      }

    } else if (tool === 'pencil') {
      if (trackUnder) {
        const rawBeat = pxToBeat(px)
        const snappedBeat = snapBeat(rawBeat, snap)
        dragRef.current = { type: 'draw', trackId: trackUnder.id, startBeat: snappedBeat, endBeat: snappedBeat + tsTop }
      }

    } else if (tool === 'split') {
      if (hit) {
        const rawBeat = pxToBeat(px)
        const snappedBar = Math.round(beatToBar(snapBeat(rawBeat, snap)))
        useProjectStore.getState().splitClip(hit.clip.id, snappedBar)
        dragRef.current = { type: 'idle' }
      }

    } else if (tool === 'erase') {
      if (hit) {
        useProjectStore.getState().deleteClips([hit.clip.id])
        deselectAll()
      }
      dragRef.current = { type: 'idle' }
    }
  }, [hitTestClip, pxToTrackIdx])

  // ── Pointer move ─────────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const { project } = projectStoreRef.current
    const { zoomX, scrollX, snap, tool } = viewStoreRef.current
    const tsTop = project.timeSignatureNumerator
    const pxToBeat = (x: number) => (x + scrollX) / zoomX
    const beatToBar = (beat: number) => beat / tsTop + 1

    const px = e.nativeEvent.offsetX
    const py = e.nativeEvent.offsetY
    const d = dragRef.current
    const canvas = canvasRef.current

    if (d.type === 'pan') {
      const now = performance.now()
      const dt = now - d.lastT
      if (dt > 0) {
        d.vx = -(px - d.lastX) / dt * 16
        d.vy = -(py - d.lastY) / dt * 16
      }
      const dx = px - d.lastX
      const dy = py - d.lastY
      const { scrollX: sx, scrollY: sy } = viewStoreRef.current
      viewStoreRef.current.setScroll(Math.max(0, sx - dx), Math.max(0, sy - dy))
      d.lastX = px; d.lastY = py; d.lastT = now
      if (canvas) canvas.style.cursor = 'grabbing'
      return
    }

    if (d.type === 'move') {
      const rawBeat = pxToBeat(px)
      const rawDeltaBars = (rawBeat - d.beat0) / tsTop
      const snapG = SNAP_BEATS_MAP[snap] ?? 0
      const snappedDeltaBars = snapG > 0
        ? Math.round(rawDeltaBars / (snapG / tsTop)) * (snapG / tsTop)
        : rawDeltaBars
      const curIdx = pxToTrackIdx(py)
      d.dBeat = snappedDeltaBars
      d.dTrackIdx = curIdx >= 0 ? curIdx - d.trackIdx0 : d.dTrackIdx

    } else if (d.type === 'resize-end') {
      const rawLen = (pxToBeat(px) - (d.origStart - 1) * tsTop) / tsTop
      const snapG = SNAP_BEATS_MAP[snap] ?? 0
      const snappedLen = snapG > 0
        ? Math.max(snapG / tsTop, Math.round(rawLen / (snapG / tsTop)) * (snapG / tsTop))
        : Math.max(0.25 / tsTop, rawLen)
      useProjectStore.getState().resizeClip(d.clipId, d.origStart, snappedLen)

    } else if (d.type === 'resize-start') {
      const newStartBeat = snapBeat(pxToBeat(px), snap)
      const newStartBar  = Math.max(1, beatToBar(newStartBeat))
      const origEndBar   = d.origStart + d.origLen
      const newLen       = Math.max(0.25 / tsTop, origEndBar - newStartBar)
      useProjectStore.getState().resizeClip(d.clipId, newStartBar, newLen)

    } else if (d.type === 'stretch') {
      const rawLen = (pxToBeat(px) - (d.origStart - 1) * tsTop) / tsTop
      const newLen = Math.max(0.25 / tsTop, rawLen)
      const newRate = (d.origLen * d.origRate) / newLen
      useProjectStore.getState().resizeClip(d.clipId, d.origStart, newLen)
      useProjectStore.getState().stretchClip(d.clipId, Math.max(0.1, Math.min(4, newRate)))

    } else if (d.type === 'select') {
      d.x1 = px; d.y1 = py

    } else if (d.type === 'draw') {
      const snapped = snapBeat(pxToBeat(px), snap)
      d.endBeat = Math.max(d.startBeat + tsTop * 0.25, snapped)

    } else if (tool === 'split' && d.type === 'idle') {
      const hit = hitTestClip(px, py)
      if (hit) dragRef.current = { type: 'split-hover', clipId: hit.clip.id, beat: pxToBeat(px) }
      else dragRef.current = { type: 'idle' }
    }

    if (d.type === 'split-hover' && tool !== 'split') dragRef.current = { type: 'idle' }

    if (!canvas) return
    if (d.type === 'move') { canvas.style.cursor = 'grabbing'; return }
    if (d.type === 'resize-start' || d.type === 'resize-end') { canvas.style.cursor = 'ew-resize'; return }
    if (d.type === 'stretch') { canvas.style.cursor = 'col-resize'; return }
    if (tool === 'pencil' || tool === 'split' || tool === 'erase') { canvas.style.cursor = 'crosshair'; return }

    const hit = hitTestClip(px, py)
    if (hit?.zone === 'resize-start' || hit?.zone === 'resize-end') canvas.style.cursor = 'ew-resize'
    else if (hit?.zone === 'body') canvas.style.cursor = 'grab'
    else canvas.style.cursor = 'default'
  }, [hitTestClip, pxToTrackIdx, startInertia])

  // ── Pointer up ────────────────────────────────────────────────────────────────
  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    const origProject = projectStoreRef.current.project
    const { snap, rippleEdit } = viewStoreRef.current
    const { selectClips } = useArrangementViewStore.getState()
    const tsTop = origProject.timeSignatureNumerator
    const beatToBar = (beat: number) => beat / tsTop + 1

    if (d.type === 'pan') {
      startInertia(d.vx, d.vy)

    } else if (d.type === 'move') {
      const ps = useProjectStore.getState()

      // Commit all moves and collect the bar deltas for ripple
      type MoveRecord = { clipId: string; origTrackId: string; origStartBar: number; barDelta: number }
      const moved: MoveRecord[] = []

      for (const clipId of d.clipIds) {
        const orig = d.origClips.get(clipId)
        if (!orig) continue
        const origBeat    = (orig.startBar - 1) * tsTop
        const snapped     = snapBeat(origBeat + d.dBeat * tsTop, snap)
        const newStartBar = Math.max(1, beatToBar(snapped))
        const origIdx     = origProject.tracks.findIndex(t => t.id === orig.trackId)
        const newIdx      = clamp(origIdx + d.dTrackIdx, 0, origProject.tracks.length - 1)
        const newTrackId  = origProject.tracks[newIdx]?.id ?? orig.trackId
        ps.moveClip(clipId, newStartBar, newTrackId)
        moved.push({ clipId, origTrackId: orig.trackId, origStartBar: orig.startBar, barDelta: newStartBar - orig.startBar })
      }

      // Ripple: shift clips on same track that start after the pivot
      if (rippleEdit && moved.length > 0) {
        // Group by original track, take the earliest pivot and the shared bar delta
        const byTrack = new Map<string, { pivot: number; delta: number }>()
        for (const m of moved) {
          const prev = byTrack.get(m.origTrackId)
          if (!prev || m.origStartBar < prev.pivot) {
            byTrack.set(m.origTrackId, { pivot: m.origStartBar, delta: m.barDelta })
          }
        }
        for (const [trackId, { pivot, delta }] of byTrack) {
          if (delta === 0) continue
          useProjectStore.getState().rippleShiftClips(trackId, pivot, delta, d.clipIds)
        }
      }

    } else if (d.type === 'select') {
      if (Math.abs(d.x1 - d.x0) > 4 || Math.abs(d.y1 - d.y0) > 4) {
        const { scrollX: sx, scrollY: sy, zoomX: zx, expandedAutomationTracks } = viewStoreRef.current
        const layout = computeTrackLayout(origProject.tracks, sy, expandedAutomationTracks)
        const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1)
        const y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1)
        const barLeft  = (x0 + sx) / zx / tsTop + 1
        const barRight = (x1 + sx) / zx / tsTop + 1
        const selected: string[] = []
        for (let ti = 0; ti < origProject.tracks.length; ti++) {
          const tl = layout[ti]
          if (!tl || tl.y + tl.clipH < y0 || tl.y > y1) continue
          for (const clip of origProject.tracks[ti].clips) {
            if (clip.startBar < barRight && clip.startBar + clip.lengthBars > barLeft) selected.push(clip.id)
          }
        }
        selectClips(selected)
      }

    } else if (d.type === 'draw') {
      const startBar = Math.max(1, beatToBar(snapBeat(d.startBeat, snap)))
      const endBar   = beatToBar(snapBeat(d.endBeat, snap))
      const len      = Math.max(0.25 / tsTop, endBar - startBar)
      const track    = origProject.tracks.find(t => t.id === d.trackId)
      if (track) {
        const newClip: import('../../types/project').Clip = {
          id: `clip-${Date.now()}`,
          trackId: d.trackId,
          name: 'New Clip',
          startBar,
          lengthBars: len,
          color: track.color,
          muted: false,
          notes: [],
        }
        useProjectStore.getState().addClip(newClip)
        selectClips([newClip.id])
      }
    }

    dragRef.current = { type: 'idle' }
  }, [startInertia])

  // ── Wheel ─────────────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    cancelAnimationFrame(inertiaRafRef.current)
    const { zoomX, scrollX, scrollY, setZoom, setScroll } = viewStoreRef.current

    if (e.ctrlKey || e.metaKey) {
      const beatAtPtr = (e.nativeEvent.offsetX + scrollX) / zoomX
      const newZoomX  = clamp(zoomX * (e.deltaY < 0 ? 1.12 : 0.88), 2, 512)
      setZoom(newZoomX)
      setScroll(beatAtPtr * newZoomX - e.nativeEvent.offsetX, scrollY)
    } else if (e.shiftKey) {
      setScroll(scrollX + e.deltaY * 0.8, scrollY)
    } else {
      setScroll(scrollX + e.deltaX * 0.8, scrollY + e.deltaY * 0.8)
    }
  }, [])

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const { selectedClipIds } = viewStoreRef.current
    const { project } = projectStoreRef.current
    const { positionBar, playing } = transportStoreRef.current

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedClipIds.size > 0) {
        useProjectStore.getState().deleteClips([...selectedClipIds])
        useArrangementViewStore.getState().deselectAll()
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault()
      const all: string[] = []
      project.tracks.forEach(t => t.clips.forEach(c => all.push(c.id)))
      useArrangementViewStore.getState().selectClips(all)
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault()
      if (selectedClipIds.size > 0) useProjectStore.getState().duplicateClips([...selectedClipIds])
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
      e.preventDefault()
      if (selectedClipIds.size >= 2) {
        useProjectStore.getState().consolidateClips([...selectedClipIds])
        useArrangementViewStore.getState().deselectAll()
      }
    } else if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
      if (selectedClipIds.size > 0) {
        for (const id of selectedClipIds) useProjectStore.getState().splitClip(id, Math.round(positionBar))
        useArrangementViewStore.getState().deselectAll()
      }
    } else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      useArrangementViewStore.getState().toggleRippleEdit()
    } else if (e.key === ' ') {
      e.preventDefault()
      if (playing) useTransportStore.getState().stop()
      else useTransportStore.getState().play()
    }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        style={{
          outline:     'none',
          cursor:      'default',
          touchAction: 'none',
          background:  '#08080f',
          display:     'block',
          width:       '100%',
          height:      '100%',
        }}
      />
      <AutomationLaneView />
    </div>
  )
}
