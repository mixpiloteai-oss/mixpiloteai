// ─── MixerEngine.ts ───────────────────────────────────────────────────────────
// Browser-only: requires Web Audio API.
// Singleton orchestration layer: bridges useMixerStore state → Web Audio graph.

import { ChannelStrip } from './ChannelStrip'
import { BusStrip }     from './BusStrip'
import { MasterStrip }  from './MasterStrip'
import { dBToLinear }   from './mixerMath'

interface SendConnection {
  gainNode: GainNode
  preFader: boolean
}

export class MixerEngine {
  private static _instance: MixerEngine | null = null

  private _ctx:      AudioContext
  private _channels: Map<string, ChannelStrip>              = new Map()
  private _buses:    Map<string, BusStrip>                  = new Map()
  private _sends:    Map<string, Map<string, SendConnection>> = new Map()
  private _master:   MasterStrip

  private constructor(ctx: AudioContext) {
    this._ctx    = ctx
    this._master = new MasterStrip(ctx)
  }

  static getInstance(ctx?: AudioContext): MixerEngine {
    if (!MixerEngine._instance) {
      if (!ctx) throw new Error('MixerEngine requires an AudioContext on first call')
      MixerEngine._instance = new MixerEngine(ctx)
    }
    return MixerEngine._instance
  }

  static reset(): void {
    MixerEngine._instance?.dispose()
    MixerEngine._instance = null
  }

  // ── Channel strips ────────────────────────────────────────────────────────

  createChannelStrip(trackId: string): ChannelStrip {
    if (this._channels.has(trackId)) return this._channels.get(trackId)!
    const strip = new ChannelStrip(trackId, this._ctx, this._master.gainNode)
    this._channels.set(trackId, strip)
    return strip
  }

  getChannelStrip(trackId: string): ChannelStrip | undefined {
    return this._channels.get(trackId)
  }

  removeChannelStrip(trackId: string): void {
    this._channels.get(trackId)?.dispose()
    this._channels.delete(trackId)
  }

  // ── Bus strips ────────────────────────────────────────────────────────────

  createBus(busId: string): BusStrip {
    if (this._buses.has(busId)) return this._buses.get(busId)!
    const bus = new BusStrip(busId, this._ctx, this._master.gainNode)
    this._buses.set(busId, bus)
    return bus
  }

  getBusStrip(busId: string): BusStrip | undefined {
    return this._buses.get(busId)
  }

  removeBus(busId: string): void {
    this._buses.get(busId)?.dispose()
    this._buses.delete(busId)
  }

  // ── Sends ─────────────────────────────────────────────────────────────────

  connectSend(fromTrackId: string, toTargetId: string, sendGainDb: number, preFader: boolean): void {
    const src = this._channels.get(fromTrackId)
    const dst = this._buses.get(toTargetId)
    if (!src || !dst) return

    const sendGain    = this._ctx.createGain()
    sendGain.gain.value = dBToLinear(sendGainDb)
    const srcNode     = preFader ? src.input : src.gainNode
    srcNode.connect(sendGain)
    sendGain.connect(dst.inputMix)

    if (!this._sends.has(fromTrackId)) this._sends.set(fromTrackId, new Map())
    this._sends.get(fromTrackId)!.set(toTargetId, { gainNode: sendGain, preFader })
  }

  disconnectSend(fromTrackId: string, toTargetId: string): void {
    const conn = this._sends.get(fromTrackId)?.get(toTargetId)
    if (conn) { conn.gainNode.disconnect(); this._sends.get(fromTrackId)!.delete(toTargetId) }
  }

  updateSendGain(fromTrackId: string, toTargetId: string, gainDb: number): void {
    const conn = this._sends.get(fromTrackId)?.get(toTargetId)
    if (conn) conn.gainNode.gain.setTargetAtTime(dBToLinear(gainDb), this._ctx.currentTime, 0.005)
  }

  // ── Sidechain ─────────────────────────────────────────────────────────────

  // Map tracking active sidechain connections: `${sourceId}→${targetId}` → cleanup fn
  private _sidechains: Map<string, () => void> = new Map()

