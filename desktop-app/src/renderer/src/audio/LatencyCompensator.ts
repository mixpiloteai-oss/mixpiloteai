/**
 * LatencyCompensator — Plugin Delay Compensation (PDC)
 *
 * When a plugin (VST / AudioWorklet) reports a latency of N frames,
 * all OTHER tracks must be delayed by N frames so audio stays in sync.
 *
 * Implementation: each track gets a DelayNode whose delayTime is set to
 * (maxPluginLatency - ownLatency) / sampleRate seconds.
 *
 * Call recalculate() after any plugin latency changes.
 */

import { AudioEngine } from './AudioEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrackLatencyEntry {
  trackId:        string
  pluginLatency:  number  // frames reported by plugin chain
}

// ─── LatencyCompensator ───────────────────────────────────────────────────────

export class LatencyCompensator {
  private readonly engine:      AudioEngine
  private delays:               Map<string, DelayNode>  = new Map()
  private pluginLatencies:      Map<string, number>     = new Map()  // trackId → frames
  private maxLatency            = 0

  // Map from trackId → { inputNode, outputNode } — the splicing points
  private insertionPoints: Map<string, { input: AudioNode; output: AudioNode }> = new Map()

  constructor(engine: AudioEngine) {
    this.engine = engine
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  /** Report plugin latency for a track (call after loading/removing a plugin). */
  setPluginLatency(trackId: string, frames: number): void {
    this.pluginLatencies.set(trackId, Math.max(0, frames))
    this.recalculate()
  }

  /** Register the splice point for a track (where the compensating delay is inserted). */
  registerTrack(trackId: string, inputNode: AudioNode, outputNode: AudioNode): void {
    this.insertionPoints.set(trackId, { input: inputNode, output: outputNode })
  }

  unregisterTrack(trackId: string): void {
    this._removeDelay(trackId)
    this.insertionPoints.delete(trackId)
    this.pluginLatencies.delete(trackId)
    this.recalculate()
  }

  // ── Recalculation ─────────────────────────────────────────────────────────

  /**
   * Recomputes compensating delays for all registered tracks.
   * Safe to call from the UI thread; DelayNode.delayTime is AudioParam.
   */
  recalculate(): void {
    let max = 0
    for (const v of this.pluginLatencies.values()) {
      if (v > max) max = v
    }
    this.maxLatency = max

    for (const [trackId, point] of this.insertionPoints) {
      const own       = this.pluginLatencies.get(trackId) ?? 0
      const compensate = max - own  // frames we need to add

      if (compensate <= 0) {
        this._removeDelay(trackId)
        continue
      }

      const delaySec = compensate / this.engine.ctx.sampleRate
      let   delay    = this.delays.get(trackId)

      if (!delay) {
        // Create and insert a new DelayNode
        const maxDelaySec = 4096 / this.engine.ctx.sampleRate  // up to 4096 frames
        delay = this.engine.ctx.createDelay(maxDelaySec)

        // Splice: input → delay → output (output was previously connected to something)
        // This requires the caller to have set up the insertion point correctly.
        delay.connect(point.output)
        point.input.connect(delay)

        this.delays.set(trackId, delay)
      }

      delay.delayTime.setTargetAtTime(delaySec, this.engine.ctx.currentTime, 0.002)
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getMaxLatency(): number { return this.maxLatency }
  getMaxLatencyMs(): number { return (this.maxLatency / this.engine.ctx.sampleRate) * 1000 }
  getTrackCompensation(trackId: string): number {
    return Math.max(0, this.maxLatency - (this.pluginLatencies.get(trackId) ?? 0))
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _removeDelay(trackId: string): void {
    const delay = this.delays.get(trackId)
    if (!delay) return
    delay.disconnect()
    this.delays.delete(trackId)
  }

  dispose(): void {
    for (const [trackId] of this.delays) this._removeDelay(trackId)
    this.insertionPoints.clear()
    this.pluginLatencies.clear()
  }
}
