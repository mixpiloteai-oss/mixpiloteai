import React from 'react'
import type { InstrumentRack, RackLayer } from '../../audio/vst/InstrumentRack'

// ── Instrument Rack Panel ──────────────────────────────────────────────────────
// Displays layered instrument plugin instances for a track.

interface InstrumentRackPanelProps {
  trackId: string
  rack: InstrumentRack
  onLayerActive?: (layerId: string, active: boolean) => void
  onLayerGain?: (layerId: string, gainDb: number) => void
  onRemoveLayer?: (layerId: string) => void
  onAddLayer?: () => void
}

function midiNoteToName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(note / 12) - 1
  const name = names[note % 12]
  return `${name}${octave}`
}

function NoteRangeLabel({ low, high }: { low: number; high: number }): React.ReactElement {
  return (
    <span style={{ fontSize: 11, color: '#888' }}>
      {midiNoteToName(low)} – {midiNoteToName(high)}
    </span>
  )
}

function LayerRow({
  layer,
  onActive,
  onGain,
  onRemove,
}: {
  layer: RackLayer
  onActive?: (layerId: string, active: boolean) => void
  onGain?: (layerId: string, gainDb: number) => void
  onRemove?: (layerId: string) => void
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderBottom: '1px solid #222',
        opacity: layer.active ? 1 : 0.4,
      }}
    >
      <input
        type="checkbox"
        checked={layer.active}
        onChange={e => onActive?.(layer.layerId, e.target.checked)}
        title="Active"
        style={{ cursor: 'pointer' }}
      />
      <span style={{ flex: 1, fontSize: 13, color: '#e0e0e0' }}>{layer.pluginName}</span>
      <NoteRangeLabel low={layer.noteRangeLow} high={layer.noteRangeHigh} />
      <span style={{ fontSize: 11, color: '#888', minWidth: 48, textAlign: 'right' }}>
        {layer.gainDb > 0 ? `+${layer.gainDb.toFixed(1)}` : layer.gainDb.toFixed(1)} dB
      </span>
      <input
        type="range"
        min={-24}
        max={6}
        step={0.5}
        value={layer.gainDb}
        onChange={e => onGain?.(layer.layerId, parseFloat(e.target.value))}
        style={{ width: 80 }}
        title="Layer gain"
      />
      <button
        title="Remove layer"
        onClick={() => onRemove?.(layer.layerId)}
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

export function InstrumentRackPanel({
  trackId: _trackId,
  rack,
  onLayerActive,
  onLayerGain,
  onRemoveLayer,
  onAddLayer,
}: InstrumentRackPanelProps): React.ReactElement {
  const layers = rack.getLayers()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid #333',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#c0c0e0' }}>
          Instrument Rack
        </span>
      </div>

      {/* Layers */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {layers.length === 0 ? (
          <div style={{ padding: 16, color: '#666', fontSize: 12, textAlign: 'center' }}>
            No instruments loaded
          </div>
        ) : (
          layers.map(layer => (
            <LayerRow
              key={layer.layerId}
              layer={layer}
              onActive={onLayerActive}
              onGain={onLayerGain}
              onRemove={onRemoveLayer}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid #333' }}>
        <button
          onClick={onAddLayer}
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
          + Add Layer
        </button>
      </div>
    </div>
  )
}
