// ─── SendsPanel.tsx ───────────────────────────────────────────────────────────
// Send routing panel: shows all sends from a channel with gain/pre-post controls.

import React, { useState } from 'react'
import { useMixerStore } from './useMixerStore'

interface SendsPanelProps {
  trackId: string
}

export const SendsPanel: React.FC<SendsPanelProps> = ({ trackId }) => {
  const { getOrCreate, setSend, buses } = useMixerStore()
  const channel  = getOrCreate(trackId)
  const sends    = channel.sends
  const [adding, setAdding] = useState(false)

  const availableBuses = buses.filter(b => !sends.some(s => s.busId === b.id))

  return (
    <div style={{ padding: '6px 8px', background: '#0f172a', borderRadius: 6, minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flex: 1 }}>SENDS</span>
        {availableBuses.length > 0 && (
          <button
            onClick={() => setAdding(a => !a)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 12 }}
          >
            + Add Send
          </button>
        )}
      </div>

      {adding && (
        <div style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {availableBuses.map(b => (
            <button
              key={b.id}
              onClick={() => {
                setSend(trackId, b.id, { gainDb: 0, preFader: false, enabled: true })
                setAdding(false)
              }}
              style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#e2e8f0', cursor: 'pointer', textAlign: 'left' }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {sends.length === 0 && !adding && (
        <div style={{ fontSize: 11, color: '#475569', padding: '4px 0' }}>No sends</div>
      )}

      {sends.map(send => {
        const bus = buses.find(b => b.id === send.busId)
        return (
          <div key={send.busId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, padding: '3px 0' }}>
            <button
              onClick={() => setSend(trackId, send.busId, { enabled: !send.enabled })}
              style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', background: send.enabled ? '#22c55e' : '#475569', padding: 0 }}
              title={send.enabled ? 'Disable' : 'Enable'}
            />
            <span style={{ flex: 1, fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bus?.name ?? send.busId}
            </span>
            <button
              onClick={() => setSend(trackId, send.busId, { preFader: !send.preFader })}
              title={send.preFader ? 'Pre-fader' : 'Post-fader'}
              style={{ fontSize: 9, padding: '1px 4px', background: send.preFader ? '#6366f1' : '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 3, cursor: 'pointer' }}
            >
              {send.preFader ? 'PRE' : 'POST'}
            </button>
            <input
              type="range"
              min={-60}
              max={6}
              step={0.5}
              value={send.gainDb}
              onChange={e => setSend(trackId, send.busId, { gainDb: Number(e.target.value) })}
              style={{ width: 48 }}
              title={`${send.gainDb.toFixed(1)} dB`}
            />
            <span style={{ fontSize: 10, color: '#64748b', minWidth: 32, textAlign: 'right' }}>
              {send.gainDb.toFixed(0)}dB
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default SendsPanel
