import {
  useRef,
  useState,
  useEffect,
  useCallback,
  memo,
  type KeyboardEvent,
  type DragEvent,
  type CSSProperties,
} from 'react'
import type { SampleEntry } from '../../audio/browser/types'
import { useBrowserStore } from '../../store/browserStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROW_H    = 32
const OVERSCAN = 5

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m  = Math.floor(seconds / 60)
  const s  = seconds % 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

function formatExt(ext: string): string {
  return ext.replace('.', '').toUpperCase()
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface SampleListProps {
  samples: SampleEntry[]
}

// ─── Row component (memoized separately to avoid re-rendering the whole list) ─

interface RowProps {
  entry:       SampleEntry
  isSelected:  boolean
  isPreviewing: boolean
  isOdd:       boolean
  onSingleClick: (entry: SampleEntry) => void
  onDoubleClick: (entry: SampleEntry) => void
  onPlayToggle:  (entry: SampleEntry) => void
  onFavToggle:   (entry: SampleEntry) => void
  onDragStart:   (e: DragEvent<HTMLDivElement>, id: string) => void
}

const SampleRow = memo(function SampleRow({
  entry,
  isSelected,
  isPreviewing,
  isOdd,
  onSingleClick,
  onDoubleClick,
  onPlayToggle,
  onFavToggle,
  onDragStart,
}: RowProps): React.ReactElement {
  const [hovered, setHovered] = useState(false)

  const baseBg: string = (() => {
    if (isPreviewing) return 'rgba(6,182,212,0.12)'
    if (isSelected)   return 'rgba(124,58,237,0.18)'
    if (hovered)      return 'rgba(255,255,255,0.04)'
    return isOdd ? 'rgba(255,255,255,0.01)' : '#08080f'
  })()

  const rowStyle: CSSProperties = {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          ROW_H,
    display:         'flex',
    alignItems:      'center',
    paddingLeft:     4,
    paddingRight:    6,
    gap:             4,
    boxSizing:       'border-box',
    background:      baseBg,
    borderLeft:      isSelected ? '2px solid #7c3aed' : '2px solid transparent',
    cursor:          'pointer',
    userSelect:      'none',
  }

  const iconBtnStyle: CSSProperties = {
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding:    0,
    flexShrink: 0,
    color:      '#94a3b8',
    lineHeight: 1,
  }

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => onDragStart(e, entry.id),
    [onDragStart, entry.id],
  )

  const pathParts = entry.path.split('/')
  const displayPath = pathParts.length > 1
    ? pathParts.slice(0, -1).join('/')
    : ''

  return (
    <div
      style={rowStyle}
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSingleClick(entry)}
      onDoubleClick={() => onDoubleClick(entry)}
    >
      {/* Play/Stop button — 28px */}
      <button
        style={{ ...iconBtnStyle, width: 28, color: isPreviewing ? '#06b6d4' : '#94a3b8' }}
        onClick={(e) => { e.stopPropagation(); onPlayToggle(entry) }}
        title={isPreviewing ? 'Stop preview' : 'Preview'}
      >
        {isPreviewing ? '⏹' : '▶'}
      </button>

      {/* Favorite star — 24px */}
      <button
        style={{ ...iconBtnStyle, width: 24, color: entry.favorite ? '#f59e0b' : '#374151', fontSize: 13 }}
        onClick={(e) => { e.stopPropagation(); onFavToggle(entry) }}
        title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        ★
      </button>

      {/* Name + path — flex 1 */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
        <span style={{
          fontSize:     12,
          fontWeight:   600,
          color:        isSelected ? '#c4b5fd' : '#e2e8f0',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {entry.name}{entry.ext}
        </span>
        {displayPath && (
          <span style={{
            fontSize:     9,
            color:        '#4b5563',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {displayPath}
          </span>
        )}
      </div>

      {/* BPM — 44px right-aligned */}
      <span style={{ width: 44, textAlign: 'right', fontSize: 11, color: entry.bpm ? '#a78bfa' : '#374151', flexShrink: 0 }}>
        {entry.bpm ? entry.bpm.toFixed(0) : '—'}
      </span>

      {/* Key — 64px */}
      <span style={{ width: 64, textAlign: 'center', fontSize: 10, color: entry.key ? '#34d399' : '#374151', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.key ?? '—'}
      </span>

      {/* Duration — 48px */}
      <span style={{ width: 48, textAlign: 'right', fontSize: 10, color: '#6b7280', flexShrink: 0 }}>
        {entry.duration > 0 ? formatDuration(entry.duration) : '—'}
      </span>

      {/* Ext badge — 36px */}
      <span style={{
        width:          36,
        textAlign:      'center',
        fontSize:       9,
        fontWeight:     700,
        color:          '#1e1e3a',
        background:     '#7c3aed',
        borderRadius:   3,
        padding:        '1px 3px',
        flexShrink:     0,
        overflow:       'hidden',
        textOverflow:   'ellipsis',
        whiteSpace:     'nowrap',
      }}>
        {formatExt(entry.ext)}
      </span>

      {/* Not-analyzed dot */}
      {!entry.analyzed && (
        <span style={{
          width:        6,
          height:       6,
          borderRadius: '50%',
          background:   '#f97316',
          flexShrink:   0,
          marginLeft:   2,
        }} />
      )}
    </div>
  )
})

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SampleList({ samples }: SampleListProps): React.ReactElement {
  const {
    selectedId,
    previewingId,
    previewVolume,
    autoPreview,
    setSelected,
    setPreviewing,
    toggleFavorite,
  } = useBrowserStore()

  // ── Virtualisation state ────────────────────────────────────────────────────
  const containerRef  = useRef<HTMLDivElement>(null)
  const [scrollTop,   setScrollTop]   = useState(0)
  const [containerH,  setContainerH]  = useState(400)

  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const visibleEnd   = Math.min(samples.length, Math.ceil((scrollTop + containerH) / ROW_H) + OVERSCAN)
  const visibleItems = samples.slice(visibleStart, visibleEnd)
  const offsetY      = visibleStart * ROW_H
  const totalH       = samples.length * ROW_H

  // ── Resize observer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerH(entry.contentBoxSize[0].blockSize)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Audio preview engine ────────────────────────────────────────────────────
  const audioCtxRef       = useRef<AudioContext | null>(null)
  const sourceRef         = useRef<AudioBufferSourceNode | null>(null)
  const gainRef           = useRef<GainNode | null>(null)
  const previewVolumeRef  = useRef(previewVolume)

  // Keep volume ref in sync with store
  useEffect(() => {
    previewVolumeRef.current = previewVolume
    if (gainRef.current) gainRef.current.gain.value = previewVolume
  }, [previewVolume])

  const stopPreview = useCallback(() => {
    try { sourceRef.current?.stop() } catch { /* already stopped */ }
    sourceRef.current = null
  }, [])

  const startPreview = useCallback(async (entry: SampleEntry) => {
    stopPreview()
    if (!entry.fileHandle) return
    const ctx = audioCtxRef.current ?? (audioCtxRef.current = new AudioContext({ latencyHint: 'interactive' }))
    if (ctx.state === 'suspended') await ctx.resume()
    const file   = await entry.fileHandle.getFile()
    const ab     = await file.arrayBuffer()
    const buffer = await ctx.decodeAudioData(ab)
    const gain   = gainRef.current ?? (gainRef.current = ctx.createGain())
    gain.gain.value = previewVolumeRef.current
    gain.connect(ctx.destination)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(gain)
    source.start()
    source.onended = () => { setPreviewing(null) }
    sourceRef.current = source
  }, [stopPreview, setPreviewing])

  // Monitor previewingId changes to start/stop audio
  useEffect(() => {
    if (previewingId === null) {
      stopPreview()
    } else {
      const entry = samples.find(s => s.id === previewingId)
      if (entry) {
        startPreview(entry).catch(() => { /* decode error */ })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewingId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview()
      audioCtxRef.current?.close().catch(() => { /* ignore */ })
    }
  }, [stopPreview])

  // ── Row interaction handlers ────────────────────────────────────────────────

  const handleSingleClick = useCallback((entry: SampleEntry) => {
    setSelected(entry.id)
    if (autoPreview && previewingId !== entry.id) {
      setPreviewing(entry.id)
    }
  }, [setSelected, autoPreview, previewingId, setPreviewing])

  const handleDoubleClick = useCallback((entry: SampleEntry) => {
    if (previewingId === entry.id) {
      setPreviewing(null)
    } else {
      setPreviewing(entry.id)
    }
  }, [previewingId, setPreviewing])

  const handlePlayToggle = useCallback((entry: SampleEntry) => {
    if (previewingId === entry.id) {
      setPreviewing(null)
    } else {
      setPreviewing(entry.id)
    }
  }, [previewingId, setPreviewing])

  const handleFavToggle = useCallback((entry: SampleEntry) => {
    toggleFavorite(entry.id)
  }, [toggleFavorite])

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('application/x-sample-id', id)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const currentIdx = selectedId ? samples.findIndex(s => s.id === selectedId) : -1

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const next = Math.min(samples.length - 1, currentIdx + 1)
        if (samples[next]) setSelected(samples[next].id)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prev = Math.max(0, currentIdx - 1)
        if (samples[prev]) setSelected(samples[prev].id)
        break
      }
      case ' ': {
        e.preventDefault()
        if (selectedId) {
          if (previewingId === selectedId) {
            setPreviewing(null)
          } else {
            setPreviewing(selectedId)
          }
        }
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (selectedId && previewingId !== selectedId) {
          setPreviewing(selectedId)
        }
        break
      }
      case 'c': {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          if (selectedId) {
            const entry = samples.find(s => s.id === selectedId)
            if (entry) {
              navigator.clipboard.writeText(`${entry.name}${entry.ext}`).catch(() => { /* ignore */ })
            }
          }
        }
        break
      }
      default:
        break
    }
  }, [selectedId, samples, previewingId, setSelected, setPreviewing])

  // ── Scroll into view for keyboard navigation ────────────────────────────────
  useEffect(() => {
    if (!selectedId || !containerRef.current) return
    const idx = samples.findIndex(s => s.id === selectedId)
    if (idx < 0) return
    const rowTop    = idx * ROW_H
    const rowBottom = rowTop + ROW_H
    const el        = containerRef.current
    if (rowTop < el.scrollTop) {
      el.scrollTop = rowTop
    } else if (rowBottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = rowBottom - el.clientHeight
    }
  }, [selectedId, samples])

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (samples.length === 0) {
    return (
      <div style={{
        flex:           1,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            16,
        color:          '#4b5563',
        background:     '#08080f',
        userSelect:     'none',
      }}>
        <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Drop a folder or click</div>
          <div style={{ fontSize: 13, color: '#4b5563' }}>"+ Add folder" to get started</div>
        </div>
        <button style={{
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          padding:      '6px 14px',
          background:   '#1e1e3a',
          border:       '1px solid #2d2d4e',
          borderRadius: 6,
          color:        '#a78bfa',
          fontSize:     13,
          cursor:       'pointer',
        }}>
          + Add folder
        </button>
      </div>
    )
  }

  // ── Virtualized list ────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      onKeyDown={handleKeyDown}
      style={{
        flex:         1,
        overflowY:    'auto',
        overflowX:    'hidden',
        position:     'relative',
        background:   '#08080f',
        outline:      'none',
        // Custom scrollbar
        scrollbarWidth: 'thin',
        scrollbarColor: '#1e1e3a #08080f',
      }}
    >
      {/* Total height spacer */}
      <div style={{ height: totalH, position: 'relative' }}>
        {/* Visible rows only */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((entry, localIdx) => {
            const globalIdx = visibleStart + localIdx
            return (
              <div key={entry.id} style={{ position: 'relative', height: ROW_H }}>
                <SampleRow
                  entry={entry}
                  isSelected={entry.id === selectedId}
                  isPreviewing={entry.id === previewingId}
                  isOdd={globalIdx % 2 === 1}
                  onSingleClick={handleSingleClick}
                  onDoubleClick={handleDoubleClick}
                  onPlayToggle={handlePlayToggle}
                  onFavToggle={handleFavToggle}
                  onDragStart={handleDragStart}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
