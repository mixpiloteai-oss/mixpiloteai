/**
 * HotkeyToast — 1.5 s flash notification showing the triggered action label.
 */

import React, { useState, useEffect, useCallback } from 'react'

interface ToastEntry {
  id:    number
  label: string
}

let _nextId = 0

// Module-level subscribers so any component can trigger a toast
type Subscriber = (entry: ToastEntry) => void
const _subscribers = new Set<Subscriber>()

export function showHotkeyToast(label: string): void {
  const entry: ToastEntry = { id: ++_nextId, label }
  for (const sub of _subscribers) sub(entry)
}

const TOAST_DURATION_MS = 1500

export function HotkeyToast(): React.ReactElement {
  const [entries, setEntries] = useState<ToastEntry[]>([])

  const addEntry = useCallback((entry: ToastEntry) => {
    setEntries(prev => [...prev, entry])
    setTimeout(() => {
      setEntries(prev => prev.filter(e => e.id !== entry.id))
    }, TOAST_DURATION_MS)
  }, [])

  useEffect(() => {
    _subscribers.add(addEntry)
    return () => { _subscribers.delete(addEntry) }
  }, [addEntry])

  if (entries.length === 0) return <></>

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-50"
      aria-live="polite"
    >
      {entries.map(entry => (
        <div
          key={entry.id}
          className="px-4 py-2 rounded-lg bg-neutral-900/90 border border-neutral-700 text-neutral-100 text-sm font-medium shadow-lg animate-fade-in"
        >
          {entry.label}
        </div>
      ))}
    </div>
  )
}
