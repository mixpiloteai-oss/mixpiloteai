import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { SampleEntry } from '../../audio/browser/types'
import { useBrowserStore } from '../../store/browserStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatChannels(ch: number): string {
  return ch === 1 ? 'Mono' : 'Stereo'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WaveformPreviewProps {
  entry: SampleEntry | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WaveformPreview({ entry }: WaveformPreviewProps): React.ReactElement {
  const { previewVolume, setPreviewVolume } = useBrowserStore()

  // ── Audio engine refs (no re-render during playback) ───────────────────────
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const sourceRef    = useRef<AudioBufferSourceNode | null>(null)
  const bufferRef    = useRef<AudioBuffer | null>(null)
  const isPlayingRef = useRef(false)
  const startTimeRef = useRef(0)
  const offsetRef    = useRef(0)

  // ── Canvas refs ────────────────────────────────────────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const entryRef   = useRef<SampleEntry | null>(null)
  entryRef.current = entry

  const progressRef = useRef(0)
  const rafRef      = useRef(0)

  // ── React state (controls UI only) ────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false)

  // Keep volume ref synced
  const volumeRef = useRef(previewVolume)
  useEffect(() => {
    volumeRef.current = previewVolume
  }, [previewVolume])

  // ── Audio engine ───────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    try { sourceRef.current?.stop() } catch { /* already stopped */ }
    sourceRef.current    = null
    isPlayingRef.current = false
    setIsPlaying(false)
  }, [])

  const play = useCallback((offset = 0) => {
    const ctx = audioCtxRef.current
    const buf = bufferRef.current
    if (!ctx || !buf) return
    stop()
    const gain = ctx.createGain()
    gain.gain.value = volumeRef.current
    gain.connect(ctx.destination)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(gain)
    src.start(0, offset)
    src.onended = () => {
      isPlayingRef.current = false
      setIsPlaying(false)
      progressRef.current = 0
    }
    sourceRef.current    = src
    startTimeRef.current = ctx.currentTime
    offsetRef.current    = offset
    isPlayingRef.current = true
    setIsPlaying(true)
  }, [stop])

  const load = useCallback(async (e: SampleEntry) => {
    stop()
    progressRef.current = 0
    if (!e.fileHandle) return
    const ctx = audioCtxRef.current ??
      (audioCtxRef.current = new AudioContext({ latencyHint: 'interactive' }))
    if (ctx.state === 'suspended') await ctx.resume()
    const file            = await e.fileHandle.getFile()
    const ab              = await file.arrayBuffer()
    bufferRef.current     = await ctx.decodeAudioData(ab)
  }, [stop])

  // Load when entry changes
  useEffect(() => {
    if (!entry) {
      stop()
      bufferRef.current   = null
      progressRef.current = 0
      return
    }
    load(entry).catch(() => { /* decode error */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
      cancelAnimationFrame(rafRef.current)
      audioCtxRef.current?.close().catch(() => { /* ignore */ })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return

    const W = canvas.width
    const H = canvas.height
    const dpr = window.devicePixelRatio || 1

    // Background
    ctx2d.fillStyle = '#05050a'
    ctx2d.fillRect(0, 0, W, H)

    const currentEntry = entryRef.current

    if (!currentEntry || !currentEntry.waveformData || currentEntry.waveformData.length === 0) {
      // Center text
      ctx2d.fillStyle = '#374151'
      ctx2d.font      = `${12 * dpr}px sans-serif`
      ctx2d.textAlign = 'center'
      ctx2d.textBaseline = 'middle'
      ctx2d.fillText('Select a sample to preview', W / 2, H / 2)
      return
    }

    const data     = currentEntry.waveformData
    const n        = data.length
    const progress = progressRef.current

    // Draw waveform bars
    for (let i = 0; i < n; i++) {
      const x      = (i / n) * W
      const barW   = Math.max(1, (W / n) - 0.5)
      const amp    = data[i] * H * 0.45
      const y      = (H - amp * 2) / 2
      const played = (i / n) <= progress

      ctx2d.fillStyle = played ? '#7c3aed' : '#1e1e3a'
      ctx2d.fillRect(x, y, barW, amp * 2)
    }

    // Playhead
    const playheadX = progress * W
    ctx2d.strokeStyle = '#ff3060'
    ctx2d.lineWidth   = 1.5
    ctx2d.beginPath()
    ctx2d.moveTo(playheadX, 0)
    ctx2d.lineTo(playheadX, H)
    ctx2d.stroke()

    // Time labels
    const dur = currentEntry.duration
    const labelFontSize = Math.round(10 * dpr)
    ctx2d.fillStyle    = '#4b5563'
    ctx2d.font         = `${labelFontSize}px sans-serif`
    ctx2d.textBaseline = 'bottom'

    ctx2d.textAlign = 'left'
    ctx2d.fillText('0:00', 4, H - 2)

    ctx2d.textAlign = 'right'
    ctx2d.fillText(formatDuration(dur), W - 4, H - 2)
  }, [])

  // RAF loop — single effect, no deps re-subscribe
  useEffect(() => {
    const loop = () => {
      // Update progress from audio time
      const ctx  = audioCtxRef.current
      const buf  = bufferRef.current
      if (isPlayingRef.current && ctx && buf) {
        const elapsed           = ctx.currentTime - startTimeRef.current
        progressRef.current     = Math.min(1, (offsetRef.current + elapsed) / buf.duration)
      }
      drawCanvas()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  // drawCanvas is stable (useCallback with no deps), intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Resize observer for canvas ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const dpr = window.devicePixelRatio || 1
        const { inlineSize, blockSize } = e.contentBoxSize[0]
        canvas.width  = Math.round(inlineSize  * dpr)
        canvas.height = Math.round(blockSize   * dpr)
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── Click-to-seek ──────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect     = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    const clamped  = Math.max(0, Math.min(1, fraction))
    progressRef.current = clamped
    const buf = bufferRef.current
    if (buf) {
      play(buf.duration * clamped)
    }
  }, [play])

  // ── Play/Stop toggle ───────────────────────────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    if (isPlayingRef.current) {
      stop()
    } else {
      play(progressRef.current * (bufferRef.current?.duration ?? 0))
    }
  }, [play, stop])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const containerStyle: CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    background:    '#07070e',
    borderTop:     '1px solid #1e1e3a',
    flexShrink:    0,
    userSelect:    'none',
  }

  const headerStyle: CSSProperties = {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    padding:     '6px 10px',
    borderBottom: '1px solid #1a1a2e',
    minHeight:   40,
    flexShrink:  0,
    overflowX:   'hidden',
  }

  const playBtnStyle: CSSProperties = {
    width:          28,
    height:         28,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     isPlaying ? 'rgba(124,58,237,0.25)' : '#1e1e3a',
    border:         `1px solid ${isPlaying ? '#7c3aed' : '#2d2d4e'}`,
    borderRadius:   4,
    cursor:         entry ? 'pointer' : 'default',
    color:          isPlaying ? '#a78bfa' : '#6b7280',
    fontSize:       12,
    flexShrink:     0,
    padding:        0,
  }

  const metaStyle: CSSProperties = {
    flex:         1,
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    overflow:     'hidden',
    minWidth:     0,
  }

  const nameStyle: CSSProperties = {
    fontWeight:   600,
    fontSize:     12,
    color:        '#e2e8f0',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap',
    flexShrink:   1,
  }

  const chipStyle: CSSProperties = {
    fontSize:     10,
    color:        '#94a3b8',
    background:   '#1a1a2e',
    border:       '1px solid #2d2d4e',
    borderRadius: 4,
    padding:      '1px 5px',
    flexShrink:   0,
    whiteSpace:   'nowrap',
  }

  const volContainerStyle: CSSProperties = {
    display:    'flex',
    alignItems: 'center',
    gap:        5,
    flexShrink: 0,
  }

  const sliderStyle: CSSProperties = {
    width:  72,
    cursor: 'pointer',
    accentColor: '#7c3aed',
  }

  const canvasStyle: CSSProperties = {
    flex:        1,
    display:     'block',
    cursor:      'crosshair',
    minHeight:   80,
    width:       '100%',
  }

  const canvasWrapStyle: CSSProperties = {
    flex:     1,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 80,
  }

  return (
    <div style={containerStyle}>
      {/* ── Header ── */}
      <div style={headerStyle}>
        {/* Play/Stop */}
        <button
          style={playBtnStyle}
          onClick={handlePlayToggle}
          disabled={!entry}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '⏹' : '▶'}
        </button>

        {/* File info */}
        <div style={metaStyle}>
          {entry ? (
            <>
              <span style={nameStyle}>{entry.name}{entry.ext}</span>

              {entry.analyzed && (
                <>
                  {entry.bpm !== null && (
                    <span style={chipStyle}>BPM: {entry.bpm.toFixed(0)}</span>
                  )}
                  {entry.key !== null && (
                    <span style={chipStyle}>{entry.key}</span>
                  )}
                </>
              )}

              <span style={chipStyle}>{formatDuration(entry.duration)}</span>
              <span style={chipStyle}>{formatSize(entry.size)}</span>
              <span style={chipStyle}>{formatChannels(entry.channels)}</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#374151' }}>No sample selected</span>
          )}
        </div>

        {/* Volume slider */}
        <div style={volContainerStyle}>
          <span style={{ fontSize: 10, color: '#4b5563', flexShrink: 0 }}>Vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={previewVolume}
            onChange={e => setPreviewVolume(parseFloat(e.target.value))}
            style={sliderStyle}
            title={`Volume: ${Math.round(previewVolume * 100)}%`}
          />
        </div>
      </div>

      {/* ── Waveform Canvas ── */}
      <div style={canvasWrapStyle}>
        <canvas
          ref={canvasRef}
          style={canvasStyle}
          onPointerDown={handlePointerDown}
        />
      </div>
    </div>
  )
}
