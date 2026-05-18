/**
 * Audio engine singletons
 *
 * Import from here everywhere — never construct engine classes directly.
 *
 * Lazy-initialised on first access so the AudioContext is only created
 * after the first user gesture (Electron suspends it otherwise).
 */

import { AudioEngine }     from './AudioEngine'
import { Transport }       from './Transport'
import { MetronomeEngine } from './MetronomeEngine'
import { WaveformLoader }  from './WaveformLoader'
import { TrackMixer }      from './TrackMixer'
import { WebAudioBridge }  from './AudioBridge'

let _engine:    AudioEngine     | null = null
let _transport: Transport       | null = null
let _metronome: MetronomeEngine | null = null
let _loader:    WaveformLoader  | null = null
let _mixer:     TrackMixer      | null = null
let _bridge:    WebAudioBridge  | null = null

export function getAudioEngine(): AudioEngine {
  if (!_engine) _engine = AudioEngine.getInstance()
  return _engine
}

export function getTransport(): Transport {
  if (!_transport) _transport = new Transport(getAudioEngine())
  return _transport
}

export function getMetronome(): MetronomeEngine {
  if (!_metronome) _metronome = new MetronomeEngine(getAudioEngine(), getTransport())
  return _metronome
}

export function getWaveformLoader(): WaveformLoader {
  if (!_loader) _loader = new WaveformLoader(getAudioEngine())
  return _loader
}

export function getTrackMixer(): TrackMixer {
  if (!_mixer) _mixer = new TrackMixer(getAudioEngine())
  return _mixer
}

export function getAudioBridge(): WebAudioBridge {
  if (!_bridge) {
    _bridge = new WebAudioBridge(getAudioEngine(), getTransport(), getWaveformLoader())
  }
  return _bridge
}

/** Call once on app start to pre-warm all singletons. */
export function initAudioEngine(): void {
  getAudioEngine()
  getTransport()
  getMetronome()
  getWaveformLoader()
  getTrackMixer()
  getAudioBridge()
}

// Re-export types and classes for convenience
export { AudioEngine }             from './AudioEngine'
export { Transport }               from './Transport'
export { MetronomeEngine }         from './MetronomeEngine'
export { WaveformLoader }          from './WaveformLoader'
export { TrackChannel, TrackMixer }from './TrackMixer'
export { WebAudioBridge }          from './AudioBridge'
export * from './types'
