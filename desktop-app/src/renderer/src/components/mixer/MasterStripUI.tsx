// ─── MasterStripUI.tsx ────────────────────────────────────────────────────────
// Standalone master channel strip component.

import React from 'react'
import { useMixerStore } from './useMixerStore'
import { MeterBar }      from './MeterBar'
import { useTrackLevel } from '../../../hooks/useTrackLevel'

export const MasterStripUI: React.FC = () => {
  const { masterLimiter, masterLimiterThreshold, setMasterLimiter, setMasterLimiterThreshold } = useMixerStore()
  // Use master bus level ('master' is the master bus id by convention)
  const level = useTrackLevel?.('master') ?? { peakL: 0, peakR: 0, rmsL: 0, rmsR: 0 }
  const lufs  = level.rmsL > 0 ? (-0.691 + 10 * Math.log10(level.rmsL * level.rmsL)).toFixed(1) : '-∞'

  return (
    <div
      style={{
        width:         120,
        flexShrink:    0,
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        background:    '#0f172a',
        borderLeft:    '1px solid #1e3a5f',
        padding:       '8px 6px',
        gap:           6,
        color:         '#e2e8f0',
        fontFamily:    'monospace',
        fontSize:      11,
      }}
    >
      <span style={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>MASTER</span>

      {/* Meters */}
      <div style={{ display: 'flex', gap: 3 }}>
        <MeterBar peak={level.peakL} rms={level.rmsL} isClipping={level.peakL >= 1} height={100} width={10} />
        <MeterBar peak={level.peakR} rms={level.rmsR} isClipping={level.peakR >= 1} height={100} width={10} />
      </div>

      {/* LUFS */}
      <div style={{ fontSize: 10, color: '#64748b' }}>LUFS: {lufs}</div>

      {/* Master gain fader */}
      <label style={{ fontSize: 10, color: '#94a3b8', width: '100%', textAlign: 'center' }}>
        Gain
        <input
          type="range" min={-60} max={12} step={0.5} defaultValue={0}
          style={{ width: '100%', marginTop: 2 }}
          onChange={e => {
            const db = Number(e.target.value)
            void db // gain is handled via projectStore master gain
          }}
        />
      </label>

      {/* Limiter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94a3b8', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={masterLimiter}
            onChange={e => setMasterLimiter(e.target.checked)}
            style={{ width: 12, height: 12 }}
          />
          Limiter
        </label>
        {masterLimiter && (
          <label style={{ fontSize: 10, color: '#94a3b8' }}>
            Threshold
            <input
              type="range" min={-12} max={0} step={0.5}
              value={masterLimiterThreshold}
              onChange={e => setMasterLimiterThreshold(Number(e.target.value))}
              style={{ width: '100%', marginTop: 2 }}
            />
            <span style={{ color: '#64748b' }}>{masterLimiterThreshold.toFixed(1)} dB</span>
          </label>
        )}
      </div>
    </div>
  )
}

export default MasterStripUI
