import React, { useRef, useCallback } from 'react'

// ─── Inline types ─────────────────────────────────────────────────────────────

interface TrackInfo {
  id:      string
  name:    string
  color:   string
  gainDb:  number
  muted:   boolean
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrackHeaderProps {
  track:          TrackInfo
  width:          number   // column width in px
  onSetGain:      (gainDb: number) => void
  onToggleMute:   () => void
}

// ─── Gain helpers (matches ChannelStrip convention) ───────────────────────────

const MIN_DB    = -60
const MAX_DB    = 6
const UNITY_POS = 0.78

function gainDbToPos(db: number): number {
  if (!isFinite(db) || db <= MIN_DB) return 0
  if (db >= 0) return UNITY_POS + (db / MAX_DB) * (1 - UNITY_POS)
  const t = Math.pow(10, db / 40)
  return t * UNITY_POS
}

function posToGainDb(pos: number): number {
  if (pos < 0.001) return -Infinity
  if (pos >= UNITY_POS) return (pos - UNITY_POS) / (1 - UNITY_POS) * MAX_DB
  const t = pos / UNITY_POS
  return 40 * Math.log10(t)
}

// ─── TrackHeader ──────────────────────────────────────────────────────────────

export function TrackHeader({
  track,
  width,
  onSetGain,
  onToggleMute,
}: TrackHeaderProps): React.JSX.Element {
  const sliderRef = useRef<HTMLDivElement>(null)
  const dragging  = useRef(false)

  const sliderWidth = width - 28   // leave room for mute button
  const pos         = gainDbToPos(track.gainDb)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true

    const onMove = (me: MouseEvent): void => {
      if (!dragging.current || !sliderRef.current) return
      const rect   = sliderRef.current.getBoundingClientRect()
      const rawPos = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width))
      onSetGain(posToGainDb(rawPos))
    }

    const onUp = (): void => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [onSetGain])

  const gainLabel = isFinite(track.gainDb)
    ? `${track.gainDb >= 0 ? '+' : ''}${track.gainDb.toFixed(1)} dB`
    : '-∞ dB'

  return (
    <div
      style={{
        width:          width,
        height:         80,
        display:        'flex',
        flexDirection:  'column',
        background:     '#0d0d1a',
        borderRight:    '1px solid #15152a',
        borderBottom:   '1px solid #15152a',
        flexShrink:     0,
        overflow:       'hidden',
        position:       'relative',
      }}
    >
      {/* Colored top bar */}
      <div
        style={{
          height:     3,
          background: track.color,
          flexShrink: 0,
        }}
      />

      {/* Track name */}
      <div
        style={{
          padding:      '4px 6px 2px',
          fontSize:     9,
          fontWeight:   600,
          color:        '#e2e8f0',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          letterSpacing: '0.04em',
          flex:         1,
        }}
        title={track.name}
      >
        {track.name}
      </div>

      {/* Gain + Mute row */}
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        4,
          padding:    '0 6px 6px',
        }}
      >
        {/* Horizontal gain slider */}
        <div
          ref={sliderRef}
          onMouseDown={handleMouseDown}
          title={gainLabel}
          style={{
            flex:         1,
            height:       12,
            borderRadius: 2,
            background:   'rgba(255,255,255,0.06)',
            position:     'relative',
            cursor:       'ew-resize',
            overflow:     'hidden',
          }}
        >
          {/* Fill */}
          <div
            style={{
              position:     'absolute',
              left:         0,
              top:          0,
              height:       '100%',
              width:        `${pos * 100}%`,
              background:   `${track.color}80`,
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
          {/* Unity mark */}
          <div
            style={{
              position:   'absolute',
              left:       `${UNITY_POS * 100}%`,
              top:        0,
              width:      1,
              height:     '100%',
              background: 'rgba(255,255,255,0.20)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Mute button */}
        <button
          onClick={onToggleMute}
          title={track.muted ? 'Unmute' : 'Mute'}
          style={{
            width:      18,
            height:     14,
            borderRadius: 3,
            fontSize:   8,
            fontWeight: 700,
            cursor:     'pointer',
            transition: 'all 0.1s',
            border:     `1px solid ${track.muted ? 'rgba(250,204,21,0.50)' : 'rgba(255,255,255,0.06)'}`,
            background: track.muted ? 'rgba(250,204,21,0.18)' : 'rgba(255,255,255,0.04)',
            color:      track.muted ? '#facc15' : '#334155',
            flexShrink: 0,
            padding:    0,
          }}
        >
          M
        </button>
      </div>
    </div>
  )
}
