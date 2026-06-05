// ─── SectionTimelineOverlay ───────────────────────────────────────────────────
// Horizontal section overlay for the arrangement timeline.

import React from 'react'
import type { ArrangementSection } from '../../audio/workflow/SectionDetector'
import { getSectionColor } from '../../audio/workflow/SectionDetector'

interface SectionTimelineOverlayProps {
  sections:  ArrangementSection[]
  totalBars: number
  width:     number
}

export function SectionTimelineOverlay({
  sections,
  totalBars,
  width,
}: SectionTimelineOverlayProps): React.ReactElement {
  const HEIGHT = 20

  if (totalBars === 0 || sections.length === 0) {
    return (
      <div
        style={{
          position:        'relative',
          width:           `${width}px`,
          height:          `${HEIGHT}px`,
          backgroundColor: '#374151',
          borderRadius:    2,
          overflow:        'hidden',
        }}
      />
    )
  }

  return (
    <div
      style={{
        position:     'relative',
        width:        `${width}px`,
        height:       `${HEIGHT}px`,
        overflow:     'hidden',
        borderRadius: 2,
      }}
    >
      {sections.map((section) => {
        const segmentWidth = ((section.endBar - section.startBar + 1) / totalBars) * width
        const segmentLeft  = ((section.startBar - 1) / totalBars) * width

        return (
          <div
            key={`${section.type}-${section.startBar}`}
            title={section.label}
            style={{
              position:        'absolute',
              left:            `${segmentLeft}px`,
              top:             0,
              width:           `${segmentWidth}px`,
              height:          `${HEIGHT}px`,
              backgroundColor: getSectionColor(section.type),
              display:         'flex',
              alignItems:      'center',
              overflow:        'hidden',
              boxSizing:       'border-box',
              borderRight:     '1px solid rgba(0,0,0,0.3)',
            }}
          >
            {segmentWidth > 60 && (
              <span
                style={{
                  fontSize:     10,
                  color:        '#fff',
                  padding:      '0 4px',
                  whiteSpace:   'nowrap',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight:   600,
                  textShadow:   '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {section.type.charAt(0).toUpperCase() + section.type.slice(1)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default SectionTimelineOverlay
