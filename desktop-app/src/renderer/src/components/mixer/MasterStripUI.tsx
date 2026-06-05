// ─── MasterStripUI.tsx ────────────────────────────────────────────────────────
// Standalone master channel strip component.

import React, { useEffect, useRef, useState } from 'react'
import { useMixerStore } from './useMixerStore'
import { MeterBar }      from './MeterBar'
import { useTrackLevel } from '../../hooks/useTrackLevel'
import { getAudioEngine, getLoudnessMeter } from '../../audio'
import type { LoudnessMeasurement } from '../../audio'

const LUFS_INIT: LoudnessMeasurement = {
  momentary:  -Infinity,
  shortTerm:  -Infinity,
  integrated: -Infinity,
  range:      0,
  truePeak:   -Infinity,
}

function fmtLufs(v: number): string {
  return isFinite(v) ? v.toFixed(1) : '-∞'
}

function fmtTp(v: number): string {
  return isFinite(v) ? v.toFixed(1) : '-∞'
}

export const MasterStripUI: React.FC = () => {
  const { masterLimiter, masterLimiterThreshold, setMasterLimiter, setMasterLimiterThreshold } = useMixerStore()
  const level = useTrackLevel?.('master') ?? { rms: 0, peak: 0, dbfs: -Infinity }
  const [lufs, setLufs] = useState<LoudnessMeasurement>(LUFS_INIT)
  const rafRef  = useRef<number>(0)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const engine = getAudioEngine()
    const meter  = getLoudnessMeter()
    const analyser = engine.masterAnalyser
    const buf    = new Float32Array(analyser.fftSize)

    // Start realtime metering — feeds from master analyser time-domain data
    const stop = meter.startRealtime(
      () => {
        analyser.getFloatTimeDomainData(buf)
        return buf.slice()
      },
      engine.sampleRate,
      (measurement) => {
        setLufs(measurement)
      },
    )
    stopRef.current = stop

    return () => {
      stop()
      stopRef.current = null
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

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
        <MeterBar peak={level.peak} rms={level.rms} isClipping={level.peak >= 1} height={100} width={10} />
        <MeterBar peak={level.peak} rms={level.rms} isClipping={level.peak >= 1} height={100} width={10} />
      </div>

      {/* LUFS display — real ITU-R BS.1770 values */}
      <div style={{ fontSize: 9, color: '#64748b', textAlign: 'left', width: '100%', lineHeight: 1.6 }}>
        <div>M: {fmtLufs(lufs.momentary)} LUFS</div>
        <div>S: {fmtLufs(lufs.shortTerm)} LUFS</div>
        <div>TP: {fmtTp(lufs.truePeak)} dBTP</div>
      </div>

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
