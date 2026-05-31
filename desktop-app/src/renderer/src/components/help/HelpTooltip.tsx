import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'

interface HelpTooltipProps {
  children: React.ReactNode
  content: string
  shortcut?: string
  title?: string
  disabled?: boolean
}

interface TooltipPosition {
  top: number
  left: number
  above: boolean
}

export default function HelpTooltip({
  children,
  content,
  shortcut,
  title,
  disabled = false,
}: HelpTooltipProps) {
  const beginnerMode = useUIStore(s => s.beginnerMode)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0, above: true })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (disabled || !beginnerMode) return
    clearTimer()
    timerRef.current = setTimeout(() => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect()
        const above = rect.top > 180
        setPosition({
          top: above ? rect.top - 8 : rect.bottom + 8,
          left: Math.min(rect.left + rect.width / 2, window.innerWidth - 230),
          above,
        })
      }
      setVisible(true)
    }, 800)
  }, [disabled, beginnerMode, clearTimer])

  const handleMouseLeave = useCallback(() => {
    clearTimer()
    setVisible(false)
  }, [clearTimer])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const nativeTitle = !disabled && !beginnerMode
    ? [title, content, shortcut ? `(${shortcut})` : ''].filter(Boolean).join(' — ')
    : undefined

  const arrowStyle: React.CSSProperties = position.above
    ? {
        position: 'absolute',
        bottom: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid #7c3aed',
      }
    : {
        position: 'absolute',
        top: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: '6px solid #7c3aed',
      }

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    top: position.above ? position.top - 4 : position.top,
    left: position.left,
    transform: position.above
      ? 'translate(-50%, -100%)'
      : 'translate(-50%, 0)',
    background: '#1a1a3a',
    border: '1px solid #7c3aed',
    borderRadius: 8,
    padding: '10px 12px',
    maxWidth: 220,
    pointerEvents: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
  }

  return (
    <div
      ref={wrapperRef}
      title={nativeTitle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'contents' }}
    >
      {children}

      {beginnerMode && visible && (
        <div style={tooltipStyle}>
          <div style={{ position: 'relative' }}>
            {title && (
              <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0', marginBottom: 4 }}>
                {title}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
              {content}
            </div>
            {shortcut && (
              <div style={{ marginTop: 6 }}>
                <span style={{
                  background: '#0a0a14',
                  border: '1px solid #2a2a4e',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: '#10b981',
                }}>
                  {shortcut}
                </span>
              </div>
            )}
            <div style={arrowStyle} />
          </div>
        </div>
      )}
    </div>
  )
}
