export type TrackType = 'midi' | 'audio' | 'bus' | 'master'

export interface MidiNote {
  id: string
  pitch: number       // 0-127
  startBeat: number   // beat within pattern
  lengthBeats: number
  velocity: number    // 0-127
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
