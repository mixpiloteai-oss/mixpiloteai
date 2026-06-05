import React, { useEffect, useId } from 'react'

// ─── Inline types ─────────────────────────────────────────────────────────────

type ClipState      = 'empty' | 'stopped' | 'queued' | 'playing' | 'recording'
type ClipLaunchMode = 'trigger' | 'gate' | 'toggle' | 'repeat'
type FollowAction   = 'none' | 'stop' | 'again' | 'next' | 'prev' | 'first' | 'last' | 'any'

interface ClipInfo {
  id:           string
  name:         string
  color:        string
  state:        ClipState
  launchMode:   ClipLaunchMode
  followAction: FollowAction
  looping:      boolean
  type:         'midi' | 'audio' | 'empty'
  noteCount?:   number
  progress:     number   // 0..1
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClipCellProps {
  clip?:         ClipInfo
  sceneId:       string
  trackId:       string
  width:         number
  height:        number
  isSelected:    boolean
  onClick:       () => void
  onRightClick:  (e: React.MouseEvent) => void
  onDoubleClick: () => void
}

// ─── CSS injection helper (idempotent) ────────────────────────────────────────

const injectedStyles = new Set<string>()

function injectStyle(id: string, css: string): void {
  if (injectedStyles.has(id)) return
  injectedStyles.add(id)
  const el = document.createElement('style')
  el.id   = `clipcell-style-${id}`
  el.textContent = css
  document.head.appendChild(el)
}

// Inject keyframes once
injectStyle('queued-pulse', `
  @keyframes clipcell-queued-pulse {
    0%, 100% { opacity: 1; border-color: rgba(251,146,60,0.80); }
    50%       { opacity: 0.5; border-color: rgba(251,146,60,0.25); }
  }
`)

injectStyle('recording-pulse', `
  @keyframes clipcell-recording-dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.25; }
  }
`)

// ─── Note density bars (decorative MIDI indicator) ────────────────────────────

function NoteDensityBars({ count }: { count: number }): React.JSX.Element {
  // 4 bars, heights vary pseudo-randomly based on noteCount
  const bars = [0, 1, 2, 3].map(i => {
    const h = 30 + ((count * 7 + i * 13) % 55)
    return h
  })

  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'flex-end',
        gap:        1,
        height:     14,
        marginTop:  2,
      }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width:        2,
            height:       `${h}%`,
            borderRadius: 1,
            background:   'rgba(168,85,247,0.45)',
            flexShrink:   0,
          }}
        />
      ))}
    </div>
  )
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type, color }: { type: 'midi' | 'audio' | 'empty'; color: string }): React.JSX.Element {
  const label = type === 'midi' ? 'MIDI' : 'WAV'
  return (
    <div
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        padding:      '0px 3px',
        borderRadius: 2,
        fontSize:     7,
        fontWeight:   700,
        letterSpacing: '0.05em',
        background:   `${color}30`,
        color:        `${color}cc`,
        border:       `1px solid ${color}40`,
        lineHeight:   1.5,
        flexShrink:   0,
      }}
    >
      {label}
    </div>
  )
}

// ─── ClipCell ─────────────────────────────────────────────────────────────────

