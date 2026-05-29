import React, { useState, useRef, useCallback, type ReactNode } from 'react'

interface VirtualListProps<T> {
  items:           T[]
  itemHeight:      number
  containerHeight: number
  renderItem:      (item: T, index: number) => ReactNode
  overscan?:       number
}

export function VirtualList<T>({ items, itemHeight, containerHeight, renderItem, overscan = 3 }: VirtualListProps<T>): React.ReactElement {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const totalHeight  = items.length * itemHeight
  const startIdx     = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const endIdx       = Math.min(items.length, startIdx + visibleCount + overscan * 2)

  const visibleItems = items.slice(startIdx, endIdx)

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflowY: 'auto', position: 'relative' }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, i) => (
          <div
            key={startIdx + i}
            style={{ position: 'absolute', top: (startIdx + i) * itemHeight, left: 0, right: 0, height: itemHeight }}
          >
            {renderItem(item, startIdx + i)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default VirtualList
