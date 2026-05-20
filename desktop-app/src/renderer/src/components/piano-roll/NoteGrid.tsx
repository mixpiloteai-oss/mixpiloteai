import { useRef, useEffect, useCallback } from 'react'
import { usePianoRollStore }                from './usePianoRollStore'
import { isBlackKey, pitchName, SNAP_BEATS, snapFloor, type PRNote, type SnapGrid } from './types'
import { getTransport }                     from '../../audio'
import { getScalePitches, SCALE_ROOT_MIDI } from '../../lib/musicTheory'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C_ROW_BLACK    = '#08080f'
const C_ROW_WHITE    = '#0b0b16'
const C_C_LINE       = 'rgba(124,58,237,0.2)'
const C_BAR_LINE     = 'rgba(124,58,237,0.28)'
const C_BEAT_LINE    = 'rgba(255,255,255,0.055)'
const C_SNAP_LINE    = 'rgba(255,255,255,0.022)'
const C_PH           = '#ff3060'
const C_PH_HEAD      = '#ff3060'
const C_SEL_FILL     = 'rgba(124,58,237,0.07)'
const C_SEL_STROKE   = 'rgba(124,58,237,0.55)'
const C_GHOST        = 'rgba(100,60,200,0.14)'
const C_GHOST_BORDER = 'rgba(120,80,220,0.22)'

// ─── Drag state ───────────────────────────────────────────────────────────────

type DragState =
  | { type: 'idle' }
  | {
      type: 'move'
      noteIds: string[]
      origPos: Map<string, { startBeat: number; pitch: number }>
      beat0: number; pitch0: number
      dBeat: number; dPitch: number
    }
  | { type: 'resize'; noteId: string; origLen: number; origStart: number; x0: number }
  | { type: 'select'; x0: number; y0: number; x1: number; y1: number }
  | { type: 'draw';   noteId: string; beat0: number }
  | { type: 'erase' }

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function pxToBeat(px: number, scrollX: number, zoomX: number) { return (px + scrollX) / zoomX }
function pyToPitch(py: number, scrollY: number, zoomY: number) {
  return 127 - Math.floor((py + scrollY) / zoomY)
}

function hitTest(
  px: number, py: number,
  notes: PRNote[],
  zoomX: number, zoomY: number,
  scrollX: number, scrollY: number,
): { type: 'body' | 'resize'; note: PRNote } | null {
  const RESIZE_PX = 6
  for (let i = notes.length - 1; i >= 0; i--) {
    const n  = notes[i]
    const x  = n.startBeat * zoomX - scrollX
    const y  = (127 - n.pitch) * zoomY - scrollY
    const w  = n.lengthBeats * zoomX
    const h  = zoomY - 1
    if (px >= x && px < x + w && py >= y && py < y + h) {
      return { type: px > x + w - Math.min(RESIZE_PX, w * 0.35) ? 'resize' : 'body', note: n }
    }
  }
  return null
}

