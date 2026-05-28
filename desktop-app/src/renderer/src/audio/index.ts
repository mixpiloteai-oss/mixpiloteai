/**
 * Audio engine singletons
 *
 * Import from here everywhere — never construct engine classes directly.
 *
 * Lazy-initialised on first access so the AudioContext is only created
 * after the first user gesture (Electron suspends it otherwise).
 *
 * Layer map:
 *   AudioEngine     — Web Audio context + master bus
 *   Transport       — play/stop/loop/BPM (drives Clock)
 *   MetronomeEngine — oscillator click track
 *   WaveformLoader  — AudioBuffer LRU cache
 *   TrackMixer      — low-level channel strips (gain/pan/analyser)
 *   BusRouter       — send/return bus routing
 *   AutomationEngine— parameter automation record/playback
 *   LatencyCompensator — PDC via DelayNodes
 *   MonitorEngine   — input monitoring + cue bus
 *   TrackManager    — high-level track orchestrator
 *   WebAudioBridge  — IAudioBridge implementation
 */

import { AudioEngine }                from './AudioEngine'
import { Transport }                  from './Transport'
import { MetronomeEngine }            from './MetronomeEngine'
import { WaveformLoader }             from './WaveformLoader'
import { TrackMixer }                 from './TrackMixer'
import { WebAudioBridge }             from './AudioBridge'
import { BusRouter }                  from './BusRouter'
import { AutomationEngine }           from './AutomationEngine'
import { LatencyCompensator }         from './LatencyCompensator'
import { MonitorEngine }              from './MonitorEngine'
import { TrackManager }               from './tracks/TrackManager'
import { AudioTrackNode }             from './tracks/AudioTrackNode'
import { ClipPlaybackCoordinator }    from './ClipPlaybackCoordinator'
import { useMixerStore }              from '../components/mixer/useMixerStore'
import type { EQBand as StoreEQBand } from '../components/mixer/useMixerStore'
import type { EQBand as DspEQBand }   from './EqChain'

// ─── Singletons ───────────────────────────────────────────────────────────────

let _engine:      AudioEngine              | null = null
let _transport:   Transport                | null = null
let _metronome:   MetronomeEngine          | null = null
let _loader:      WaveformLoader           | null = null
let _mixer:       TrackMixer               | null = null
let _bridge:      WebAudioBridge           | null = null
let _busRouter:   BusRouter                | null = null
let _automation:  AutomationEngine         | null = null
let _latency:     LatencyCompensator       | null = null
let _monitor:     MonitorEngine            | null = null
let _trackMgr:    TrackManager             | null = null
let _coordinator: ClipPlaybackCoordinator  | null = null

// ─── Accessors ────────────────────────────────────────────────────────────────

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

export function getBusRouter(): BusRouter {
  if (!_busRouter) _busRouter = new BusRouter(getAudioEngine())
  return _busRouter
}

export function getAutomationEngine(): AutomationEngine {
  if (!_automation) _automation = new AutomationEngine()
  return _automation
}

export function getLatencyCompensator(): LatencyCompensator {
  if (!_latency) _latency = new LatencyCompensator(getAudioEngine())
  return _latency
}

export function getMonitorEngine(): MonitorEngine {
  if (!_monitor) _monitor = new MonitorEngine(getAudioEngine())
  return _monitor
}

export function getTrackManager(): TrackManager {
  if (!_trackMgr) {
    _trackMgr = new TrackManager(
      getAudioEngine(),
      getBusRouter(),
      getLatencyCompensator(),
      getAutomationEngine(),
    )
  }
  return _trackMgr
}

export function getClipPlaybackCoordinator(): ClipPlaybackCoordinator {
  if (!_coordinator) {
    _coordinator = new ClipPlaybackCoordinator(getTransport(), getTrackManager())
    // Register with transport so play/stop/seek call through to coordinator
    getTransport().setCoordinator(_coordinator)
  }
  return _coordinator
}

// ─── EQ band type conversion ──────────────────────────────────────────────────

/** Map mixer store EQ band type strings to Web Audio BiquadFilterType. */
function toWebAudioFilterType(type: StoreEQBand['type']): BiquadFilterType {
  switch (type) {
    case 'peak':      return 'peaking'
    case 'lowshelf':  return 'lowshelf'
    case 'highshelf': return 'highshelf'
    case 'highpass':  return 'highpass'
    case 'lowpass':   return 'lowpass'
    default:          return 'peaking'
  }
}

function storeToEqBands(storeBands: StoreEQBand[]): DspEQBand[] {
  return storeBands.map((b, i) => ({
    id:      `eq${i}`,
    type:    toWebAudioFilterType(b.type),
    freq:    b.freq,
    gain:    b.gain,
    q:       b.q,
    enabled: b.enabled,
  }))
}

// ─── Mixer store → EQ subscription ───────────────────────────────────────────

let _mixerUnsub: (() => void) | null = null

function _wireMixerStoreToEq(): void {
  if (_mixerUnsub) return  // already subscribed

  // Only re-run when the channels object reference changes (EQ/FX edits)
  _mixerUnsub = useMixerStore.subscribe((state, prev) => {
    if (state.channels === prev.channels) return
    const tm = _trackMgr
    if (!tm) return
    for (const [trackId, ch] of Object.entries(state.channels)) {
      const node = tm.getTrack(trackId)
      if (!(node instanceof AudioTrackNode)) continue
      node.eq.update(storeToEqBands(ch.eqBands))
      node.eq.setEnabled(ch.eqEnabled)
    }
  })
}

/** Tear down the mixer-store→EQ subscription (call on engine reset). */
export function disposeEqSubscription(): void {
  _mixerUnsub?.()
  _mixerUnsub = null
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/** Pre-warm all singletons. Call once after first user gesture. */
export function initAudioEngine(): void {
  getAudioEngine()
  getTransport()
  getMetronome()
  getWaveformLoader()
  getTrackMixer()
  getAudioBridge()
  getBusRouter()
  getAutomationEngine()
  getLatencyCompensator()
  getMonitorEngine()
  getTrackManager()
  getClipPlaybackCoordinator()

  // Wire mixer store EQ state to AudioTrackNode EQ chains
  _wireMixerStoreToEq()
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { AudioEngine }                          from './AudioEngine'
export { Transport }                            from './Transport'
export { MetronomeEngine }                      from './MetronomeEngine'
export { WaveformLoader }                       from './WaveformLoader'
export { TrackChannel, TrackMixer }             from './TrackMixer'
export { WebAudioBridge }                       from './AudioBridge'
export { BusRouter }                            from './BusRouter'
export { AutomationEngine }                     from './AutomationEngine'
export { LatencyCompensator }                   from './LatencyCompensator'
export { MonitorEngine }                        from './MonitorEngine'
export { RecordingEngine }                      from './RecordingEngine'
export { AudioTrackNode }                       from './tracks/AudioTrackNode'
export { MidiTrackNode }                        from './tracks/MidiTrackNode'
export { BusTrackNode }                         from './tracks/BusTrackNode'
export { TrackManager }                         from './tracks/TrackManager'
export { ClipPlaybackCoordinator, PreviewScheduler } from './ClipPlaybackCoordinator'
export * from './types'
