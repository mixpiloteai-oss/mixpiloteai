// ─── LiveCursorOverlay ────────────────────────────────────────────────────────
// Overlays collaborators' cursors on the arrangement timeline.

import React from 'react'
import { useCollaborationStore } from '../../store/collaborationStore'
import { collaborationClient } from '../../services/CollaborationClient'

interface Props {
  pixelsPerBar: number
  scrollOffsetBars: number
  canvasWidth: number
  canvasHeight: number
}

export function LiveCursorOverlay({
  pixelsPerBar,
  scrollOffsetBars,
  canvasWidth,
  canvasHeight,
}: Props): React.ReactElement {
  const presence = useCollaborationStore((s) => s.presence)
  const myUserId = collaborationClient.myUserId

  const cursors = Object.values(presence).filter(
    (p) =>
      p.userId !== myUserId &&
      p.cursor !== undefined &&
      p.cursor !== null &&
      typeof p.cursor.bar === 'number',
  )

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {cursors.map((p) => {
        const bar = (p.cursor as { bar: number }).bar
        const x = (bar - scrollOffsetBars) * pixelsPerBar

        // Only render if within canvas bounds
        if (x < 0 || x > canvasWidth) return null

        return (
          <div key={p.userId}>
            {/* Vertical cursor line */}
            <div
              style={{
                position: 'absolute',
                left: x,
                top: 0,
                width: 2,
                height: canvasHeight,
                backgroundColor: p.userColor,
                opacity: 0.7,
                transition: 'left 150ms ease-out',
              }}
            />
            {/* Label pill above */}
            <div
              style={{
                position: 'absolute',
                left: x,
                top: 0,
                transform: 'translateX(-50%)',
                backgroundColor: p.userColor,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 9999,
                whiteSpace: 'nowrap',
                opacity: 0.9,
                transition: 'left 150ms ease-out',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {p.userName}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default LiveCursorOverlay
