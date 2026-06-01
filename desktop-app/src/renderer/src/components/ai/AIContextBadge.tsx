// ─── AIContextBadge.tsx ───────────────────────────────────────────────────────
// Compact inline badge showing current AI understanding.

import { useState } from 'react'

interface AIContextBadgeProps {
  contextSummary: string
  style: string
  bpm: number
  isStale: boolean
}

const STYLE_COLORS: Record<string, string> = {
  house:    '#3b82f6',
  techno:   '#6d28d9',
  dnb:      '#dc2626',
  trap:     '#f59e0b',
  hiphop:   '#10b981',
  jazz:     '#06b6d4',
  ambient:  '#64748b',
  unknown:  '#64748b',
}

export default function AIContextBadge({
  contextSummary,
  style,
  bpm,
  isStale,
}: AIContextBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const color = STYLE_COLORS[style] ?? STYLE_COLORS['unknown']!

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '9999px',
          backgroundColor: color + '33',
          border: `1px solid ${color}66`,
          color: color,
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          textTransform: 'capitalize',
          lineHeight: 1.5,
        }}
        type="button"
      >
        {isStale && (
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              flexShrink: 0,
            }}
          />
        )}
        <span>{style}</span>
        <span style={{ opacity: 0.8 }}>{bpm} BPM</span>
      </button>

      {showTooltip && contextSummary && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e1e2e',
            border: '1px solid #374151',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '11px',
            color: '#d1d5db',
            lineHeight: 1.5,
            width: '220px',
            whiteSpace: 'normal',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {contextSummary}
        </div>
      )}
    </div>
  )
}
