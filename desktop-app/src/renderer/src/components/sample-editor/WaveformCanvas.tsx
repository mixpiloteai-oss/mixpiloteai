// ─── WaveformCanvas ───────────────────────────────────────────────────────────
// High-DPI canvas component for audio waveform display.
// Renders peaks, RMS envelope, playhead, selection, transients, warp markers.

import React, { useRef, useEffect, useCallback } from 'react'
import { useAudioEditorStore } from '../../store/audioEditorStore'
import { WaveformCache } from '../../audio/editor/WaveformCache'

const cache = new WaveformCache()

const COLORS = {
  waveformPos:  '#10b981',
  waveformNeg:  '#059669',
  rms:          '#34d399',
  selection:    'rgba(124, 58, 237, 0.13)',
  playhead:     '#f59e0b',
  transient:    '#ef4444',
  warpMarker:   '#6366f1',
  background:   '#0f172a',
}

export const WaveformCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number | null>(null)
  const isDragging = useRef(false)
  const dragStart  = useRef(0)

  const { engine, selectionStart, selectionEnd, cursorPosition, zoomLevel,
          scrollOffset, transientMarkers, warpMarkers, setSelection, setCursor } =
    useAudioEditorStore()

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !engine) return
    const ctx   = canvas.getContext('2d')
    if (!ctx) return

    const dpr    = window.devicePixelRatio ?? 1
    const width  = canvas.clientWidth
    const height = canvas.clientHeight
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width  = width  * dpr
      canvas.height = height * dpr
    }
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    const flat      = engine.editBuffer.flatten()
    const mono      = flat[0]
    if (!mono || mono.length === 0) return

    const totalSamples = mono.length
    const key          = cache.cacheKey(`buf-${totalSamples}`, zoomLevel)
    let   peaks        = cache.get(key)
    if (!peaks) {
      peaks = cache.computePeaks(mono, zoomLevel)
      cache.set(key, peaks)
    }

    const mid    = height / 2
    const startPx = Math.floor(scrollOffset / zoomLevel)
    const endPx   = Math.min(startPx + width, peaks.min.length)

    // Selection highlight
    if (selectionStart !== null && selectionEnd !== null) {
      const sx = (selectionStart / zoomLevel) - startPx
      const ex = (selectionEnd   / zoomLevel) - startPx
      ctx.fillStyle = COLORS.selection
      ctx.fillRect(sx, 0, ex - sx, height)
    }

    // RMS envelope
    ctx.strokeStyle = COLORS.rms
    ctx.globalAlpha = 0.3
    ctx.lineWidth   = 1
    ctx.beginPath()
    for (let px = startPx; px < endPx; px++) {
      const x    = px - startPx
      const rmsH = (peaks.rms[px] ?? 0) * mid
      if (px === startPx) ctx.moveTo(x, mid - rmsH)
      else ctx.lineTo(x, mid - rmsH)
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    // Waveform
    for (let px = startPx; px < endPx; px++) {
      const x      = px - startPx
      const minV   = peaks.min[px] ?? 0
      const maxV   = peaks.max[px] ?? 0
      const maxY   = mid - maxV * mid
      const minY   = mid - minV * mid
      ctx.strokeStyle = maxV >= 0 ? COLORS.waveformPos : COLORS.waveformNeg
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(x + 0.5, maxY)
      ctx.lineTo(x + 0.5, minY)
      ctx.stroke()
    }

    // Transient markers
    ctx.strokeStyle = COLORS.transient
    ctx.lineWidth   = 1
    for (const pos of transientMarkers) {
      const x = (pos / zoomLevel) - startPx
      if (x >= 0 && x <= width) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, 8)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - 4, 0)
        ctx.lineTo(x + 4, 0)
        ctx.lineTo(x, 6)
        ctx.closePath()
        ctx.fillStyle = COLORS.transient
        ctx.fill()
      }
    }

    // Warp markers
    for (const wm of warpMarkers) {
      const x = (wm.sampleOffset / zoomLevel) - startPx
      if (x >= 0 && x <= width) {
        ctx.strokeStyle = COLORS.warpMarker
        ctx.lineWidth   = 1.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
        ctx.fillStyle = COLORS.warpMarker
        ctx.fillRect(x - 4, height - 12, 8, 12)
      }
    }

    // Playhead
    const playX = (cursorPosition / zoomLevel) - startPx
    if (playX >= 0 && playX <= width) {
      ctx.strokeStyle = COLORS.playhead
      ctx.lineWidth   = 2
      ctx.beginPath()
      ctx.moveTo(playX, 0)
      ctx.lineTo(playX, height)
      ctx.stroke()
    }
  }, [engine, selectionStart, selectionEnd, cursorPosition, zoomLevel, scrollOffset, transientMarkers, warpMarkers, setSelection, setCursor])

  useEffect(() => {
    const loop = (): void => { draw(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const sampleFromX = useCallback((clientX: number): number => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect  = canvas.getBoundingClientRect()
    const px    = clientX - rect.left
    return Math.round((px + scrollOffset / zoomLevel) * zoomLevel)
  }, [scrollOffset, zoomLevel])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    const sample = sampleFromX(e.clientX)
    dragStart.current = sample
    setCursor(sample)
    setSelection(null, null)
  }, [sampleFromX, setCursor, setSelection])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const sample = sampleFromX(e.clientX)
    const start  = Math.min(dragStart.current, sample)
    const end    = Math.max(dragStart.current, sample)
    setSelection(start, end)
    setCursor(sample)
  }, [sampleFromX, setSelection, setCursor])

  const onMouseUp = useCallback(() => { isDragging.current = false }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'text' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  )
}

export default WaveformCanvas
