// ─── MixerLayoutControls.tsx ──────────────────────────────────────────────────
// Toolbar controls for channel width and compact mode.

import React from 'react'
import { useMixerLayout, MIN_WIDTH, MAX_WIDTH } from './useMixerLayout'
import { MixerDetachButton } from './MixerDetachButton'

export const MixerLayoutControls: React.FC = () => {
  const { channelWidth, compactMode, setChannelWidth, toggleCompactMode, resetLayout } = useMixerLayout()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Compact toggle */}
      <button
        onClick={toggleCompactMode}
        title={compactMode ? 'Expand channels' : 'Compact mode'}
        style={{
          padding:      '3px 8px',
          borderRadius: 4,
          fontSize:     10,
          fontWeight:   compactMode ? 600 : 400,
          cursor:       'pointer',
          background:   compactMode ? 'rgba(6,182,212,0.18)' : 'rgba(255,255,255,0.04)',
          color:        compactMode ? '#06b6d4' : '#475569',
          border:       `1px solid ${compactMode ? 'rgba(6,182,212,0.40)' : 'rgba(255,255,255,0.06)'}`,
          transition:   'all 0.12s',
        }}
      >
        {compactMode ? 'Compact' : 'Full'}
      </button>

      {/* Width slider */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#475569' }}>
        W
        <input
          type="range"
          min={MIN_WIDTH}
          max={MAX_WIDTH}
          step={4}
          value={channelWidth}
          onChange={e => setChannelWidth(Number(e.target.value))}
          style={{ width: 64, accentColor: '#7c3aed' }}
        />
        <span style={{ fontFamily: 'monospace', minWidth: 24 }}>{channelWidth}</span>
      </label>

      {/* Reset */}
      <button
        onClick={resetLayout}
        title="Reset layout to defaults"
        style={{
          padding: '3px 6px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
          background: 'transparent', color: '#334155',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        ↺
      </button>

      {/* Detach */}
      <MixerDetachButton />
    </div>
  )
}

export default MixerLayoutControls