export function ClipCell({
  clip,
  sceneId: _sceneId,
  trackId: _trackId,
  width,
  height,
  isSelected,
  onClick,
  onRightClick,
  onDoubleClick,
}: ClipCellProps): React.JSX.Element {
  const uid = useId().replace(/:/g, '')

  // Per-instance queued animation class
  useEffect(() => {
    injectStyle(`queued-${uid}`, `
      .clipcell-queued-${uid} {
        animation: clipcell-queued-pulse 0.6s ease-in-out infinite;
      }
    `)
  }, [uid])

  // ── Empty slot ──────────────────────────────────────────────────────────────
  if (!clip || clip.type === 'empty') {
    return (
      <div
        onClick={onClick}
        onContextMenu={onRightClick}
        style={{
          width,
          height,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     isSelected ? 'rgba(30,58,95,0.25)' : '#0d0d1a',
          border:         `1px dashed ${isSelected ? '#2563eb' : '#1e3a5f'}`,
          boxSizing:      'border-box',
          cursor:         'pointer',
          color:          '#1e3a5f',
          fontSize:       16,
          fontWeight:     300,
          transition:     'background 0.1s, border-color 0.1s',
          userSelect:     'none',
        }}
      >
        +
      </div>
    )
  }

  // ── Determine border style based on state ──────────────────────────────────

  type BorderSpec = { color: string; style: string; width: number }

  const borderSpec: BorderSpec = ((): BorderSpec => {
    switch (clip.state) {
      case 'playing':
        return { color: clip.color,  style: 'solid', width: 2 }
      case 'stopped':
        return { color: `${clip.color}99`, style: 'solid', width: 1 }
      case 'queued':
        return { color: 'rgba(251,146,60,0.80)', style: 'solid', width: 2 }
      case 'recording':
        return { color: '#ef4444',  style: 'solid', width: 2 }
      default:
        return { color: '#15152a',  style: 'solid', width: 1 }
    }
  })()

  const isQueued    = clip.state === 'queued'
  const isRecording = clip.state === 'recording'
  const isPlaying   = clip.state === 'playing'

  return (
    <div
      onClick={onClick}
      onContextMenu={onRightClick}
      onDoubleClick={onDoubleClick}
      className={isQueued ? `clipcell-queued-${uid}` : undefined}
      style={{
        width,
        height,
        display:       'flex',
        flexDirection: 'column',
        background:    isPlaying
          ? `linear-gradient(135deg, ${clip.color}18 0%, #0d0d1a 100%)`
          : isRecording
          ? 'rgba(239,68,68,0.08)'
          : '#0d0d1a',
        border:        `${borderSpec.width}px ${borderSpec.style} ${borderSpec.color}`,
        boxSizing:     'border-box',
        cursor:        'pointer',
        position:      'relative',
        overflow:      'hidden',
        userSelect:    'none',
        outline:       isSelected ? '1px solid rgba(96,165,250,0.50)' : 'none',
        outlineOffset: '-1px',
      }}
    >
      {/* ── Header row: type badge + recording dot ─────────────────────────── */}
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          padding:    '4px 4px 0',
          gap:        3,
        }}
      >
        <TypeBadge type={clip.type} color={clip.color} />

        {/* Recording pulsing dot */}
        {isRecording && (
          <div
            style={{
              width:        5,
              height:       5,
              borderRadius: '50%',
              background:   '#ef4444',
              animation:    'clipcell-recording-dot 0.8s ease-in-out infinite',
              marginLeft:   'auto',
              flexShrink:   0,
            }}
          />
        )}
      </div>

      {/* ── Clip name ────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding:      '3px 4px 0',
          fontSize:     10,
          fontWeight:   600,
          color:        '#e2e8f0',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          letterSpacing: '0.02em',
          flex:         1,
        }}
        title={clip.name}
      >
        {clip.name}
      </div>

      {/* ── MIDI note density bars ─────────────────────────────────────────── */}
      {clip.type === 'midi' && (
        <div style={{ padding: '0 4px' }}>
          <NoteDensityBars count={clip.noteCount ?? 16} />
        </div>
      )}

      {/* ── Footer: loop icon ─────────────────────────────────────────────── */}
      {clip.looping && (
        <div
          style={{
            position:  'absolute',
            bottom:    6,
            right:     4,
            fontSize:  9,
            color:     `${clip.color}cc`,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ∞
        </div>
      )}

      {/* ── Progress bar (bottom, no CSS transition — 60fps external update) ─ */}
      <div
        style={{
          position:   'absolute',
          bottom:     0,
          left:       0,
          right:      0,
          height:     3,
          background: 'rgba(255,255,255,0.06)',
          overflow:   'hidden',
        }}
      >
        <div
          style={{
            height:     '100%',
            width:      `${Math.max(0, Math.min(1, clip.progress)) * 100}%`,
            background: isRecording ? '#ef4444' : clip.color,
            // No transition — progress is updated at 60fps externally
          }}
        />
      </div>
    </div>
  )
}
