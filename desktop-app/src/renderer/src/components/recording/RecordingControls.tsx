// ─── RecordingControls.tsx ────────────────────────────────────────────────────
// Global recording transport and settings toolbar. Props-driven, no store import.

import React from 'react'

export interface RecordingControlsProps {
  isRecording:    boolean
  armedCount:     number          // number of armed tracks
  recordFormat:   'wav' | 'flac'
  recordBitDepth: 16 | 24 | 32
  punchIn:        number | null
  punchOut:       number | null
  loopRecording:  boolean
  elapsedSeconds: number          // recording time elapsed (updated externally)
  diskSpaceGB:    number          // available disk space (0 = unknown)
  onRecord:       () => void      // start recording all armed tracks
  onStop:         () => void      // stop recording
  onSetFormat:    (fmt: 'wav' | 'flac') => void
  onSetBitDepth:  (depth: 16 | 24 | 32) => void
  onSetPunchIn:   (s: number | null) => void
  onSetPunchOut:  (s: number | null) => void
  onToggleLoop:   () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatElapsed = (seconds: number): string => {
  const mm   = Math.floor(seconds / 60)
  const ss   = Math.floor(seconds % 60).toString().padStart(2, '0')
  const dec  = Math.floor((seconds % 1) * 10)
  return `${mm}:${ss}.${dec}`
}

// ── Sub-component styles ───────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  border:       'none',
  borderRadius:  3,
  cursor:       'pointer',
  fontFamily:   'monospace',
  fontSize:      10,
  padding:      '3px 8px',
  lineHeight:   '16px',
  transition:   'background 0.1s, box-shadow 0.1s',
}

const chipActive = (color: string): React.CSSProperties => ({
  ...btnBase,
  background: '#1e3a5f',
  color,
  outline:    `1px solid ${color}`,
})

const chipInactive: React.CSSProperties = {
  ...btnBase,
  background: '#0d0d1a',
  color:      '#475569',
  outline:    '1px solid #15152a',
}

const separator: React.CSSProperties = {
  width:       1,
  alignSelf:   'stretch',
  background:  '#15152a',
  margin:      '0 4px',
}

const labelStyle: React.CSSProperties = {
  color:      '#475569',
  fontSize:    9,
  fontFamily: 'monospace',
}

// ── Disk space indicator ───────────────────────────────────────────────────────

