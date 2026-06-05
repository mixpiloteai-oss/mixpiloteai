// ─── InputSelector.tsx ────────────────────────────────────────────────────────
// Per-track input configuration panel. Props-driven, no store import.

import React from 'react'
import { MonitorMeter } from './MonitorMeter'

interface AudioDeviceInfo {
  deviceId:     string
  label:        string
  channelCount: number
}

export interface InputSelectorProps {
  trackId:             string
  trackName:           string
  trackColor:          string
  armed:               boolean
  devices:             AudioDeviceInfo[]
  selectedDeviceId:    string
  channelCount:        1 | 2
  inputGain:           number    // dB, -inf..+24
  monitorEnabled:      boolean
  directMonitor:       boolean
  peak:                number    // live input peak 0..1
  rms:                 number    // live input rms 0..1
  latencyMs:           number
  onToggleArm:         () => void
  onSelectDevice:      (deviceId: string) => void
  onSetChannelCount:   (count: 1 | 2) => void
  onSetInputGain:      (gainDb: number) => void
  onToggleMonitor:     () => void
  onToggleDirectMonitor: () => void
}

const btnBase: React.CSSProperties = {
  border:       'none',
  borderRadius:  3,
  cursor:       'pointer',
  fontFamily:   'monospace',
  fontSize:      10,
  padding:      '2px 6px',
  lineHeight:   '16px',
  transition:   'background 0.1s',
}

const chipActive: React.CSSProperties = {
  ...btnBase,
  background: '#1e3a5f',
  color:      '#06b6d4',
  outline:    '1px solid #06b6d4',
}

const chipInactive: React.CSSProperties = {
  ...btnBase,
  background: '#0d0d1a',
  color:      '#475569',
  outline:    '1px solid #15152a',
}

export const InputSelector: React.FC<InputSelectorProps> = ({
  trackName,
  trackColor,
  armed,
  devices,
  selectedDeviceId,
  channelCount,
  inputGain,
  monitorEnabled,
  directMonitor,
  peak,
  rms,
  latencyMs,
  onToggleArm,
  onSelectDevice,
  onSetChannelCount,
  onSetInputGain,
  onToggleMonitor,
  onToggleDirectMonitor,
}) => {
  return (
    <div
      style={{
        width:          100,
        flexShrink:     0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        background:     '#0b0b17',
        border:         `1px solid #15152a`,
        borderTop:      `2px solid ${trackColor}`,
        borderRadius:    4,
        padding:        '6px 4px',
        gap:             5,
        color:          '#e2e8f0',
        fontFamily:     'monospace',
        fontSize:        10,
        boxSizing:      'border-box',
      }}
    >
      {/* ── Arm button + track name ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
        <button
          onClick={onToggleArm}
          title={armed ? 'Disarm track' : 'Arm track for recording'}
          style={{
            ...btnBase,
            width:        14,
            height:       14,
            padding:       0,
            borderRadius: '50%',
            background:   armed ? '#ef4444' : '#2a1a1a',
            outline:      armed ? '1px solid #ef4444' : '1px solid #3f1f1f',
            flexShrink:   0,
            boxShadow:    armed ? '0 0 6px #ef4444aa' : 'none',
          }}
        />
        <span
          style={{
            flex:         1,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            color:        armed ? '#e2e8f0' : '#94a3b8',
            fontWeight:   armed ? 700 : 400,
            fontSize:      10,
          }}
          title={trackName}
        >
          {trackName}
        </span>
      </div>

      {/* ── Device dropdown ── */}
      <select
        value={selectedDeviceId}
        onChange={e => onSelectDevice(e.target.value)}
        style={{
          width:       '100%',
          maxWidth:     140,
          background:  '#0d0d1a',
          color:       '#94a3b8',
          border:      '1px solid #15152a',
          borderRadius: 3,
          fontSize:     9,
          fontFamily:  'monospace',
          padding:     '2px 3px',
          cursor:      'pointer',
          overflow:    'hidden',
          textOverflow:'ellipsis',
        }}
        title="Select input device"
      >
        {devices.length === 0 && (
          <option value="">No devices</option>
        )}
        {devices.map(d => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>

      {/* ── Mono / Stereo chips ── */}
      <div style={{ display: 'flex', gap: 3 }}>
        <button
          onClick={() => onSetChannelCount(1)}
          style={channelCount === 1 ? chipActive : chipInactive}
        >
          Mono
        </button>
        <button
          onClick={() => onSetChannelCount(2)}
          style={channelCount === 2 ? chipActive : chipInactive}
        >
          Ster
        </button>
      </div>

      {/* ── Input gain slider ── */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: 9 }}>
          <span>Gain</span>
          <span style={{ color: '#94a3b8' }}>{inputGain >= 0 ? `+${inputGain.toFixed(1)}` : inputGain.toFixed(1)} dB</span>
        </div>
        <input
          type="range"
          min={-60}
          max={24}
          step={0.5}
          value={inputGain}
          onChange={e => onSetInputGain(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
          title={`Input gain: ${inputGain.toFixed(1)} dB`}
        />
      </div>

      {/* ── Live input meter ── */}
      <MonitorMeter
        peak={peak}
        rms={rms}
        height={60}
        width={10}
        latencyMs={latencyMs}
      />

      {/* ── Monitor (software) toggle ── */}
      <button
        onClick={onToggleMonitor}
        title="Toggle software monitor"
        style={{
          ...btnBase,
          width:      '100%',
          background: monitorEnabled ? '#1a2a1a' : '#0d0d1a',
          color:      monitorEnabled ? '#22c55e' : '#475569',
          outline:    monitorEnabled ? '1px solid #22c55e' : '1px solid #15152a',
        }}
      >
        Mon
      </button>

      {/* ── Direct monitor toggle ── */}
      <button
        onClick={onToggleDirectMonitor}
        title="Toggle direct (zero-latency) monitor"
        style={{
          ...btnBase,
          width:      '100%',
          background: directMonitor ? '#1a1a2a' : '#0d0d1a',
          color:      directMonitor ? '#06b6d4' : '#475569',
          outline:    directMonitor ? '1px solid #06b6d4' : '1px solid #15152a',
        }}
      >
        Direct Mon
      </button>
    </div>
  )
}

export default InputSelector
