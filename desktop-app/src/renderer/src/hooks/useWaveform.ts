/**
 * useWaveform
 *
 * Async hook that loads an audio file and returns its WaveformData.
 *
 * Usage:
 *   const { waveform, loading, error } = useWaveform(clipUrl, 200)
 *
 * Returns null waveform while loading or on error.
 * Re-runs when url or width changes.
 */

import { useState, useEffect } from 'react'
import type { WaveformData } from '../audio/types'
import { getWaveformLoader } from '../audio'

interface UseWaveformResult {
  waveform: WaveformData | null
  loading:  boolean
  error:    string | null
}

export function useWaveform(url: string | null | undefined, width: number): UseWaveformResult {
  const [waveform, setWaveform] = useState<WaveformData | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!url || width <= 0) {
      setWaveform(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getWaveformLoader()
      .getWaveform(url, width)
      .then(data => {
        if (!cancelled) { setWaveform(data); setLoading(false) }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [url, width])

  return { waveform, loading, error }
}