const DiskSpaceIndicator: React.FC<{ gb: number }> = ({ gb }) => {
  if (gb <= 0) return null

  const color =
    gb < 0.1  ? '#ef4444' :
    gb < 1.0  ? '#eab308' :
    '#475569'

  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontSize:    10,
        color,
        whiteSpace: 'nowrap',
      }}
      title="Available disk space"
    >
      {gb.toFixed(1)} GB free
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  armedCount,
  recordFormat,
  recordBitDepth,
  punchIn,
  punchOut,
  loopRecording,
  elapsedSeconds,
  diskSpaceGB,
  onRecord,
  onStop,
  onSetFormat,
  onSetBitDepth,
  onSetPunchIn,
  onSetPunchOut,
  onToggleLoop,
}) => {
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'row',
        alignItems:     'center',
        gap:             6,
        background:     '#0d0d1a',
        borderBottom:   '1px solid #15152a',
        padding:        '5px 10px',
        fontFamily:     'monospace',
        fontSize:        10,
        color:          '#e2e8f0',
        flexWrap:       'wrap',
        minWidth:        500,
        userSelect:     'none',
      }}
    >
      {/* ── Record button ── */}
      <button
        onClick={isRecording ? undefined : onRecord}
        disabled={isRecording ? false : armedCount === 0}
        title={isRecording ? 'Recording…' : armedCount === 0 ? 'Arm at least one track' : 'Start recording'}
        style={{
          ...btnBase,
          width:        28,
          height:       28,
          padding:       0,
          borderRadius: '50%',
          background:   isRecording ? '#ef4444' : armedCount > 0 ? '#7f1d1d' : '#1a0a0a',
          outline:      isRecording ? '2px solid #ef4444' : armedCount > 0 ? '1px solid #ef4444' : '1px solid #2a0a0a',
          boxShadow:    isRecording ? '0 0 10px #ef4444cc' : 'none',
          animation:    isRecording ? 'recordPulse 1s ease-in-out infinite' : 'none',
          cursor:       armedCount === 0 && !isRecording ? 'not-allowed' : 'pointer',
          flexShrink:    0,
        }}
        aria-label="Record"
      >
        <span
          style={{
            display:     'block',
            width:        12,
            height:       12,
            borderRadius: '50%',
            background:  '#ef4444',
            margin:      'auto',
          }}
        />
      </button>

      {/* ── Stop button ── */}
      <button
        onClick={onStop}
        disabled={!isRecording}
        title="Stop recording"
        style={{
          ...btnBase,
          width:      28,
          height:     28,
          padding:     0,
          background: isRecording ? '#0f172a' : '#08080f',
          color:      isRecording ? '#e2e8f0' : '#334155',
          outline:    isRecording ? '1px solid #1e3a5f' : '1px solid #15152a',
          cursor:     isRecording ? 'pointer' : 'not-allowed',
          flexShrink:  0,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Stop"
      >
        <span
          style={{
            display:     'block',
            width:        10,
            height:       10,
            background:  isRecording ? '#e2e8f0' : '#334155',
            borderRadius: 1,
          }}
        />
      </button>

      {/* ── Elapsed time ── */}
      <span
        style={{
          fontFamily:  'monospace',
          fontSize:     13,
          color:       isRecording ? '#ef4444' : '#475569',
          minWidth:     60,
          letterSpacing: 1,
        }}
        title="Elapsed recording time"
      >
        {formatElapsed(elapsedSeconds)}
      </span>

      <div style={separator} />

      {/* ── Format chips ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        <span style={labelStyle}>Format</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['wav', 'flac'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => onSetFormat(fmt)}
              style={recordFormat === fmt ? chipActive('#06b6d4') : chipInactive}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bit depth chips ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        <span style={labelStyle}>Bit depth</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {([16, 24, 32] as const).map(depth => (
            <button
              key={depth}
              onClick={() => onSetBitDepth(depth)}
              style={recordBitDepth === depth ? chipActive('#06b6d4') : chipInactive}
            >
              {depth}
            </button>
          ))}
        </div>
      </div>

      <div style={separator} />

      {/* ── Punch In / Out ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={labelStyle}>Punch</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ ...labelStyle, fontSize: 9 }}>In</span>
            <input
              type="number"
              min={0}
              step={1}
              placeholder="—"
              value={punchIn ?? ''}
              onChange={e => {
                const v = e.target.value.trim()
                onSetPunchIn(v === '' ? null : Number(v))
              }}
              style={{
                width:       60,
                background:  '#08080f',
                border:      punchIn !== null ? '1px solid #1e3a5f' : '1px solid #15152a',
                borderRadius: 3,
                color:       punchIn !== null ? '#e2e8f0' : '#475569',
                fontSize:     10,
                fontFamily:  'monospace',
                padding:     '2px 4px',
                outline:     'none',
              }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ ...labelStyle, fontSize: 9 }}>Out</span>
            <input
              type="number"
              min={0}
              step={1}
              placeholder="—"
              value={punchOut ?? ''}
              onChange={e => {
                const v = e.target.value.trim()
                onSetPunchOut(v === '' ? null : Number(v))
              }}
              style={{
                width:       60,
                background:  '#08080f',
                border:      punchOut !== null ? '1px solid #1e3a5f' : '1px solid #15152a',
                borderRadius: 3,
                color:       punchOut !== null ? '#e2e8f0' : '#475569',
                fontSize:     10,
                fontFamily:  'monospace',
                padding:     '2px 4px',
                outline:     'none',
              }}
            />
          </label>
        </div>
      </div>

      {/* ── Loop toggle ── */}
      <button
        onClick={onToggleLoop}
        title="Toggle loop recording"
        style={loopRecording ? chipActive('#7c3aed') : chipInactive}
      >
        ↺ Loop
      </button>

      <div style={separator} />

      {/* ── Disk space ── */}
      <DiskSpaceIndicator gb={diskSpaceGB} />

      {/* ── Armed tracks badge ── */}
      {armedCount > 0 && (
        <span
          title={`${armedCount} track${armedCount > 1 ? 's' : ''} armed`}
          style={{
            background:   '#7f1d1d',
            color:        '#fca5a5',
            borderRadius:  10,
            padding:      '1px 7px',
            fontSize:      10,
            fontFamily:   'monospace',
            outline:      '1px solid #ef4444',
            flexShrink:    0,
          }}
        >
          {armedCount} armed
        </span>
      )}

      {/* ── CSS keyframes for record pulse (injected once) ── */}
      <style>{`
        @keyframes recordPulse {
          0%   { box-shadow: 0 0 6px #ef4444aa; }
          50%  { box-shadow: 0 0 16px #ef4444ff; }
          100% { box-shadow: 0 0 6px #ef4444aa; }
        }
      `}</style>
    </div>
  )
}

export default RecordingControls
