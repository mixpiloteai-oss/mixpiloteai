// ─── DropoutGuard ─────────────────────────────────────────────────────────────
// Monitors a BufferManager fill ratio and fires warnings when buffer runs low.
// Uses setInterval (available in both browser and Node.js).

import type { BufferManager } from './BufferManager.ts'

export type DropoutLevel = 'warning' | 'critical'

export interface DropoutStatus {
  fillRatio:    number
  dropoutCount: number
  lastDropout:  number | null
}

export class DropoutGuard {
  private _bufferManager: BufferManager
  private _lowWaterMark:  number  // fill ratio below which → 'critical' (default 0.10)
  private _highWaterMark: number  // fill ratio below which → 'warning'  (default 0.25)
  private _dropoutCount:  number = 0
  private _lastDropout:   number | null = null
  private _intervalId:    ReturnType<typeof setInterval> | null = null

  constructor(
    bufferManager: BufferManager,
    opts?: { lowWaterMark?: number; highWaterMark?: number },
  ) {
    this._bufferManager = bufferManager
    this._lowWaterMark  = opts?.lowWaterMark  ?? 0.10
    this._highWaterMark = opts?.highWaterMark ?? 0.25
  }

  // Begin polling at 10 Hz (every 100 ms).
  // `onWarning` is called with the severity level and current fill ratio.
  start(onWarning: (level: DropoutLevel, fillRatio: number) => void): void {
    if (this._intervalId !== null) return  // already running

    this._intervalId = setInterval(() => {
      const capacity  = this._bufferManager.getCapacity()
      const available = this._bufferManager.getAvailable()
      const fillRatio = capacity > 0 ? available / capacity : 0

      if (fillRatio < this._lowWaterMark) {
        this._dropoutCount += 1
        this._lastDropout   = Date.now()
        onWarning('critical', fillRatio)
      } else if (fillRatio < this._highWaterMark) {
        onWarning('warning', fillRatio)
      }
    }, 100)
  }

  stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId)
      this._intervalId = null
    }
  }

  getStatus(): DropoutStatus {
    const capacity  = this._bufferManager.getCapacity()
    const available = this._bufferManager.getAvailable()
    const fillRatio = capacity > 0 ? available / capacity : 0
    return {
      fillRatio,
      dropoutCount: this._dropoutCount,
      lastDropout:  this._lastDropout,
    }
  }
}
