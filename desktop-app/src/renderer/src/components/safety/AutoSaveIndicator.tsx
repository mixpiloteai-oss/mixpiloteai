/**
 * AutoSaveIndicator — small status indicator for the toolbar.
 *
 * Updates "Xs ago" every second using a local interval.
 */

import { useEffect, useState } from 'react'

interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
  lastSaveTime: number | null
}

function getElapsedSeconds(lastSaveTime: number | null): number | null {
  if (lastSaveTime === null) return null
  return Math.floor((Date.now() - lastSaveTime) / 1000)
}

export function AutoSaveIndicator({ status, lastSaveTime }: AutoSaveIndicatorProps): JSX.Element {
  const [elapsed, setElapsed] = useState<number | null>(() => getElapsedSeconds(lastSaveTime))

  useEffect(() => {
    if (status !== 'saved' || lastSaveTime === null) {
      setElapsed(null)
      return
    }

    setElapsed(getElapsedSeconds(lastSaveTime))

    const handle = setInterval(() => {
      setElapsed(getElapsedSeconds(lastSaveTime))
    }, 1000)

    return () => clearInterval(handle)
  }, [status, lastSaveTime])

  if (status === 'idle') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888' }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#666',
          display: 'inline-block',
        }} />
        Autosave on
      </div>
    )
  }

  if (status === 'saving') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aaa' }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#f59e0b',
          display: 'inline-block',
          animation: 'pulse 1s infinite',
        }} />
        Saving...
      </div>
    )
  }

  if (status === 'saved') {
    const label = elapsed !== null ? `Saved ${elapsed}s ago` : 'Saved'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981' }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#10b981',
          display: 'inline-block',
        }} />
        {label}
      </div>
    )
  }

  // error
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ef4444' }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#ef4444',
        display: 'inline-block',
      }} />
      Save failed
    </div>
  )
}
