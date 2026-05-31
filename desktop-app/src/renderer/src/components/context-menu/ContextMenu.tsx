import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  id: string
  label: string
  shortcut?: string
  icon?: string
  disabled?: boolean
  separator?: boolean
  action?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Correct position to stay within window bounds
  const menuWidth = 220
  const menuHeight = items.length * 36
  const correctedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const correctedY = Math.min(y, window.innerHeight - menuHeight - 8)

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: Math.max(4, correctedY),
        left: Math.max(4, correctedX),
        background: '#0d0d1a',
        border: '1px solid #1a1a2e',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        zIndex: 9999,
        minWidth: menuWidth,
        padding: '4px 0',
        fontFamily: 'inherit',
      }}
    >
      {items.map((item) => {
        if (item.separator) {
          return (
            <hr
              key={item.id}
              style={{
                border: 'none',
                borderTop: '1px solid #1a1a2e',
                margin: '4px 0',
              }}
            />
          )
        }
        return (
          <div
            key={item.id}
            onClick={() => {
              if (item.disabled) return
              item.action?.()
              onClose()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: item.disabled ? 'default' : 'pointer',
              opacity: item.disabled ? 0.4 : 1,
              fontSize: 13,
              color: '#e2e8f0',
              userSelect: 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.currentTarget as HTMLDivElement).style.background = '#1a1a2e'
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent'
            }}
          >
            {item.icon && (
              <span style={{ width: 16, textAlign: 'center', fontSize: 14 }}>{item.icon}</span>
            )}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ color: '#666', fontSize: 11, marginLeft: 16 }}>{item.shortcut}</span>
            )}
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