  /**
   * Simplified ducking sidechain — not a true detector-controlled compressor.
   *
   * Implementation:
   *   1. Reads the source track's analyser (post-fader) each animation frame
   *      using a ScriptProcessorNode to compute RMS level.
   *   2. Maps that level to a gain reduction on a GainNode inserted before the
   *      target track's fader (the "duck gain").
   *   3. `amount` (0–1) controls how deeply the target is ducked: 0 = no
   *      ducking, 1 = full silence at source peak.
   *
   * Tear down by calling connectSidechain(sourceId, targetId, 0) or
   * disconnectSidechain(sourceId, targetId).
   */
  connectSidechain(sourceTrackId: string, targetTrackId: string, amount = 0.8): void {
    const scKey = `${sourceTrackId}→${targetTrackId}`

    // Tear down any existing sidechain for this pair
    this._sidechains.get(scKey)?.()
    this._sidechains.delete(scKey)

    if (amount <= 0) return   // amount=0 means disconnect only

    const src = this._channels.get(sourceTrackId)
    const dst = this._channels.get(targetTrackId)
    if (!src || !dst) {
      console.warn(`[MixerEngine] connectSidechain: missing strip(s) — source="${sourceTrackId}" target="${targetTrackId}"`)
      return
    }

    const ctx = this._ctx

    // Duck GainNode inserted between target input and target gainNode.
    // We do NOT re-wire the signal graph here; instead we modulate the target
    // strip's gainNode gain parameter directly, which achieves ducking without
    // a structural graph change.
    const analyser = ctx.createAnalyser()
    analyser.fftSize               = 256
    analyser.smoothingTimeConstant = 0.1

    // Connect source post-fader output (analyserL is the last node in ChannelStrip)
    src.analyserL.connect(analyser)

    // Use ScriptProcessorNode (deprecated but universally supported without
    // AudioWorklet registration overhead) to poll RMS and apply gain reduction.
    // bufferSize 256 gives ~5.8ms latency at 44.1 kHz — acceptable for ducking.
    const bufSize = 256
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const scriptNode = ctx.createScriptProcessor(bufSize, 1, 1)
    const analyserBuf = new Float32Array(analyser.fftSize)

    scriptNode.onaudioprocess = () => {
      analyser.getFloatTimeDomainData(analyserBuf)

      // Compute RMS
      let sumSq = 0
      for (let i = 0; i < analyserBuf.length; i++) sumSq += analyserBuf[i] * analyserBuf[i]
      const rms = Math.sqrt(sumSq / analyserBuf.length)

      // Map RMS → gain reduction: at rms=1.0 the target gain is reduced by `amount`
      const reduction  = Math.min(1, rms * 4)   // rms>0.25 triggers full duck
      const duckGain   = 1 - amount * reduction
      const now        = ctx.currentTime
      dst.gainNode.gain.setTargetAtTime(duckGain, now, 0.005)
    }

    // ScriptProcessorNode must be connected to the audio graph to receive callbacks
    analyser.connect(scriptNode)
    // Route script node to a silent destination (required to keep it active)
    const silentGain = ctx.createGain()
    silentGain.gain.value = 0
    scriptNode.connect(silentGain)
    silentGain.connect(ctx.destination)

    // Cleanup closure
    const cleanup = () => {
      scriptNode.onaudioprocess = null
      try { src.analyserL.disconnect(analyser)  } catch { /* ok */ }
      try { analyser.disconnect(scriptNode)      } catch { /* ok */ }
      try { scriptNode.disconnect(silentGain)    } catch { /* ok */ }
      try { silentGain.disconnect()              } catch { /* ok */ }
      // Restore target gainNode to its stored gain value
      const storedGain = dBToLinear(dst['_gainDb'] as number ?? 0)
      dst.gainNode.gain.setTargetAtTime(storedGain, ctx.currentTime, 0.005)
    }

    this._sidechains.set(scKey, cleanup)
  }

  /** Remove an active sidechain and restore target gain. */
  disconnectSidechain(sourceTrackId: string, targetTrackId: string): void {
    this.connectSidechain(sourceTrackId, targetTrackId, 0)
  }

  // ── Master ────────────────────────────────────────────────────────────────

  getMasterStrip(): MasterStrip {
    return this._master
  }

  // ── Sync from store ───────────────────────────────────────────────────────

  syncChannel(trackId: string, gainDb: number, pan: number, muted: boolean): void {
    const strip = this._channels.get(trackId)
    if (!strip) return
    strip.setGainDb(gainDb)
    strip.setPan(pan)
    strip.setMuted(muted)
  }

  syncBus(busId: string, gainDb: number, pan: number, muted: boolean): void {
    const bus = this._buses.get(busId)
    if (!bus) return
    bus.setGainDb(gainDb)
    bus.setPan(pan)
    bus.setMuted(muted)
  }

  syncMaster(limiterEnabled: boolean, limiterThresholdDb: number): void {
    this._master.enableLimiter(limiterEnabled)
    this._master.setLimiterThreshold(limiterThresholdDb)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  dispose(): void {
    for (const cleanup of this._sidechains.values()) cleanup()
    this._sidechains.clear()
    for (const ch of this._channels.values()) ch.dispose()
    for (const bus of this._buses.values()) bus.dispose()
    this._master.dispose()
    this._channels.clear()
    this._buses.clear()
    this._sends.clear()
  }
}
