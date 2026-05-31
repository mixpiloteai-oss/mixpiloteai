import React from 'react'
import type { FxChain, FxSlot } from '../../audio/vst/FxChain'

// ── FX Chain Panel ─────────────────────────────────────────────────────────────
// Displays ordered effect slots for a track's FX chain.

interface FxChainPanelProps {
  trackId: string
  chain: FxChain
  onSlotBypassed?: (slotId: string, bypassed: boolean) => void
  onSlotGain?: (slotId: string, gainDb: number) => void
  onRemoveSlot?: (slotId: string) => void
  onAddEffect?: () => void
}

function GainLabel({ gainDb }: { gainDb: number }): React.ReactElement {
  const formatted = gainDb > 0 ? `+${gainDb.toFixed(1)} dB` : `${gainDb.toFixed(1)} dB`
  return <span style={{ fontSize: 11, color: '#888', minWidth: 56, textAlign: 'right' }}>{formatted}</span>
}

function SlotRow({
  slot,
  onBypassed,
  onGain,
  onRemove,
}: {
  slot: FxSlot
  onBypassed?: (slotId: string, bypassed: boolean) => void
  onGain?: (slotId: string, gainDb: number) => void
  onRemove?: (slotId: string) => void
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderBottom: '1px solid #222',
        opacity: slot.bypassed ? 0.5 : 1,
      }}
    >
      <button
        title={slot.bypassed ? 'Enable' : 'Bypass'}
        onClick={() => onBypassed?.(slot.slotId, !slot.bypassed)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 16,
          padding: 0,
          lineHeight: 1,
        }}
      >
        {slot.bypassed ? '🔇' : '🔊'}
      </button>
      <span style={{ flex: 1, fontSize: 13, color: '#e0e0e0' }}>{slot.pluginName}</span>
      <GainLabel gainDb={slot.gainDb} />
      <input
        type="range"
        min={-24}
        max={6}
        step={0.5}
        value={slot.gainDb}
        onChange={e => onGain?.(slot.slotId, parseFloat(e.target.value))}
        style={{ width: 80 }}
        title="Slot gain"
      />
      <button
        title="Remove effect"
        onClick={() => onRemove?.(slot.slotId)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#c04040',
          fontSize: 14,
          padding: '0 4px',
        }}
      >
        ✕
      </button>
    </div>
  )
}

export function FxChainPanel({
  trackId: _trackId,
  chain,
  onSlotBypassed,
  onSlotGain,
  onRemoveSlot,
  onAddEffect,
}: FxChainPanelProps): React.ReactElement {
  const slots = chain.getSlots()
  const anyBypassed = slots.some(s => s.bypassed)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          borderBottom: '1px solid #333',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#c0c0e0', flex: 1 }}>
          FX Chain
        </span>
        {anyBypassed && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 10,
              background: '#4a2a2a',
              color: '#cc8080',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Bypass All
          </span>
        )}
      </div>

      {/* Slots */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {slots.length === 0 ? (
          <div style={{ padding: 16, color: '#666', fontSize: 12, textAlign: 'center' }}>
            No effects loaded
          </div>
        ) : (
          slots.map(slot => (
            <SlotRow
              key={slot.slotId}
              slot={slot}
              onBypassed={onSlotBypassed}
              onGain={onSlotGain}
              onRemove={onRemoveSlot}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid #333' }}>
        <button
          onClick={onAddEffect}
          style={{
            width: '100%',
            padding: '6px 0',
            background: '#2a2a4a',
            border: '1px dashed #5a5a9a',
            color: '#9090cc',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          + Add Effect
        </button>
      </div>
    </div>
  )
}
