import { useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useTransportStore } from '../../store/transportStore'
import { useArrangementViewStore } from './useArrangementViewStore'
import type { Clip, Track } from '../../types/project'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  headerWidth: number
  rulerHeight: number
}

// ─── Snap helper ───────────────────────────────────────────────────────────────

const SNAP_BEATS_MAP: Record<string, number> = {
  'off': 0, '1/32': 0.125, '1/16': 0.25, '1/8': 0.5,
  '1/4': 1, '1/2': 2, '1/1': 4, '2/1': 8, '4/1': 16,
}

function snapBeat(beat: number, snap: string): number {
  const g = SNAP_BEATS_MAP[snap] ?? 0
  return g === 0 ? beat : Math.round(beat / g) * g
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ─── Track layout ──────────────────────────────────────────────────────────────

interface TrackLayout {
  id: string
  y: number
  h: number
}

function computeTrackLayout(tracks: Track[], scrollY: number): TrackLayout[] {
  const layout: TrackLayout[] = []
  let y = -scrollY
  for (const track of tracks) {
    layout.push({ id: track.id, y, h: track.height })
    y += track.height + 1
  }
  return layout
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
  | { type: 'select'; x0: number; y0: number; x1: number; y1: number }
  | { type: 'draw'; trackId: string; startBeat: number; endBeat: number }
  | { type: 'split-hover'; clipId: string; beat: number }
  | { type: 'marker-drag'; markerId: string; origBar: number; x0: number }

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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ArrangementCanvas({ headerWidth, rulerHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 1, h: 1 })
  const rafRef = useRef(0)
  const dragRef = useRef<DragState>({ type: 'idle' })
  const canvasRectRef = useRef<DOMRect | null>(null)

  // Stable store refs — never used inside hooks, always read in RAF / event handlers
  const projectStoreRef = useRef(useProjectStore.getState())
  const viewStoreRef = useRef(useArrangementViewStore.getState())
  const transportStoreRef = useRef(useTransportStore.getState())

  // Subscribe all stores to their refs (no re-renders)
  useEffect(() => {
    const u1 = useProjectStore.subscribe(s => { projectStoreRef.current = s })
    const u2 = useArrangementViewStore.subscribe(s => { viewStoreRef.current = s })
    const u3 = useTransportStore.subscribe(s => { transportStoreRef.current = s })
    return () => { u1(); u2(); u3() }
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const { project } = projectStoreRef.current
      const { zoomX, scrollX, scrollY, selectedClipIds, markers, snap } = viewStoreRef.current
      const { positionBar } = transportStoreRef.current
      const drag = dragRef.current

      const tsTop = project.timeSignatureNumerator
      const barToBeat = (bar: number) => (bar - 1) * tsTop
      const beatToPx = (beat: number) => beat * zoomX - scrollX
      const pxToBeat = (px: number) => (px + scrollX) / zoomX
      const beatToBar = (beat: number) => beat / tsTop + 1

      const trackLayout = computeTrackLayout(project.tracks, scrollY)

      // ── 1. Track row backgrounds ─────────────────────────────────────────
      for (let i = 0; i < project.tracks.length; i++) {
        const track = project.tracks[i]
        const layout = trackLayout[i]
        if (layout.y + layout.h < 0 || layout.y > H) continue
        const isSelected = projectStoreRef.current.selectedTrackId === track.id
        const baseColor = i % 2 === 0 ? '#0d0d1a' : '#0a0a14'
        ctx.fillStyle = baseColor
        ctx.fillRect(0, layout.y, W, layout.h)
        // Selected track slightly lighter
        if (isSelected) {
          ctx.fillStyle = 'rgba(124,58,237,0.05)'
          ctx.fillRect(0, layout.y, W, layout.h)
        }
        // Track color tint
        ctx.fillStyle = track.color + '08'
        ctx.fillRect(0, layout.y, W, layout.h)
        // Highlight track under move drag
        if (drag.type === 'move') {
          const newTrackIdx = clamp(
            project.tracks.findIndex(t => t.id === drag.origClips.values().next().value?.trackId) +
              drag.dTrackIdx,
            0, project.tracks.length - 1
          )
          if (i === newTrackIdx) {
            ctx.fillStyle = 'rgba(124,58,237,0.06)'
            ctx.fillRect(0, layout.y, W, layout.h)
          }
        }
      }

      // ── 2. Vertical grid lines ───────────────────────────────────────────
      const totalBeats = project.totalBars * tsTop
      const firstBeat = Math.floor(scrollX / zoomX)
      const lastBeat = Math.ceil((scrollX + W) / zoomX) + 1

      for (let beat = Math.max(0, firstBeat); beat <= Math.min(totalBeats, lastBeat); beat += 0.5) {
        const isBar = beat % tsTop === 0
        const isHalfBeat = beat % 0.5 === 0 && beat % 1 !== 0
        const isBeat = beat % 1 === 0 && !isBar
        const barNum = beat / tsTop + 1
        const isEvery4 = isBar && (barNum - 1) % 4 === 0

        if (isHalfBeat && zoomX < 48) continue
        if (isBeat && zoomX < 12) continue
        if (!isBar && !isBeat && !isHalfBeat) continue

        const x = Math.floor(beatToPx(beat))
        if (x < -1 || x > W + 1) continue

        if (isEvery4) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)'
        } else if (isBar) {
          ctx.fillStyle = 'rgba(255,255,255,0.10)'
        } else if (isBeat) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)'
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.02)'
        }
        ctx.fillRect(x, 0, isBar ? 1.5 : 1, H)
      }

      // ── 3. Horizontal track separator lines ──────────────────────────────
      for (let i = 0; i < project.tracks.length; i++) {
        const layout = trackLayout[i]
        const sepY = layout.y + layout.h
        if (sepY < 0 || sepY > H) continue
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(0, sepY, W, 1)
      }

      // ── 4. Loop region ───────────────────────────────────────────────────
      const loopStartBeat = barToBeat(project.loopStart)
      const loopEndBeat = barToBeat(project.loopEnd)
      const loopX0 = beatToPx(loopStartBeat)
      const loopX1 = beatToPx(loopEndBeat)
      if (loopX1 > 0 && loopX0 < W) {
        ctx.fillStyle = 'rgba(124,58,237,0.10)'
        ctx.fillRect(loopX0, 0, loopX1 - loopX0, H)
        ctx.fillStyle = 'rgba(124,58,237,0.30)'
        ctx.fillRect(loopX0, 0, 1, H)
        ctx.fillRect(loopX1 - 1, 0, 1, H)
      }

      // ── 5. Clips ─────────────────────────────────────────────────────────
      for (let ti = 0; ti < project.tracks.length; ti++) {
        const track = project.tracks[ti]
        const layout = trackLayout[ti]
        if (!layout || layout.y + layout.h < 0 || layout.y > H) continue

        for (const clip of track.clips) {
          let displayStartBar = clip.startBar
          let displayTrackIdx = ti

          // Apply move preview
          if (drag.type === 'move' && drag.clipIds.includes(clip.id)) {
            const orig = drag.origClips.get(clip.id)
            if (orig) {
              const origBeat = barToBeat(orig.startBar)
              const newBeat = snapBeat(origBeat + drag.dBeat * tsTop, snap)
              displayStartBar = Math.max(1, beatToBar(newBeat))
              const origTrackIdx = project.tracks.findIndex(t => t.id === orig.trackId)
              displayTrackIdx = clamp(origTrackIdx + drag.dTrackIdx, 0, project.tracks.length - 1)
            }
          }

          const displayLayout = drag.type === 'move' && drag.clipIds.includes(clip.id)
            ? trackLayout[displayTrackIdx]
            : layout

          if (!displayLayout) continue

          const clipStartBeat = barToBeat(displayStartBar)
          const clipX = beatToPx(clipStartBeat)
          const clipW = clip.lengthBars * tsTop * zoomX
          const clipY = displayLayout.y + 2
          const clipH = displayLayout.h - 4

          if (clipW < 0.5 || clipX + clipW < 0 || clipX > W) continue

          const isSelected = selectedClipIds.has(clip.id)
          const isMuted = clip.muted || track.muted

          // Ghost original position during move
          if (drag.type === 'move' && drag.clipIds.includes(clip.id)) {
            const origStartBeat = barToBeat(clip.startBar)
            const ghostX = beatToPx(origStartBeat)
            const ghostY = layout.y + 2
            const ghostH = layout.h - 4
            ctx.save()
            ctx.setLineDash([4, 4])
            ctx.strokeStyle = clip.color + '60'
            ctx.lineWidth = 1
            ctx.strokeRect(ghostX + 0.5, ghostY + 0.5, clipW - 1, ghostH - 1)
            ctx.setLineDash([])
            ctx.restore()
          }

          // Clip background
          ctx.beginPath()
          ;(ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
            .roundRect(clipX, clipY, clipW, clipH, 4)
          ctx.fillStyle = isMuted
            ? clip.color + '10'
            : drag.type === 'move' && drag.clipIds.includes(clip.id)
              ? clip.color + '1a'
              : clip.color + '28'
          ctx.fill()

          // Top color bar
          ctx.fillStyle = isMuted ? clip.color + '44' : clip.color + 'cc'
          ctx.fillRect(clipX, clipY, clipW, 3)

          // Content: waveform or midi notes
          if (clipW > 20) {
            if (track.type === 'audio') {
              // Pseudo-waveform with LCG seeded noise
              const barCount = Math.floor(clipW / 3)
              let seed = clipSeed(clip.id)
              ctx.fillStyle = isMuted ? clip.color + '20' : clip.color + '55'
              const centerY = clipY + clipH / 2
              const maxAmp = (clipH - 8) / 2
              for (let b = 0; b < barCount; b++) {
                const res = lcgRand(seed)
                seed = res.next
                const amp = res.value * maxAmp
                ctx.fillRect(clipX + 3 + b * 3, centerY - amp, 2, amp * 2)
              }
            } else if (track.type === 'midi' && clip.notes.length > 0) {
              // MIDI note dots
              const noteAreaY = clipY + 4
              const noteAreaH = clipH - 8
              ctx.fillStyle = isMuted ? clip.color + '40' : clip.color + 'aa'
              for (const note of clip.notes) {
                const noteX = clipX + (note.startBeat / (clip.lengthBars * tsTop)) * clipW
                const noteY = noteAreaY + ((127 - note.pitch) / 127) * noteAreaH
                const noteW = Math.max(2, (note.lengthBeats / (clip.lengthBars * tsTop)) * clipW)
                ctx.fillRect(noteX, noteY, noteW, 2)
              }
            }
          }

          // Clip name
          if (clipW > 30) {
            ctx.font = '600 10px system-ui'
            ctx.fillStyle = isMuted ? clip.color + '80' : clip.color
            ctx.fillText(clip.name, clipX + 6, clipY + 14)
          }

          // Muted overlay: diagonal stripe pattern
          if (isMuted) {
            ctx.save()
            ctx.globalAlpha = 0.15
            ctx.strokeStyle = clip.color
            ctx.lineWidth = 1
            const stripeGap = 8
            const xStart = clipX
            const xEnd = clipX + clipW
            const yStart = clipY
            const yEnd = clipY + clipH
            ctx.beginPath()
            for (let offset = -clipH; offset < clipW + clipH; offset += stripeGap) {
              ctx.moveTo(xStart + offset, yStart)
              ctx.lineTo(xStart + offset + clipH, yEnd)
            }
            ctx.clip()
            ctx.beginPath()
            ;(ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
              .roundRect(xStart, yStart, xEnd - xStart, yEnd - yStart, 4)
            ctx.clip()
            ctx.stroke()
            ctx.restore()
          }

          // Selected border + glow
          if (isSelected) {
            ctx.save()
            ctx.shadowColor = clip.color
            ctx.shadowBlur = 6
            ctx.strokeStyle = clip.color
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ;(ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
              .roundRect(clipX + 0.75, clipY + 0.75, clipW - 1.5, clipH - 1.5, 4)
            ctx.stroke()
            ctx.restore()

            // Resize handles
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
            ctx.lineWidth = 1.5
            ctx.setLineDash([4, 3])
            ctx.beginPath()
            ctx.moveTo(splitX, clipY)
            ctx.lineTo(splitX, clipY + clipH)
            ctx.stroke()
            ctx.restore()
          }
        }
      }

      // ── 6. Selection rectangle ───────────────────────────────────────────
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

      // ── 7. Draw preview ──────────────────────────────────────────────────
      if (drag.type === 'draw') {
        const trackIdx = project.tracks.findIndex(t => t.id === drag.trackId)
        const drawLayout = trackLayout[trackIdx]
        if (drawLayout) {
          const startBeat = Math.min(drag.startBeat, drag.endBeat)
          const endBeat = Math.max(drag.startBeat, drag.endBeat)
          const drawX = beatToPx(startBeat)
          const drawW = (endBeat - startBeat) * zoomX
          const drawY = drawLayout.y + 2
          const drawH = drawLayout.h - 4
          ctx.save()
          ctx.setLineDash([5, 4])
          ctx.strokeStyle = 'rgba(168,85,247,0.8)'
          ctx.lineWidth = 1.5
          ctx.fillStyle = 'rgba(124,58,237,0.15)'
          ctx.beginPath()
          ;(ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
            .roundRect(drawX, drawY, Math.max(8, drawW), drawH, 4)
          ctx.fill()
          ctx.stroke()
          ctx.restore()
        }
      }

      // ── 8. Playhead ──────────────────────────────────────────────────────
      const playBeat = barToBeat(positionBar)
      const phX = Math.floor(beatToPx(playBeat))
      if (phX >= -2 && phX <= W + 2) {
        ctx.fillStyle = '#ff3060'
        ctx.fillRect(phX, 0, 1.5, H)
        // Downward triangle at top
        ctx.beginPath()
        ctx.moveTo(phX - 5, 0)
        ctx.lineTo(phX + 6, 0)
        ctx.lineTo(phX + 0.75, 8)
        ctx.closePath()
        ctx.fill()
      }

      // ── 9. Markers ───────────────────────────────────────────────────────
      for (const marker of markers) {
        const markerBeat = barToBeat(marker.bar)
        const mx = Math.floor(beatToPx(markerBeat))
        if (mx < -10 || mx > W + 10) continue
        ctx.fillStyle = marker.color
        ctx.beginPath()
        ctx.moveTo(mx, 0)
        ctx.lineTo(mx + 8, 0)
        ctx.lineTo(mx, 8)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(mx, 8, 1, H - 8)
      }
    }

    function loop() {
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // stable — reads everything from refs

  // ── ResizeObserver ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { inlineSize: w, blockSize: h } = entry.contentBoxSize[0]
        sizeRef.current = { w, h }
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvasRectRef.current = canvas.getBoundingClientRect()
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── Hit test helpers ─────────────────────────────────────────────────────────
  const hitTestClip = useCallback((px: number, py: number): {
    clip: Clip
    track: Track
    trackIdx: number
    zone: 'resize-start' | 'resize-end' | 'body'
  } | null => {
    const { project } = projectStoreRef.current
    const { zoomX, scrollX, scrollY } = viewStoreRef.current
    const tsTop = project.timeSignatureNumerator
    const barToBeat = (bar: number) => (bar - 1) * tsTop
    const beatToPx = (beat: number) => beat * zoomX - scrollX
    const trackLayout = computeTrackLayout(project.tracks, scrollY)

    for (let ti = project.tracks.length - 1; ti >= 0; ti--) {
      const track = project.tracks[ti]
      const layout = trackLayout[ti]
      if (!layout) continue
      const clipY = layout.y
      const clipH = layout.h
      if (py < clipY || py > clipY + clipH) continue

      for (let ci = track.clips.length - 1; ci >= 0; ci--) {
        const clip = track.clips[ci]
        const clipX = beatToPx(barToBeat(clip.startBar))
        const clipW = clip.lengthBars * tsTop * zoomX
        if (px < clipX - 1 || px > clipX + clipW + 1) continue
        const RESIZE_PX = 8
        let zone: 'resize-start' | 'resize-end' | 'body' = 'body'
        if (clipW > 16) {
          if (px < clipX + RESIZE_PX) zone = 'resize-start'
          else if (px > clipX + clipW - RESIZE_PX) zone = 'resize-end'
        }
        return { clip, track, trackIdx: ti, zone }
      }
    }
    return null
  }, [])

  const pxToTrackIdx = useCallback((py: number): number => {
    const { project } = projectStoreRef.current
    const { scrollY } = viewStoreRef.current
    const layout = computeTrackLayout(project.tracks, scrollY)
    for (let i = 0; i < layout.length; i++) {
      const l = layout[i]
      if (py >= l.y && py <= l.y + l.h) return i
    }
    return -1
  }, [])

  // ── Pointer down ─────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    canvasRectRef.current = e.currentTarget.getBoundingClientRect()

    const { project } = projectStoreRef.current
    const { tool, zoomX, scrollX, snap } = viewStoreRef.current
    const { setScroll, selectClips, deselectAll, toggleSelectClip } = useArrangementViewStore.getState()

    const px = e.nativeEvent.offsetX
    const py = e.nativeEvent.offsetY
    const tsTop = project.timeSignatureNumerator
    const pxToBeat = (x: number) => (x + scrollX) / zoomX
    const beatToBar = (beat: number) => beat / tsTop + 1

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
          dragRef.current = {
            type: 'resize-start',
            clipId: clip.id,
            trackId: track.id,
            origStart: clip.startBar,
            origLen: clip.lengthBars,
            x0: px,
          }
        } else if (hit.zone === 'resize-end') {
          dragRef.current = {
            type: 'resize-end',
            clipId: clip.id,
            trackId: track.id,
            origLen: clip.lengthBars,
            origStart: clip.startBar,
            x0: px,
          }
        } else {
          // Move
          const { selectedClipIds: selIds } = viewStoreRef.current
          const clipIds = selIds.has(clip.id) ? [...selIds] : [clip.id]
          const origClips = new Map<string, { startBar: number; trackId: string }>()
          project.tracks.forEach(t => {
            t.clips.forEach(c => {
              if (clipIds.includes(c.id)) origClips.set(c.id, { startBar: c.startBar, trackId: t.id })
            })
          })
          dragRef.current = {
            type: 'move',
            clipIds,
            origClips,
            beat0: pxToBeat(px),
            trackIdx0: trackIdx,
            dBeat: 0,
            dTrackIdx: 0,
          }
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

    void setScroll // suppress unused warning — used in wheel
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

    if (d.type === 'move') {
      const rawBeat = pxToBeat(px)
      const beat0Beat = d.beat0
      const rawDeltaBeat = rawBeat - beat0Beat
      // delta in bars
      const rawDeltaBars = rawDeltaBeat / tsTop
      const snapG = SNAP_BEATS_MAP[snap] ?? 0
      const snappedDeltaBars = snapG > 0
        ? Math.round(rawDeltaBars / (snapG / tsTop)) * (snapG / tsTop)
        : rawDeltaBars
      const curTrackIdx = pxToTrackIdx(py)
      const dTrackIdx = curTrackIdx >= 0 ? curTrackIdx - d.trackIdx0 : d.dTrackIdx
      d.dBeat = snappedDeltaBars * tsTop
      d.dTrackIdx = dTrackIdx

    } else if (d.type === 'resize-end') {
      const origClip = project.tracks
        .find(t => t.id === d.trackId)
        ?.clips.find(c => c.id === d.clipId)
      if (origClip) {
        const endBeat = pxToBeat(px)
        const origEndBeat = barToBeat(origClip.startBar) + origClip.lengthBars * tsTop
        const rawDeltaBeat = endBeat - (origEndBeat - (pxToBeat(d.x0) - origEndBeat + origEndBeat - origEndBeat))
        const rawLen = (pxToBeat(px) - barToBeat(d.origStart)) / tsTop * tsTop
        const snapG = SNAP_BEATS_MAP[snap] ?? 0
        const snappedLen = snapG > 0
          ? Math.max(snapG / tsTop, Math.round(rawLen / (snapG / tsTop)) * (snapG / tsTop))
          : Math.max(0.25 / tsTop, rawLen / tsTop)
        void rawDeltaBeat
        const newLenBars = Math.max(0.25 / tsTop, snappedLen)
        dragRef.current = { ...d, origLen: newLenBars }
        // Commit live
        useProjectStore.getState().resizeClip(d.clipId, d.origStart, newLenBars)
      }

    } else if (d.type === 'resize-start') {
      const origClip = project.tracks
        .find(t => t.id === d.trackId)
        ?.clips.find(c => c.id === d.clipId)
      if (origClip) {
        const newStartBeat = snapBeat(pxToBeat(px), snap)
        const newStartBar = Math.max(1, beatToBar(newStartBeat))
        const origEndBar = d.origStart + d.origLen
        const newLenBars = Math.max(0.25 / tsTop, origEndBar - newStartBar)
        useProjectStore.getState().resizeClip(d.clipId, newStartBar, newLenBars)
      }

    } else if (d.type === 'select') {
      d.x1 = px
      d.y1 = py

    } else if (d.type === 'draw') {
      const rawBeat = pxToBeat(px)
      const snappedBeat = snapBeat(rawBeat, snap)
      const tsTop2 = project.timeSignatureNumerator
      d.endBeat = Math.max(d.startBeat + tsTop2 * 0.25, snappedBeat)

    } else if (tool === 'split' && d.type === 'idle') {
      // Update split hover
      const hit = hitTestClip(px, py)
      if (hit) {
        const rawBeat = pxToBeat(px)
        dragRef.current = { type: 'split-hover', clipId: hit.clip.id, beat: rawBeat }
      } else {
        dragRef.current = { type: 'idle' }
      }
    }

    // If we had a split-hover but moved off, clear it
    if (d.type === 'split-hover' && tool !== 'split') {
      dragRef.current = { type: 'idle' }
    }

    // Cursor
    if (!canvas) return
    if (d.type === 'move') { canvas.style.cursor = 'grabbing'; return }
    if (d.type === 'resize-start' || d.type === 'resize-end') { canvas.style.cursor = 'ew-resize'; return }
    if (tool === 'pencil' || tool === 'split' || tool === 'erase') { canvas.style.cursor = 'crosshair'; return }

    const hit = hitTestClip(px, py)
    if (hit?.zone === 'resize-start' || hit?.zone === 'resize-end') canvas.style.cursor = 'ew-resize'
    else if (hit?.zone === 'body') canvas.style.cursor = 'grab'
    else canvas.style.cursor = 'default'
  }, [hitTestClip, pxToTrackIdx])

  // ── Pointer up ────────────────────────────────────────────────────────────────
  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    const { project } = projectStoreRef.current
    const { snap, scrollX, scrollY, zoomX } = viewStoreRef.current
    const { selectClips } = useArrangementViewStore.getState()
    const tsTop = project.timeSignatureNumerator
    const pxToBeat = (x: number) => (x + scrollX) / zoomX
    const beatToBar = (beat: number) => beat / tsTop + 1

    if (d.type === 'move') {
      const ps = useProjectStore.getState()
      for (const clipId of d.clipIds) {
        const orig = d.origClips.get(clipId)
        if (!orig) continue
        const origBeat = barToBeat(orig.startBar, tsTop)
        const snappedDeltaBeat = snapBeat(origBeat + d.dBeat * tsTop, snap) - origBeat
        const newStartBar = Math.max(1, beatToBar(origBeat + snappedDeltaBeat))
        const origTrackIdx = project.tracks.findIndex(t => t.id === orig.trackId)
        const newTrackIdx = clamp(origTrackIdx + d.dTrackIdx, 0, project.tracks.length - 1)
        const newTrackId = project.tracks[newTrackIdx]?.id ?? orig.trackId
        ps.moveClip(clipId, newStartBar, newTrackId)
      }

    } else if (d.type === 'select') {
      if (Math.abs(d.x1 - d.x0) > 4 || Math.abs(d.y1 - d.y0) > 4) {
        const { scrollX: sx, scrollY: sy, zoomX: zx } = viewStoreRef.current
        const trackLayout = computeTrackLayout(project.tracks, sy)
        const x0 = Math.min(d.x0, d.x1)
        const x1 = Math.max(d.x0, d.x1)
        const y0 = Math.min(d.y0, d.y1)
        const y1 = Math.max(d.y0, d.y1)
        const beatLeft = (x0 + sx) / zx
        const beatRight = (x1 + sx) / zx
        const barLeft = beatLeft / tsTop + 1
        const barRight = beatRight / tsTop + 1
        const selected: string[] = []
        for (let ti = 0; ti < project.tracks.length; ti++) {
          const layout = trackLayout[ti]
          if (!layout) continue
          if (layout.y + layout.h < y0 || layout.y > y1) continue
          for (const clip of project.tracks[ti].clips) {
            const clipEnd = clip.startBar + clip.lengthBars
            if (clip.startBar < barRight && clipEnd > barLeft) selected.push(clip.id)
          }
        }
        selectClips(selected)
      }

    } else if (d.type === 'draw') {
      const startBar = Math.max(1, beatToBar(snapBeat(d.startBeat, snap)))
      const endBeat = snapBeat(d.endBeat, snap)
      const endBar = beatToBar(endBeat)
      const lengthBars = Math.max(0.25 / tsTop, endBar - startBar)
      const track = project.tracks.find(t => t.id === d.trackId)
      if (track) {
        const newClip: import('../../types/project').Clip = {
          id: `clip-${Date.now()}`,
          trackId: d.trackId,
          name: 'New Clip',
          startBar,
          lengthBars,
          color: track.color,
          muted: false,
          notes: [],
        }
        useProjectStore.getState().addClip(newClip)
        selectClips([newClip.id])
      }
    }

    dragRef.current = { type: 'idle' }
  }, [])

  // ── Wheel ─────────────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const { zoomX, scrollX, scrollY, setZoom, setScroll } = viewStoreRef.current
    const { scrollX: sx, scrollY: sy, zoomX: zx } = viewStoreRef.current

    if (e.ctrlKey || e.metaKey) {
      const pxToBeat = (px: number) => (px + sx) / zx
      const beatAtPtr = pxToBeat(e.nativeEvent.offsetX)
      const newZoomX = clamp(zoomX * (e.deltaY < 0 ? 1.12 : 0.88), 2, 512)
      const newScrollX = beatAtPtr * newZoomX - e.nativeEvent.offsetX
      setZoom(newZoomX)
      setScroll(newScrollX, scrollY)
    } else if (e.shiftKey) {
      setScroll(scrollX + e.deltaY * 0.8, scrollY)
    } else {
      setScroll(scrollX + e.deltaX * 0.8, scrollY + e.deltaY * 0.8)
    }
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
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
      const allIds: string[] = []
      project.tracks.forEach(t => t.clips.forEach(c => allIds.push(c.id)))
      useArrangementViewStore.getState().selectClips(allIds)
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault()
      if (selectedClipIds.size > 0) {
        useProjectStore.getState().duplicateClips([...selectedClipIds])
      }
    } else if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
      // Split selected clips at playhead bar
      if (selectedClipIds.size > 0) {
        for (const clipId of selectedClipIds) {
          useProjectStore.getState().splitClip(clipId, Math.round(positionBar))
        }
        useArrangementViewStore.getState().deselectAll()
      }
    } else if (e.key === ' ') {
      e.preventDefault()
      if (playing) {
        useTransportStore.getState().stop()
      } else {
        useTransportStore.getState().play()
      }
    }
  }, [])

  return (
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
        outline: 'none',
        cursor: 'default',
        touchAction: 'none',
        background: '#08080f',
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    />
  )
}

// Utility used in onPointerUp closure
function barToBeat(bar: number, tsTop: number): number {
  return (bar - 1) * tsTop
}
