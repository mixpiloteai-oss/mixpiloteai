import { usePianoRollStore } from './usePianoRollStore'
import { SCALE_ROOT_NAMES, SCALE_MODE_NAMES } from './types'
import type { ScaleRoot, ScaleMode } from './types'

// ─── ScalePanel ───────────────────────────────────────────────────────────────

export default function ScalePanel() {
  const {
    scaleEnabled, scaleRoot, scaleMode,
    setScaleEnabled, setScaleRoot, setScaleMode,
    snapToScale,
  } = usePianoRollStore()

  const sel: React.CSSProperties = {
    fontSize:     10,
    padding:      '2px 6px',
    borderRadius: 4,
    background:   '#0e0e1c',
    border:       '1px solid #1c1c2e',
    color:        scaleEnabled ? '#a855f7' : '#64748b',
    outline:      'none',
    cursor:       'pointer',
  }

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      padding:      '6px 12px',
      background:   '#09090f',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      flexShrink:   0,
    }}>
      {/* Enable toggle */}
      <button
        onClick={() => setScaleEnabled(!scaleEnabled)}
        title={scaleEnabled ? 'Disable scale' : 'Enable scale'}
        style={{
          padding:      '2px 8px',
          borderRadius: 4,
          fontSize:     10,
          fontWeight:   scaleEnabled ? 700 : 400,
          background:   scaleEnabled ? 'rgba(124,58,237,0.22)' : 'transparent',
          color:        scaleEnabled ? '#a855f7' : '#475569',
          border:       `1px solid ${scaleEnabled ? 'rgba(124,58,237,0.4)' : '#1c1c2e'}`,
          cursor:       'pointer',
        }}
      >
        Scale
      </button>

      {/* Root note */}
      <select
        value={scaleRoot}
        onChange={e => setScaleRoot(e.target.value as ScaleRoot)}
        style={sel}
        disabled={!scaleEnabled}
      >
        {SCALE_ROOT_NAMES.map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* Mode */}
      <select
        value={scaleMode}
        onChange={e => setScaleMode(e.target.value as ScaleMode)}
        style={{ ...sel, minWidth: 130 }}
        disabled={!scaleEnabled}
      >
        {(Object.keys(SCALE_MODE_NAMES) as ScaleMode[]).map(m => (
          <option key={m} value={m}>{SCALE_MODE_NAMES[m]}</option>
        ))}
      </select>

      {/* Scale highlight visual */}
      {scaleEnabled && <ScalePianoBar root={scaleRoot} mode={scaleMode} />}

      <div style={{ flex: 1 }} />

      {/* Snap to scale */}
      <button
        onClick={snapToScale}
        disabled={!scaleEnabled}
        title="Snap selected notes to current scale"
        style={{
          padding:      '2px 8px',
          borderRadius: 4,
          fontSize:     10,
          background:   'transparent',
          border:       '1px solid #1c1c2e',
          color:        scaleEnabled ? '#64748b' : '#2a2a3a',
          cursor:       scaleEnabled ? 'pointer' : 'default',
        }}
      >
        Snap→Scale
      </button>
    </div>
  )
}

// ─── Mini piano bar showing which keys are in the scale ───────────────────────

import { isBlackKey, NOTE_NAMES } from './types'
import { SCALE_ROOT_MIDI, SCALE_INTERVALS } from '../../lib/musicTheory'

function ScalePianoBar({ root, mode }: { root: ScaleRoot; mode: ScaleMode }) {
  const rootMidi    = SCALE_ROOT_MIDI[root]
  const intervals   = SCALE_INTERVALS[mode]
  const scaleSet    = new Set(intervals.map(i => (rootMidi + i) % 12))
  const keys        = NOTE_NAMES  // 12 notes

  return (
    <div style={{ display: 'flex', gap: 1, marginLeft: 4 }}>
      {keys.map((name, i) => {
        const inScale = scaleSet.has(i)
        const isRoot  = i === rootMidi % 12
        const black   = isBlackKey(i)
        return (
          <div
            key={name}
            title={name}
            style={{
              width:        black ? 7 : 9,
              height:       black ? 14 : 20,
              borderRadius: 2,
              background:   isRoot
                ? '#a855f7'
                : inScale
                  ? black ? '#3b2060' : '#1e1040'
                  : black ? '#111' : '#1e1e2e',
              border:       `1px solid ${inScale ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.04)'}`,
              flexShrink:   0,
              alignSelf:    'flex-end',
            }}
          />
        )
      })}
    </div>
  )
}
