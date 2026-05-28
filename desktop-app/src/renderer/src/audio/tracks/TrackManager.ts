/**
 * TrackManager — high-level track lifecycle orchestrator
 *
 * Sits above TrackMixer and coordinates:
 *   - Track creation / deletion (audio, MIDI, bus)
 *   - Solo logic across all tracks
 *   - Send routing through BusRouter
 *   - Latency compensation registration
 *   - Automation applicator wiring
 *
 * One TrackManager per project session.
 */

import { AudioEngine, dbToGain }    from '../AudioEngine'
import { BusRouter }                from '../BusRouter'
import { LatencyCompensator }       from '../LatencyCompensator'
import { AutomationEngine }         from '../AutomationEngine'
import { AudioTrackNode }           from './AudioTrackNode'
import { MidiTrackNode }            from './MidiTrackNode'
import { BusTrackNode, type BusType } from './BusTrackNode'
import type { ChannelLevel }        from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrackKind = 'audio' | 'midi' | 'bus' | 'master'

export interface TrackConfig {
  id:      string
  name:    string
  kind:    TrackKind
  color?:  string
  gainDb?: number
  pan?:    number
  busType?: BusType
}

export interface SendConfig {
  fromId:   string
  toId:     string
  gainDb:   number
  preFader: boolean
  enabled:  boolean
}

// Union type for the three node kinds
type TrackNode = AudioTrackNode | MidiTrackNode | BusTrackNode

// ─── TrackManager ─────────────────────────────────────────────────────────────

export class TrackManager {
  private readonly engine:      AudioEngine
  private readonly busRouter:   BusRouter
  private readonly latency:     LatencyCompensator
  private readonly automation:  AutomationEngine

  private _tracks:  Map<string, { cfg: TrackConfig; node: TrackNode }> = new Map()
  private _sends:   Map<string, SendConfig[]> = new Map()   // fromId → sends[]

  constructor(
    engine:     AudioEngine,
    busRouter:  BusRouter,
    latency:    LatencyCompensator,
    automation: AutomationEngine,
  ) {
    this.engine     = engine
    this.busRouter  = busRouter
    this.latency    = latency
    this.automation = automation

    // Wire automation applicator to the track manager's param setter
    automation.setApplicator((trackId, paramName, value) => {
      this.applyParam(trackId, paramName, value)
    })
  }

  // ── Track lifecycle ───────────────────────────────────────────────────────

  addTrack(cfg: TrackConfig): TrackNode {
    if (this._tracks.has(cfg.id)) return this._tracks.get(cfg.id)!.node

    let node: TrackNode

    switch (cfg.kind) {
      case 'audio':
        node = new AudioTrackNode(cfg.id, cfg.name, this.engine, this.engine.masterInput)
        break
      case 'midi':
        node = new MidiTrackNode(cfg.id, cfg.name, this.engine, this.engine.masterInput)
        break
      case 'bus':
      case 'master':
        node = new BusTrackNode(
          cfg.id, cfg.name, cfg.busType ?? 'return',
          this.engine, this.engine.masterInput,
        )
        break
    }

    if (cfg.gainDb !== undefined) this._applyGain(node, cfg.gainDb)
    if (cfg.pan    !== undefined) this._applyPan(node, cfg.pan)

    this._tracks.set(cfg.id, { cfg, node })
    this._sends.set(cfg.id, [])
    return node
  }

  removeTrack(id: string): void {
    const entry = this._tracks.get(id)
    if (!entry) return

    // Remove all sends from this track
    const sends = this._sends.get(id) ?? []
    for (const s of sends) this.busRouter.removeSend(s.fromId, s.toId)

    this.latency.unregisterTrack(id)
    entry.node.dispose()
    this._tracks.delete(id)
    this._sends.delete(id)
    this._updateSolo()
  }

  getTrack(id: string): TrackNode | undefined { return this._tracks.get(id)?.node }
  getTrackIds(): string[] { return [...this._tracks.keys()] }

  // ── Channel strip setters ────────────────────────────────────────────────

  setGain(trackId: string, db: number): void {
    const node = this._tracks.get(trackId)?.node
    if (node) this._applyGain(node, db)
  }

  setPan(trackId: string, pan: number): void {
    const node = this._tracks.get(trackId)?.node
    if (node) this._applyPan(node, pan)
  }

  setMuted(trackId: string, muted: boolean): void {
    const node = this._tracks.get(trackId)?.node
    if (!node) return
    if (node instanceof BusTrackNode) { node.setMuted(muted); return }
    node.setMuted(muted)
  }

  setSoloed(trackId: string, soloed: boolean): void {
    const entry = this._tracks.get(trackId)
    if (!entry) return
    const node = entry.node
    if (node instanceof AudioTrackNode || node instanceof MidiTrackNode) {
      node.setSoloed(soloed)
      entry.cfg = { ...entry.cfg }  // trigger update
      this._updateSolo()
    }
  }

  setArmed(trackId: string, armed: boolean): void {
    const node = this._tracks.get(trackId)?.node
    if (node instanceof AudioTrackNode || node instanceof MidiTrackNode) node.setArmed(armed)
  }

  // ── Send management ───────────────────────────────────────────────────────

