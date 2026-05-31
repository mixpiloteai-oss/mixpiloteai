export type TrackType = 'midi' | 'audio' | 'bus' | 'master'

export interface MidiNote {
  id: string
  pitch: number         // 0-127
  startBeat: number     // beat within pattern
  lengthBeats: number
  velocity: number      // 0-127
  probability?: number  // 0–100, 100 = always plays (default when absent)
}

export interface Clip {
  id: string
  trackId: string
  name: string
  startBar: number    // 1-based
  lengthBars: number
  color: string
  muted: boolean
  notes: MidiNote[]
  playbackRate?: number  // 1.0 = normal; stretch factor for timestretch
  clipGainDb?: number    // per-clip gain offset, default 0 dB
  fadeInSec?: number     // fade-in duration in seconds, default 0
  fadeOutSec?: number    // fade-out duration in seconds, default 0
  audioFilePath?: string // path to audio file (for audio clips)
}

export interface TrackSend {
  targetId: string
  gainDb: number
  enabled: boolean
}

export interface Track {
  id: string
  name: string
  type: TrackType
  color: string
  clips: Clip[]
  gainDb: number   // fader level
  panCenter: number  // -1 (L) to +1 (R)
  muted: boolean
  soloed: boolean
  armed: boolean
  sends: TrackSend[]
  height: number
}

export interface Project {
  id: string
  name: string
  bpm: number
  timeSignatureNumerator: number
  timeSignatureDenominator: number
  sampleRate: number
  tracks: Track[]
  masterGainDb: number
  loopStart: number
  loopEnd: number
  totalBars: number
}
