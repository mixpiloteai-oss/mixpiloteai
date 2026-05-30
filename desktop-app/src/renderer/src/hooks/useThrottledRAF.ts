/**
 * useThrottledRAF — Throttled requestAnimationFrame hook.
 *
 * Use this hook in canvas components instead of raw `requestAnimationFrame`
 * to respect the active performance mode's FPS cap (`throttleCanvasFPS`).
 *
 * When `throttleCanvasFPS` is 0 (quality / unlimited mode), frames are
 * dispatched on every animation frame tick (i.e. unthrottled).
 *
 * Usage:
 *   const startLoop = useThrottledRAF((time) => { drawCanvas(time) })
 *   useEffect(() => startLoop(), [startLoop])
 *
 * The returned start function returns a cleanup callback compatible with
 * the useEffect cleanup convention.
 */

import { useRef, useCallback } from 'react'
import { usePerfConfig } from '../store/performanceModeStore'

export function useThrottledRAF(callback: (time: number) => void): () => () => void {
  const config      = usePerfConfig()
  const lastTimeRef = useRef(0)
  const rafRef      = useRef<number>(0)

  const tick = useCallback((time: number) => {
    const minInterval = config.throttleCanvasFPS > 0 ? 1000 / config.throttleCanvasFPS : 0
    if (time - lastTimeRef.current >= minInterval) {
      lastTimeRef.current = time
      callback(time)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [callback, config.throttleCanvasFPS])

  const start = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  return start
}
