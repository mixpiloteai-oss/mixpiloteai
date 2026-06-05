import React, { useState, useRef, useEffect, type ReactNode } from 'react'

interface LazyPanelProps {
  children:    ReactNode
  placeholder?: ReactNode
  threshold?:  number
  height?:     number
}

export function LazyPanel({ children, placeholder, threshold = 0.1, height = 200 }: LazyPanelProps): React.ReactElement {
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mounted) return
    const el  = ref.current
    if (!el)   return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setMounted(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [mounted, threshold])

  if (!mounted) {
    return (
      <div ref={ref} style={{ minHeight: height }}>
        {placeholder ?? null}
      </div>
    )
  }
  return <>{children}</>
}

export default LazyPanel