  addSend(cfg: SendConfig): void {
    const fromEntry = this._tracks.get(cfg.fromId)
    if (!fromEntry) return

    // Ensure the destination bus exists
    const toBus = this._tracks.get(cfg.toId)?.node
    if (!(toBus instanceof BusTrackNode)) {
      console.warn(`[TrackManager] send target "${cfg.toId}" is not a bus`)
      return
    }

    const fromNode = fromEntry.node
    let   preFaderSrc: AudioNode
    let   postFaderSrc: AudioNode

    if (fromNode instanceof AudioTrackNode) {
      preFaderSrc  = fromNode.preFaderNode
      postFaderSrc = fromNode.analyserNode
    } else if (fromNode instanceof MidiTrackNode) {
      preFaderSrc  = fromNode.gainNode   // MIDI track: both pre/post same
      postFaderSrc = fromNode.analyserNode
    } else {
      return  // can't send from a bus to another bus easily
    }

    this.busRouter.addSend(
      { fromId: cfg.fromId, toId: cfg.toId, gainDb: cfg.gainDb, preFader: cfg.preFader, enabled: cfg.enabled },
      preFaderSrc,
      postFaderSrc,
    )

    const sends = this._sends.get(cfg.fromId) ?? []
    const idx   = sends.findIndex(s => s.toId === cfg.toId)
    if (idx >= 0) sends[idx] = cfg
    else sends.push(cfg)
    this._sends.set(cfg.fromId, sends)
  }

  removeSend(fromId: string, toId: string): void {
    this.busRouter.removeSend(fromId, toId)
    const sends = this._sends.get(fromId)
    if (sends) this._sends.set(fromId, sends.filter(s => s.toId !== toId))
  }

  setSendGain(fromId: string, toId: string, db: number): void {
    this.busRouter.setSendGain(fromId, toId, db)
    const sends = this._sends.get(fromId)
    if (sends) {
      const s = sends.find(s => s.toId === toId)
      if (s) s.gainDb = db
    }
  }

  // ── Latency compensation ──────────────────────────────────────────────────

  reportPluginLatency(trackId: string, frames: number): void {
    const node = this._tracks.get(trackId)?.node
    if (!node || node instanceof BusTrackNode) return
    // Register insertion point if not already
    const insertOut = node instanceof AudioTrackNode ? node.analyserNode : (node as MidiTrackNode).analyserNode
    const insertIn  = node instanceof AudioTrackNode ? node.input        : (node as MidiTrackNode).synthInput
    this.latency.registerTrack(trackId, insertIn, insertOut)
    this.latency.setPluginLatency(trackId, frames)
  }

  // ── Automation ────────────────────────────────────────────────────────────

  /** Apply an automation value to a track param (called by AutomationEngine).
   *  Uses linearRampToValueAtTime for smooth 16ms transitions between automation points.
   */
  applyParam(trackId: string, paramName: string, value: number): void {
    const node = this._tracks.get(trackId)?.node
    if (!node) return

    const ctx = this.engine.ctx
    const now = ctx.currentTime

    switch (paramName) {
      case 'gainDb': {
        // Apply directly to the gainNode AudioParam for smooth automation
        const gainNode = node instanceof AudioTrackNode ? node.gainNode
          : node instanceof MidiTrackNode ? node.gainNode
          : (node as BusTrackNode).gainNode
        const targetLinear = dbToGain(value)
        gainNode.gain.cancelScheduledValues(now)
        gainNode.gain.setValueAtTime(gainNode.gain.value, now)
        gainNode.gain.linearRampToValueAtTime(targetLinear, now + 0.016)
        break
      }
      case 'pan': {
        const panParam = node instanceof AudioTrackNode ? node.panNode.pan
          : node instanceof MidiTrackNode ? node.panNode.pan
          : (node as BusTrackNode).panNode.pan
        panParam.cancelScheduledValues(now)
        panParam.setValueAtTime(panParam.value, now)
        panParam.linearRampToValueAtTime(value, now + 0.016)
        break
      }
      default:
        if (paramName.startsWith('send:')) {
          const busId = paramName.slice(5)
          this.busRouter.setSendGain(trackId, busId, value)
        }
    }
  }

  // ── Metering ─────────────────────────────────────────────────────────────

  getAllLevels(): Record<string, ChannelLevel> {
    const out: Record<string, ChannelLevel> = {}
    for (const [id, { node }] of this._tracks) {
      out[id] = node.getLevel()
    }
    return out
  }

  // ── Solo logic ───────────────────────────────────────────────────────────

  private _updateSolo(): void {
    let anySoloed = false
    for (const { node } of this._tracks.values()) {
      if ((node instanceof AudioTrackNode || node instanceof MidiTrackNode) && node.soloed) {
        anySoloed = true; break
      }
    }
    for (const { node } of this._tracks.values()) {
      if (node instanceof AudioTrackNode || node instanceof MidiTrackNode) {
        node.setSoloMuted(anySoloed && !node.soloed)
      }
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _applyGain(node: TrackNode, db: number): void { node.setGain(db) }
  private _applyPan(node: TrackNode, pan: number): void  { node.setPan(pan) }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  dispose(): void {
    for (const [id] of this._tracks) this.removeTrack(id)
    this.busRouter.dispose()
    this.latency.dispose()
    this.automation.dispose()
  }
}
