// ─── AutomationRecorder.ts ────────────────────────────────────────────────────
// Records automation changes during playback with rate-limiting.

import type { AutomationChange } from './AutomationTypes'
import type { AutomationEngine } from './AutomationEngine'

class AutomationRecorder {
  private _recording = false
  private _buffer = new Map<string, AutomationChange[]>()
  private _sampleInterval = 0.0625 // 1/16th note
  private _lastSampledBeat = new Map<string, number>()

  start(_startBeat: number): void {
    this._recording = true
    this._buffer.clear()
    this._lastSampledBeat.clear()
  }

  stop(): Map<string, AutomationChange[]> {
    this._recording = false
    const result = new Map<string, AutomationChange[]>(this._buffer)
    this._buffer.clear()
    this._lastSampledBeat.clear()
    return result
  }

  captureValue(laneId: string, currentBeat: number, normalizedValue: number): void {
    if (!this._recording) return
    const last = this._lastSampledBeat.get(laneId) ?? -999
    if (currentBeat - last < this._sampleInterval) return
    this._lastSampledBeat.set(laneId, currentBeat)
    if (!this._buffer.has(laneId)) this._buffer.set(laneId, [])
    this._buffer.get(laneId)!.push({
      beat: currentBeat,
      value: normalizedValue,
      laneId,
      timestamp: Date.now(),
    })
  }

  setSampleInterval(beats: number): void {
    this._sampleInterval = Math.max(0.015625, Math.min(1.0, beats))
  }

  get isRecording(): boolean {
    return this._recording
  }

  get sampleInterval(): number {
    return this._sampleInterval
  }

  mergeIntoLane(laneId: string, changes: AutomationChange[], engine: AutomationEngine): void {
    for (const change of changes) {
      engine.addPoint(laneId, change.beat, change.value)
    }
  }
}

export { AutomationRecorder }
export const automationRecorder = new AutomationRecorder()