function drawSingleNote(
  ctx: CanvasRenderingContext2D,
  note: PRNote, zoomX: number, zoomY: number, scrollX: number, scrollY: number,
  W: number, H: number, ghost: boolean,
) {
  const x = note.startBeat * zoomX - scrollX
  const y = (127 - note.pitch) * zoomY - scrollY
  const w = note.lengthBeats * zoomX
  const h = zoomY - 1

  if (x + w < -1 || x > W + 1 || y + h < -1 || y > H + 1) return

  if (ghost) {
    ctx.fillStyle   = C_GHOST
    ctx.strokeStyle = C_GHOST_BORDER
    ctx.lineWidth   = 1
    const rw = Math.max(1, w - 1)
    const rh = Math.max(1, h - 1)
    ctx.beginPath()
    ctx.roundRect(x + 0.5, y + 0.5, rw, rh, Math.min(2, rh / 2))
    ctx.fill()
    ctx.stroke()
    return
  }

  // Probability alpha (dim notes with probability < 100)
  const prob     = note.probability ?? 100
  const probAlpha = prob / 100
  const a = (note.muted ? 0.2 : (0.38 + (note.velocity / 127) * 0.62)) * probAlpha
  const fill   = note.selected
    ? `rgba(167,139,250,${a})`
    : `rgba(124,58,237,${a})`
  const border = note.selected ? '#c4b5fd' : 'rgba(168,85,247,0.75)'

  const rw = Math.max(1, w - 2)
  const rh = Math.max(1, h - 1)
  const r  = Math.min(2, rh / 2, rw / 2)

  ctx.beginPath()
  ctx.roundRect(x + 1, y + 0.5, rw, rh, r)
  ctx.fillStyle = fill
  ctx.fill()

  ctx.strokeStyle = border
  ctx.lineWidth   = 1
  ctx.stroke()

  // Glowing top edge highlight
  if (!note.muted) {
    ctx.fillStyle = note.selected
      ? 'rgba(255,255,255,0.35)'
      : 'rgba(255,255,255,0.18)'
    ctx.fillRect(x + 2, y + 1, Math.max(1, rw - 4), 1)
  }

  // Glide indicator — small triangle on the right edge
  if (note.glide && w > 6) {
    ctx.fillStyle = 'rgba(99,202,255,0.85)'
    ctx.beginPath()
    ctx.moveTo(x + w - 1, y + 1)
    ctx.lineTo(x + w - 1, y + h - 1)
    ctx.lineTo(x + w + 5, y + h / 2)
    ctx.closePath()
    ctx.fill()
  }

  // Probability badge (when not 100%)
  if (prob < 100 && zoomY >= 12 && w >= 20) {
    ctx.fillStyle = 'rgba(251,191,36,0.9)'
    ctx.font      = `600 8px system-ui`
    ctx.textAlign = 'right'
    ctx.fillText(`${prob}%`, x + w - 5, y + h - 2)
    ctx.textAlign = 'left'
  }

  // Resize handle
  if (w > 8) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(x + w - 3.5, y + 2, 2, h - 4)
  }

  // Pitch label (only when notes are tall enough to read)
  if (zoomY >= 12 && w >= 24) {
    ctx.fillStyle = `rgba(255,255,255,${note.selected ? 0.75 : 0.5})`
    ctx.font      = `${Math.min(9, zoomY - 4)}px Inter, system-ui, sans-serif`
    ctx.fillText(pitchName(note.pitch), x + 3, y + h - 1)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NoteGridProps {
  ghostNotes?: PRNote[]
}

export default function NoteGrid({ ghostNotes = [] }: NoteGridProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const sizeRef       = useRef({ w: 1, h: 1 })
  const rafRef        = useRef(0)
  const dragRef       = useRef<DragState>({ type: 'idle' })
  // Mirror store into a ref so the stable rAF closure always reads latest
  const storeRef      = useRef(usePianoRollStore.getState())
  const ghostRef      = useRef(ghostNotes)
  ghostRef.current    = ghostNotes
  // Memoized sorted notes for glide line calculations — only rebuilt when notes array reference changes
  const sortedNotesRef     = useRef<typeof storeRef.current.notes>([])
  const sortedNotesInputRef = useRef<typeof storeRef.current.notes | null>(null)

  // Subscribe store → storeRef (no re-render, just ref update)
  useEffect(() => {
    return usePianoRollStore.subscribe(s => { storeRef.current = s })
  }, [])

  // Direct store accessor for event handlers (always current)
  const store = useCallback(() => usePianoRollStore.getState(), [])

  // ── Stable rAF draw loop ────────────────────────────────────────────────
  useEffect(() => {
    const transport = getTransport()

    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { w: W, h: H } = sizeRef.current
      const {
        notes, snap, zoomX, zoomY, scrollX, scrollY, timeSigTop, totalBeats,
        scaleEnabled, scaleRoot, scaleMode,
      } = storeRef.current
      const d = dragRef.current

      ctx.clearRect(0, 0, W, H)

      // Pre-compute scale pitch set for row tinting
      const scalePitchSet = scaleEnabled
        ? new Set(getScalePitches(scaleRoot, scaleMode).map(p => p % 12))
        : null
      const rootMidiMod = scaleEnabled ? SCALE_ROOT_MIDI[scaleRoot] % 12 : -1

      // ── Row backgrounds ──────────────────────────────────────────────
      const pitchTop = Math.min(127, Math.ceil((scrollY + H) / zoomY) + 1)
      const pitchBot = Math.max(0,   Math.floor(scrollY / zoomY) - 1)
      for (let p = pitchBot; p <= pitchTop; p++) {
        const y       = (127 - p) * zoomY - scrollY
        const pc      = p % 12
        const inScale = scalePitchSet?.has(pc) ?? false
        const isRoot  = pc === rootMidiMod

        let rowColor: string
        if (isRoot && scaleEnabled) {
          rowColor = isBlackKey(p) ? '#1a0a30' : '#1c0a36'
        } else if (inScale) {
          rowColor = isBlackKey(p) ? '#0f0820' : '#12092a'
        } else {
          rowColor = isBlackKey(p) ? C_ROW_BLACK : C_ROW_WHITE
        }

        ctx.fillStyle = rowColor
        ctx.fillRect(0, y, W, zoomY)
        if (p % 12 === 0) {         // C-note octave separator
          ctx.fillStyle = C_C_LINE
          ctx.fillRect(0, y, W, 1)
        }
      }

      // ── Vertical grid ────────────────────────────────────────────────
      const snapStep = (SNAP_BEATS[snap as SnapGrid] || 0) > 0
        ? SNAP_BEATS[snap as SnapGrid]
        : 0.25
      const gridStep    = Math.max(snapStep, 0.0625)
      const beatPerPx   = 1 / zoomX
      const firstBeat   = Math.floor((scrollX / zoomX) / gridStep) * gridStep
      const lastBeat    = (scrollX + W) * beatPerPx + gridStep

      for (let b = firstBeat; b <= Math.min(totalBeats, lastBeat); b += gridStep) {
        const x       = Math.floor(b * zoomX - scrollX)
        const isBar   = Math.abs(b % timeSigTop) < 1e-9
        const isBeat  = Math.abs(b % 1) < 1e-9
        ctx.fillStyle = isBar ? C_BAR_LINE : isBeat ? C_BEAT_LINE : C_SNAP_LINE
        ctx.fillRect(x, 0, isBar ? 1.5 : 1, H)
      }

      // ── Ghost notes ──────────────────────────────────────────────────
      for (const gn of ghostRef.current) {
        drawSingleNote(ctx, gn, zoomX, zoomY, scrollX, scrollY, W, H, true)
      }

      // ── Glide lines (portamento connectors) ──────────────────────────
      // Cache sorted notes — only re-sort when the notes array reference changes
      if (sortedNotesInputRef.current !== notes) {
        sortedNotesInputRef.current = notes
        sortedNotesRef.current = [...notes].sort((a, b) => a.startBeat - b.startBeat)
      }
      const sortedNotes = sortedNotesRef.current
      for (let i = 0; i < sortedNotes.length - 1; i++) {
        const n = sortedNotes[i]!
        if (!n.glide) continue
        const next = sortedNotes[i + 1]
        if (!next) continue
        // Draw a bezier curve from n end to next start at different pitch
        const x1 = (n.startBeat + n.lengthBeats) * zoomX - scrollX
        const y1 = (127 - n.pitch) * zoomY - scrollY + zoomY / 2
        const x2 = next.startBeat * zoomX - scrollX
        const y2 = (127 - next.pitch) * zoomY - scrollY + zoomY / 2
        if (x1 > W || x2 < 0) continue
        ctx.strokeStyle = 'rgba(99,202,255,0.5)'
        ctx.lineWidth   = 1.5
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // ── Notes with optional move overlay ────────────────────────────
      for (const note of notes) {
        // Note out of viewport — skip
        const noteX = note.startBeat * zoomX - scrollX
        const noteW = note.lengthBeats * zoomX
        const noteY = (127 - note.pitch) * zoomY - scrollY
        const noteH = zoomY
        if (noteX + noteW < -1 || noteX > W + 1 || noteY + noteH < -1 || noteY > H + 1) continue

        let display = note
        if (d.type === 'move' && d.noteIds.includes(note.id)) {
          const op = d.origPos.get(note.id)!
          display  = {
            ...note,
            startBeat: Math.max(0, op.startBeat + d.dBeat),
            pitch:     Math.max(0, Math.min(127, op.pitch + d.dPitch)),
          }
        }
        drawSingleNote(ctx, display, zoomX, zoomY, scrollX, scrollY, W, H, false)
      }

      // ── Rubber-band selection rect ───────────────────────────────────
      if (d.type === 'select') {
        const sx = Math.min(d.x0, d.x1), ex = Math.max(d.x0, d.x1)
        const sy = Math.min(d.y0, d.y1), ey = Math.max(d.y0, d.y1)
        ctx.fillStyle   = C_SEL_FILL
        ctx.fillRect(sx, sy, ex - sx, ey - sy)
        ctx.strokeStyle = C_SEL_STROKE
        ctx.lineWidth   = 1
        ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
      }

      // ── Playhead ─────────────────────────────────────────────────────
      const pos      = transport.getPosition()
      const tSig     = transport.timeSigTop
      const playBeat = (pos.bar - 1) * tSig + (pos.beat - 1) + pos.tick / 480
      const phX      = Math.floor(playBeat * zoomX - scrollX)
      if (phX >= -1 && phX <= W + 1) {
        ctx.fillStyle = C_PH
        ctx.fillRect(phX, 0, 1.5, H)
        ctx.fillStyle = C_PH_HEAD
        ctx.beginPath()
        ctx.moveTo(phX - 4.5, 0)
        ctx.lineTo(phX + 5.5, 0)
        ctx.lineTo(phX + 0.5, 7)
        ctx.closePath()
        ctx.fill()
      }
    }

    function loop() {
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // stable — reads everything from refs

  // ── Resize observer ─────────────────────────────────────────────────────
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
        if (ctx) { ctx.scale(dpr, dpr) }
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── Pointer down ────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const s  = store()
    const px = e.nativeEvent.offsetX
    const py = e.nativeEvent.offsetY
    const hit = hitTest(px, py, s.notes, s.zoomX, s.zoomY, s.scrollX, s.scrollY)

    if (s.tool === 'pointer') {
      if (hit?.type === 'resize') {
        dragRef.current = {
          type: 'resize', noteId: hit.note.id,
          origLen: hit.note.lengthBeats, origStart: hit.note.startBeat,
          x0: px,
        }
      } else if (hit?.type === 'body') {
        if (e.altKey) {
          usePianoRollStore.getState().duplicateSelected()
        }
        const freshS = store()
        if (!hit.note.selected && !e.shiftKey) freshS.deselectAll()
        freshS.selectNote(hit.note.id, e.shiftKey)
        const selected = store().notes.filter(n => n.selected)
        dragRef.current = {
          type: 'move',
          noteIds: selected.map(n => n.id),
          origPos: new Map(selected.map(n => [n.id, { startBeat: n.startBeat, pitch: n.pitch }])),
          beat0:  pxToBeat(px, s.scrollX, s.zoomX),
          pitch0: pyToPitch(py, s.scrollY, s.zoomY),
          dBeat:  0, dPitch: 0,
        }
      } else {
        if (!e.shiftKey) store().deselectAll()
        dragRef.current = { type: 'select', x0: px, y0: py, x1: px, y1: py }
      }

    } else if (s.tool === 'pencil') {
      if (hit) {
        store().removeNote(hit.note.id)
      } else {
        const rawBeat = pxToBeat(px, s.scrollX, s.zoomX)
        const beat    = snapFloor(rawBeat, s.snap)
        const pitch   = pyToPitch(py, s.scrollY, s.zoomY)
        if (pitch < 0 || pitch > 127) return
        const note    = store().addNote({
          pitch, startBeat: beat, lengthBeats: s.defaultLength, velocity: s.defaultVelocity,
        })
        dragRef.current = { type: 'draw', noteId: note.id, beat0: beat }
      }

    } else if (s.tool === 'erase') {
      if (hit) store().removeNote(hit.note.id)
      dragRef.current = { type: 'erase' }

    } else if (s.tool === 'velocity') {
      dragRef.current = { type: 'idle' }
    }
  }, [store])

  // ── Pointer move ────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const s  = store()
    const px = e.nativeEvent.offsetX
    const py = e.nativeEvent.offsetY
    const d  = dragRef.current

    if (d.type === 'move') {
      const beat  = pxToBeat(px, s.scrollX, s.zoomX)
      const pitch = pyToPitch(py, s.scrollY, s.zoomY)
      const sv    = SNAP_BEATS[s.snap as SnapGrid] || 0
      const rawDB = beat - d.beat0
      d.dBeat     = sv > 0 ? Math.round(rawDB / sv) * sv : rawDB
      d.dPitch    = Math.round(pitch - d.pitch0)

    } else if (d.type === 'resize') {
      const beatAt = pxToBeat(px, s.scrollX, s.zoomX)
      const rawLen = beatAt - d.origStart
      const sv     = SNAP_BEATS[s.snap as SnapGrid] || 0
      const len    = sv > 0 ? Math.max(sv, Math.round(rawLen / sv) * sv) : Math.max(0.0625, rawLen)
      store().resizeNote(d.noteId, len)

    } else if (d.type === 'select') {
      d.x1 = px; d.y1 = py

    } else if (d.type === 'draw') {
      const beatAt = pxToBeat(px, s.scrollX, s.zoomX)
      const rawLen = beatAt - d.beat0
      const sv     = SNAP_BEATS[s.snap as SnapGrid] || 0.0625
      const len    = sv > 0
        ? Math.max(sv, Math.ceil(rawLen / sv) * sv)
        : Math.max(0.0625, rawLen)
      store().updateNote(d.noteId, { lengthBeats: len })

    } else if (d.type === 'erase') {
      const hit = hitTest(px, py, s.notes, s.zoomX, s.zoomY, s.scrollX, s.scrollY)
      if (hit) store().removeNote(hit.note.id)
    }

    // Cursor
    const canvas = canvasRef.current
    if (!canvas) return
    if (d.type === 'move')   { canvas.style.cursor = 'grabbing'; return }
    if (d.type === 'resize') { canvas.style.cursor = 'ew-resize'; return }
    const hit = d.type === 'idle'
      ? hitTest(px, py, s.notes, s.zoomX, s.zoomY, s.scrollX, s.scrollY)
      : null
    if (hit?.type === 'resize')      canvas.style.cursor = 'ew-resize'
    else if (hit?.type === 'body')   canvas.style.cursor = s.tool === 'erase' ? 'crosshair' : 'grab'
    else if (s.tool === 'pencil')    canvas.style.cursor = 'crosshair'
    else if (s.tool === 'erase')     canvas.style.cursor = 'crosshair'
    else                             canvas.style.cursor = 'default'
  }, [store])

  // ── Pointer up ──────────────────────────────────────────────────────────
  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = store()
    const d = dragRef.current

    if (d.type === 'move') {
      s.moveSelected(d.dBeat, d.dPitch)
    } else if (d.type === 'select') {
      const beatA  = pxToBeat(Math.min(d.x0, d.x1), s.scrollX, s.zoomX)
      const beatB  = pxToBeat(Math.max(d.x0, d.x1), s.scrollX, s.zoomX)
      const pitchA = pyToPitch(Math.max(d.y0, d.y1), s.scrollY, s.zoomY)
      const pitchB = pyToPitch(Math.min(d.y0, d.y1), s.scrollY, s.zoomY)
      if (Math.abs(d.x1 - d.x0) > 4 || Math.abs(d.y1 - d.y0) > 4) {
        s.selectInRect(beatA, beatB, pitchA, pitchB)
      }
    }

    dragRef.current = { type: 'idle' }
  }, [store])

  // ── Wheel: scroll + zoom ────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const s = store()
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      s.setZoom(s.zoomX * factor, s.zoomY)
    } else if (e.shiftKey) {
      s.setScroll(s.scrollX + e.deltaY * 0.6, s.scrollY)
    } else {
      s.setScroll(s.scrollX, s.scrollY + e.deltaY * 0.6)
    }
  }, [store])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const s = store()
    if (e.key === 'Delete' || e.key === 'Backspace') {
      s.deleteSelected()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault(); s.selectAll()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault(); s.duplicateSelected()
    } else if (e.key === 'ArrowLeft') {
      const sv = SNAP_BEATS[s.snap as SnapGrid] || 0.25
      s.moveSelected(e.shiftKey ? -sv * 4 : -sv, 0)
    } else if (e.key === 'ArrowRight') {
      const sv = SNAP_BEATS[s.snap as SnapGrid] || 0.25
      s.moveSelected(e.shiftKey ? sv * 4 : sv, 0)
    } else if (e.key === 'ArrowUp') {
      s.moveSelected(0, e.shiftKey ? 12 : 1)
    } else if (e.key === 'ArrowDown') {
      s.moveSelected(0, e.shiftKey ? -12 : -1)
    }
  }, [store])

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
      style={{ outline: 'none', cursor: 'default', touchAction: 'none' }}
    />
  )
}
