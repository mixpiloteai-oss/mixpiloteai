// ─── MixerEngine.ts ───────────────────────────────────────────────────────────
// Browser-only: requires Web Audio API.
// Singleton orchestration layer: bridges useMixerStore state → Web Audio graph.

import { ChannelStrip } from './ChannelStrip.ts'
import { BusStrip }     from './BusStrip.ts'
import { MasterStrip }  from './MasterStrip.ts'
import { dBToLinear }   from './mixerMath.ts'

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

  connectSidechain(sourceTrackId: string, targetTrackId: string): void {
    // Sidechain wiring via AudioWorklet or DynamicsCompressorNode is plugin-specific.
    // This stub records the intent; actual wiring is handled by FxInsertChain.
    void sourceTrackId; void targetTrackId
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
    for (const ch of this._channels.values()) ch.dispose()
    for (const bus of this._buses.values()) bus.dispose()
    this._master.dispose()
    this._channels.clear()
    this._buses.clear()
    this._sends.clear()
  }
}
