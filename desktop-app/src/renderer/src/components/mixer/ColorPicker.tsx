// ─── ColorPicker.tsx ──────────────────────────────────────────────────────────
// Swatch grid with 8 preset colors and a custom hex input.

import React, { useState } from 'react'

const PRESETS = [
  '#7c3aed', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#e2e8f0',
]

interface ColorPickerProps {
  value:    string
  onSelect: (color: string) => void
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onSelect }) => {
  const [custom, setCustom] = useState('')

  function handleCustom(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setCustom(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onSelect(v)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px', background: '#0d0d1a', border: '1px solid #1e3a5f', borderRadius: 6 }}>
      {/* Swatches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {PRESETS.map(color => (
          <div
            key={color}
            onClick={() => onSelect(color)}
            title={color}
            style={{
              width: 18, height: 18, borderRadius: 3, cursor: 'pointer',
              background: color,
              border: `2px solid ${value === color ? '#fff' : 'transparent'}`,
              transition: 'transform 0.1s',
            }}
          />
        ))}
      </div>

      {/* Custom hex */}
      <input
        type="text"
        value={custom}
        placeholder="#rrggbb"
        onChange={handleCustom}
        maxLength={7}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '3px 6px',
          background: '#1a1a2e', border: '1px solid #1e3a5f', borderRadius: 3,
          color: '#e2e8f0', fontSize: 10, fontFamily: 'monospace',
          outline: 'none',
        }}
      />
    </div>
  )
}

export default ColorPicker
