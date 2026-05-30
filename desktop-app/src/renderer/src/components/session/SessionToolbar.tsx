import React from 'react'

// ─── Inline types ─────────────────────────────────────────────────────────────

type Quantization = 'none' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1' | '2' | '4'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SessionToolbarProps {
  bpm:                number
  globalQuantization: Quantization
  sceneCount:         number
  onSetQuantization:  (q: Quantization) => void
  onStopAll:          () => void
  onAddScene:         () => void
}

// ─── Quantization chip values ─────────────────────────────────────────────────

const QUANT_VALUES: Quantization[] = ['none', '1/32', '1/16', '1/8', '1/4', '1/2', '1', '2', '4']
const QUANT_LABELS: Record<Quantization, string> = {
  'none': 'None',
  '1/32': '1/32',
  '1/16': '1/16',
  '1/8':  '1/8',
  '1/4':  '1/4',
  '1/2':  '1/2',
  '1':    '1',
  '2':    '2',
  '4':    '4',
}

// ─── SessionToolbar ───────────────────────────────────────────────────────────

export function SessionToolbar({
  bpm,
  globalQuantization,
  sceneCount,
  onSetQuantization,
  onStopAll,
  onAddScene,
}: SessionToolbarProps): React.JSX.Element {
  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '0 12px',
        height:       36,
        flexShrink:   0,
        background:   '#0b0b14',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflow:     'hidden',
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.12em',
          color:         '#2d2d42',
          textTransform: 'uppercase',
          fontFamily:    'monospace',
          marginRight:   4,
          flexShrink:    0,
        }}
      >
        Session
      </span>

      {/* BPM display */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          3,
          padding:      '2px 8px',
          borderRadius: 4,
          background:   'rgba(255,255,255,0.04)',
          border:       '1px solid rgba(255,255,255,0.06)',
          flexShrink:   0,
        }}
      >
        <span style={{ fontSize: 10, color: '#475569' }}>♩</span>
        <span
          style={{
            fontSize:   10,
            fontWeight: 700,
            color:      '#94a3b8',
            fontFamily: 'monospace',
          }}
        >
          {bpm} BPM
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

      {/* Quantization chips */}
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        2,
          flexShrink: 0,
        }}
      >
        {QUANT_VALUES.map(q => {
          const isActive = globalQuantization === q
          return (
            <button
              key={q}
              onClick={() => onSetQuantization(q)}
              style={{
                padding:      '2px 5px',
                borderRadius: 3,
                fontSize:     9,
                fontWeight:   isActive ? 700 : 400,
                cursor:       'pointer',
                background:   isActive ? 'rgba(124,58,237,0.22)' : 'transparent',
                color:        isActive ? '#a855f7' : '#475569',
                border:       `1px solid ${isActive ? 'rgba(124,58,237,0.40)' : 'transparent'}`,
                transition:   'all 0.12s',
                lineHeight:   1,
              }}
            >
              {QUANT_LABELS[q]}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Scene count badge */}
      <span
        style={{
          fontSize:      9,
          color:         '#2d2d42',
          fontFamily:    'monospace',
          marginRight:   4,
          flexShrink:    0,
        }}
      >
        {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
      </span>

      {/* Add Scene button */}
      <button
        onClick={onAddScene}
        title="Add scene"
        style={{
          width:        24,
          height:       20,
          borderRadius: 4,
          fontSize:     14,
          fontWeight:   400,
          cursor:       'pointer',
          background:   'rgba(255,255,255,0.04)',
          color:        '#475569',
          border:       '1px solid rgba(255,255,255,0.06)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          lineHeight:   1,
          flexShrink:   0,
          padding:      0,
          transition:   'all 0.12s',
        }}
      >
        +
      </button>

      {/* Stop All button */}
      <button
        onClick={onStopAll}
        title="Stop all clips"
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          4,
          padding:      '2px 8px',
          borderRadius: 4,
          fontSize:     9,
          fontWeight:   700,
          cursor:       'pointer',
          background:   'rgba(239,68,68,0.12)',
          color:        '#ef4444',
          border:       '1px solid rgba(239,68,68,0.25)',
          flexShrink:   0,
          transition:   'all 0.12s',
          lineHeight:   1,
        }}
      >
        <span style={{ fontSize: 10 }}>■</span>
        Stop All
      </button>
    </div>
  )
}
