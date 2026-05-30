/**
 * useTrackLevel
 *
 * Returns live ChannelLevel for a track channel, polled via rAF.
 * Returns master level when called with no trackId.
 *
 * Usage:
 *   const { rms, peak, dbfs } = useTrackLevel('kick')
 *   const master = useTrackLevel()
 */

import { useState, useEffect, useRef } from 'react'
import type { ChannelLevel } from '../audio/types'
import { getAudioEngine, getTrackManager } from '../audio'
import { AudioTrackNode } from '../audio/tracks/AudioTrackNode'
import { MidiTrackNode }  from '../audio/tracks/MidiTrackNode'

const ZERO_LEVEL: ChannelLevel = { rms: 0, peak: 0, dbfs: -Infinity }

export function useTrackLevel(trackId?: string): ChannelLevel {
  const [level, setLevel] = useState<ChannelLevel>(ZERO_LEVEL)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    function frame() {
      let next: ChannelLevel

      if (trackId) {
        const node = getTrackManager().getTrack(trackId)
        if (node instanceof AudioTrackNode || node instanceof MidiTrackNode) {
          next = node.getLevel()
        } else {
          next = ZERO_LEVEL
        }
      } else {
        next = getAudioEngine().getMasterLevel()
      }

      setLevel(next)
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [trackId])

  return level
}
