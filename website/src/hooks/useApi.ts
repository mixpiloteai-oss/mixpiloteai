import { useState, useEffect, useCallback, useRef } from 'react'

export interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Generic hook for API calls.
 * Handles loading state, error state, and manual refresh.
 *
 * Usage:
 *   const { data, loading, error, refresh } = useApi(() => projectsApi.list())
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseApiState<T> {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const fetcherRef            = useRef(fetcher)
  fetcherRef.current          = fetcher

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { void run() }, [run])

  return { data, loading, error, refresh: run }
}
