import { useRef, useEffect } from 'react'
import { usePianoRollStore } from './usePianoRollStore'
import { isBlackKey, pitchName, TOTAL_PITCHES } from './types'

const KEY_W = 56

export default function PianoKeys() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollY, zoomY, setScroll, scrollX } = usePianoRollStore()

  // Sync DOM scroll position from Zustand (driven by canvas wheel events)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = scrollY
    }
  }, [scrollY])

  // Wheel on piano keys also scrolls vertically
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    setScroll(scrollX, scrollY + e.deltaY * 0.5)
  }

  const totalH = TOTAL_PITCHES * zoomY

  return (
    <div
      ref={containerRef}
      className="shrink-0 overflow-hidden select-none"
      style={{ width: KEY_W, background: '#05050d', borderRight: '1px solid #1a1a2e' }}
      onWheel={onWheel}
    >
      <div style={{ height: totalH, position: 'relative' }}>
        {Array.from({ length: TOTAL_PITCHES }, (_, i) => {
          const pitch  = TOTAL_PITCHES - 1 - i
          const black  = isBlackKey(pitch)
          const name   = pitchName(pitch)
          const isC    = pitch % 12 === 0
          const y      = i * zoomY

          return (
            <div
              key={pitch}
              className="absolute left-0 right-0 flex items-center justify-end pr-1.5 cursor-default"
              style={{
                top:          y,
                height:       zoomY,
                background:   black ? '#080810' : isC ? '#0e0e1c' : '#0b0b17',
                borderBottom: `1px solid ${isC ? 'rgba(124,58,237,0.25)' : '#111120'}`,
                boxSizing:    'border-box',
              }}
            >
              {isC && zoomY >= 11 && (
                <span
                  className="font-mono"
                  style={{
                    fontSize:   Math.min(9, zoomY - 2),
                    color:      '#7c3aed',
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  {name}
                </span>
              )}
              {!isC && !black && zoomY >= 16 && (
                <span
                  style={{
                    fontSize:   8,
                    color:      '#2a2a3e',
                    userSelect: 'none',
                  }}
                >
                  {name}
                </span>
              )}
              {/* Black key overlay strip */}
              {black && (
                <div
                  className="absolute left-0"
                  style={{
                    width:      KEY_W * 0.62,
                    top:        0,
                    height:     '100%',
                    background: 'linear-gradient(90deg, #060609, #0d0d14)',
                    borderRight: '1px solid #1c1c2e',
                    zIndex:     1,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { KEY_W }
