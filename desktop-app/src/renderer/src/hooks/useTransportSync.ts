/**
 * useTransportSync
 *
 * Drives the transport position display (bar/beat/tick) via requestAnimationFrame.
 *
 * Why rAF instead of Zustand/onBeat?
 *   - onBeat fires 100 ms ahead of actual playback (look-ahead scheduler)
 *   - setState on every beat would cause unnecessary re-renders at BPMs above ~60
 *   - rAF reads Clock.position (derived from AudioContext.currentTime) and
 *     updates the store only when bar or beat actually changed
 *   - This gives smooth, correct display at 60 fps with minimal overhead
 *
 * Mount this hook once at the app root (e.g. in App.tsx or a layout component).
 */

import { useEffect, useRef } from 'react'
import { getTransport } from '../audio'
import { useTransportStore } from '../store/transportStore'

export function useTransportSync(): void {
  const syncPosition = useTransportStore(s => s._syncPosition)
  const rafRef = useRef<number>(0)
  const prevRef = useRef({ bar: 1, beat: 1, tick: 0 })

  useEffect(() => {
    const transport = getTransport()

    function frame() {
      const pos = transport.getPosition()

      // Only call set when something changed (avoids redundant re-renders)
      if (
        pos.bar  !== prevRef.current.bar  ||
        pos.beat !== prevRef.current.beat ||
        pos.tick !== prevRef.current.tick
      ) {
        prevRef.current = pos
        syncPosition(pos.bar, pos.beat, pos.tick)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [syncPosition])
}
