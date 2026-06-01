// ─── AutomationPointMenu.tsx ──────────────────────────────────────────────────
// Context menu for selecting a point's curve type or deleting it.

import React from 'react'
import type { AutomationCurveType } from '../../audio/automation/AutomationTypes'

interface AutomationPointMenuProps {
  x: number
  y: number
  currentCurve: AutomationCurveType
  onSelect: (c: AutomationCurveType) => void
  onDelete: () => void
  onClose: () => void
}

const CURVE_OPTIONS: { label: string; value: AutomationCurveType }[] = [
  { label: 'Linear', value: 'linear' },
  { label: 'Step', value: 'step' },
  { label: 'Exponential', value: 'exponential' },
  { label: 'Logarithmic', value: 'logarithmic' },
  { label: 'Sine', value: 'sine' },
  { label: 'Bezier', value: 'bezier' },
]

export function AutomationPointMenu({
  x,
  y,
  currentCurve,
  onSelect,
  onDelete,
  onClose,
}: AutomationPointMenuProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 9999,
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '4px 0',
        minWidth: 140,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#888',
          padding: '2px 12px 4px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Curve Type
      </div>
      {CURVE_OPTIONS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => {
            onSelect(value)
            onClose()
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '5px 12px',
            background: value === currentCurve ? '#252540' : 'transparent',
            color: value === currentCurve ? '#fff' : '#ccc',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {value === currentCurve ? '✓ ' : '  '}{label}
        </button>
      ))}
      <div style={{ borderTop: '1px solid #333', margin: '4px 0' }} />
      <button
        onClick={() => {
          onDelete()
          onClose()
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '5px 12px',
          background: 'transparent',
          color: '#ef4444',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Delete Point
      </button>
      <button
        onClick={onClose}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '5px 12px',
          background: 'transparent',
          color: '#888',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Close
      </button>
    </div>
  )
}
