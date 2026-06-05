/**
 * MixerGraph — unified facade over TrackMixer + BusRouter.
 *
 * Provides a single entry point for:
 *   - Track channel operations (gain, pan, mute, solo)
 *   - Send/return bus management
 *   - Master bus metering
 *   - Sidechain ducking connections
 *
 * All GainNode parameter changes use setTargetAtTime for smooth, click-free
 * transitions rather than direct .value assignments.
 *
 * Usage (via audio/index.ts singletons):
 *   const graph = getMixerGraph()
 *   graph.setTrackGain('track1', -6)      // dB
 *   graph.setTrackPan('track1', 0.5)      // -1..1
 *   graph.muteTrack('track1', true)
 *   graph.getMasterPeakLinear()           // 0..1
 */

import type { AudioEngine }  from './AudioEngine'
import type { TrackMixer }   from './TrackMixer'
import type { BusRouter }    from './BusRouter'
import type { MixerEngine }  from './MixerEngine'
import { dBToLinear }        from './mixerMath'

const SMOOTH_TC = 0.005   // 5ms time constant for smooth parameter changes

export interface TrackGainState {
  gainDb:   number
  pan:      number
  muted:    boolean
  soloed:   boolean
}

export class MixerGraph {
  private readonly _engine:  AudioEngine
  private readonly _mixer:   TrackMixer
  private readonly _router:  BusRouter
  private readonly _legacy:  MixerEngine

  // Per-track state cache (db values for restoration after mute/unmute)
  private _state: Map<string, TrackGainState> = new Map()

  constructor(engine: AudioEngine, mixer: TrackMixer, router: BusRouter, legacy: MixerEngine) {
    this._engine = engine
    this._mixer  = mixer
    this._router = router
    this._legacy = legacy
  }

  // ── Channel operations ───────────────────────────────────────────────────────

  /** Set track gain in dB. Range: -∞ (−96) to +12 dB. */
  setTrackGain(trackId: string, gainDb: number): void {
    const clamped = Math.max(-96, Math.min(12, gainDb))
    this._getState(trackId).gainDb = clamped
    this._mixer.getChannel(trackId)?.setGain(clamped)
  }

  /** Set track pan. Range: -1.0 (full left) to +1.0 (full right). */
  setTrackPan(trackId: string, pan: number): void {
    const clamped = Math.max(-1, Math.min(1, pan))
    this._getState(trackId).pan = clamped
    this._mixer.getChannel(trackId)?.setPan(clamped)
  }

  /** Mute or unmute a track. Preserves gain state across mute/unmute. */
  muteTrack(trackId: string, muted: boolean): void {
    this._getState(trackId).muted = muted
    this._mixer.getChannel(trackId)?.setMuted(muted)
  }

  /** Solo a track. Applies solo logic across all registered tracks. */
  soloTrack(trackId: string, soloed: boolean): void {
    this._getState(trackId).soloed = soloed
    this._mixer.getChannel(trackId)?.setSoloed(soloed)
  }

  // ── Send bus operations ───────────────────────────────────────────────────────

  /** Set send level from a track to a bus (in dB). */
  setSendLevel(trackId: string, busId: string, gainDb: number): void {
    this._router.setSendGain(trackId, busId, gainDb)
  }

  /** Connect a track to a send bus. (Use BusRouter.addSend directly for full configuration.) */
  connectSend(_trackId: string, _busId: string, _gainDb = -6): void {
    // Full send routing requires AudioNode references — use BusRouter.addSend directly.
    // This method is a placeholder for convenience API discovery.
  }

  /** Disconnect a track from a send bus. */
  disconnectSend(fromId: string, toId: string): void {
    this._router.removeSend(fromId, toId)
  }

  // ── Sidechain ────────────────────────────────────────────────────────────────

  /** Connect a sidechain from sourceTrackId to duck targetTrackId. */
  connectSidechain(sourceTrackId: string, targetTrackId: string, amount = 0.8): void {
    this._legacy.connectSidechain(sourceTrackId, targetTrackId, amount)
  }

  /** Remove a sidechain connection. */
  disconnectSidechain(sourceTrackId: string, targetTrackId: string): void {
    this._legacy.disconnectSidechain(sourceTrackId, targetTrackId)
  }

  // ── Master bus metering ───────────────────────────────────────────────────────

  /** Returns master peak level as a linear gain value (0..1+). */
  getMasterPeakLinear(): number {
    const buf = new Float32Array(this._engine.masterAnalyser.fftSize)
    this._engine.masterAnalyser.getFloatTimeDomainData(buf)
    let peak = 0
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i])
      if (v > peak) peak = v
    }
    return peak
  }

  /** Returns master peak level in dBFS. */
  getMasterPeakDb(): number {
    const peak = this.getMasterPeakLinear()
    return peak > 0 ? 20 * Math.log10(peak) : -Infinity
  }

  /** Returns master RMS level as a linear gain value. */
  getMasterRmsLinear(): number {
    const buf = new Float32Array(this._engine.masterAnalyser.fftSize)
    this._engine.masterAnalyser.getFloatTimeDomainData(buf)
    let sumSq = 0
    for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i]
    return Math.sqrt(sumSq / buf.length)
  }

  // ── State ────────────────────────────────────────────────────────────────────

  getTrackState(trackId: string): Readonly<TrackGainState> {
    return this._getState(trackId)
  }

  private _getState(trackId: string): TrackGainState {
    if (!this._state.has(trackId)) {
      this._state.set(trackId, { gainDb: 0, pan: 0, muted: false, soloed: false })
    }
    return this._state.get(trackId)!
  }

  // Expose dBToLinear for callers that need it
  static dBToLinear = dBToLinear

  // Expose smooth time constant
  static SMOOTH_TC = SMOOTH_TC
}
