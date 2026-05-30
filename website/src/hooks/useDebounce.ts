import { useState, useEffect } from 'react'

/**
 * Delays updating a value until after `delay` ms of inactivity.
 * Use for search inputs to avoid firing a request on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
