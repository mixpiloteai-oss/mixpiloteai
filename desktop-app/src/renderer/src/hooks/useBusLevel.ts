/**
 * useBusLevel
 *
 * Returns live ChannelLevel for a bus channel, polled via rAF.
 * Polls BusTrackNode.getLevel() through TrackManager.
 *
 * Usage:
 *   const { rms, peak, dbfs } = useBusLevel('bus-master')
 */

import { useState, useEffect, useRef } from 'react'
import type { ChannelLevel } from '../audio/types'
import { getTrackManager } from '../audio'
import { BusTrackNode } from '../audio/tracks/BusTrackNode'

const ZERO_LEVEL: ChannelLevel = { rms: 0, peak: 0, dbfs: -Infinity }

export function useBusLevel(busId: string): ChannelLevel {
  const [level, setLevel] = useState<ChannelLevel>(ZERO_LEVEL)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    function frame() {
      const node = getTrackManager().getTrack(busId)
      let next: ChannelLevel
      if (node instanceof BusTrackNode) {
        next = node.getLevel()
      } else {
        next = ZERO_LEVEL
      }
      setLevel(next)
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [busId])

  return level
}
