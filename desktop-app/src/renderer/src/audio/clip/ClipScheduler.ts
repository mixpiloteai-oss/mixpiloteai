// ─── ClipScheduler ────────────────────────────────────────────────────────────
// Pure timing functions + browser-only ClipScheduler class.
// Pure functions are exported as named exports for Node-compatible testing.

// ─── Types ────────────────────────────────────────────────────────────────────

export type Quantization = 'none' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1' | '2' | '4'

// ─── Pure Functions ───────────────────────────────────────────────────────────

/** Returns quantization length in beats (1 bar = 4 beats in 4/4) */
export function quantizationToBeats(q: Quantization): number {
  const map: Record<Quantization, number> = {
    'none': 0,
    '1/32': 4 / 32,
    '1/16': 4 / 16,
    '1/8':  4 / 8,
    '1/4':  1,
    '1/2':  2,
    '1':    4,
    '2':    8,
    '4':    16,
  }
  return map[q]
}

/**
 * Returns AudioContext time of next quantization boundary.
 * bpm: beats per minute
 * currentTimeSeconds: AudioContext.currentTime (seconds from context start)
 * Returns currentTimeSeconds if quantization is 'none'
 */
export function getNextQuantBoundary(q: Quantization, bpm: number, currentTimeSeconds: number): number {
  if (q === 'none') return currentTimeSeconds
  const quantBeats = quantizationToBeats(q)
  const secondsPerBeat = 60 / bpm
  const currentBeats = currentTimeSeconds / secondsPerBeat
  const nextBeat = Math.ceil(currentBeats / quantBeats) * quantBeats
  return nextBeat * secondsPerBeat
}

/** Compute current beat position from AudioContext time */
export function currentBeatPosition(bpm: number, currentTimeSeconds: number): number {
  return currentTimeSeconds / (60 / bpm)
}

/**
 * Compute clip progress (0..1) given start time, clip length in beats, bpm, currentTime.
 * Loops when beyond clip length.
 */
export function clipProgress(
  startTimeSeconds: number,
  lengthBeats: number,
  bpm: number,
  currentTimeSeconds: number,
): number {
  if (currentTimeSeconds < startTimeSeconds) return 0
  const elapsed = currentTimeSeconds - startTimeSeconds
  const lengthSeconds = lengthBeats * (60 / bpm)
  if (lengthSeconds <= 0) return 0
  return (elapsed % lengthSeconds) / lengthSeconds
}

// ─── Browser-only ClipScheduler class ────────────────────────────────────────

interface ScheduledEntry {
  startTime: number
  stopTime?: number
}

export class ClipScheduler {
  private _ctx: AudioContext
  private _scheduled: Map<string, ScheduledEntry> = new Map()
  private _startCbs: ((clipId: string, startTime: number) => void)[] = []
  private _stopCbs:  ((clipId: string) => void)[] = []

  constructor(ctx: AudioContext) {
    this._ctx = ctx
  }

  scheduleClipStart(clipId: string, audioContextTime: number): void {
    const existing = this._scheduled.get(clipId)
    this._scheduled.set(clipId, { ...existing, startTime: audioContextTime })
    this._startCbs.forEach(cb => cb(clipId, audioContextTime))
  }

  scheduleClipStop(clipId: string, audioContextTime: number): void {
    const existing = this._scheduled.get(clipId)
    if (existing) {
      this._scheduled.set(clipId, { ...existing, stopTime: audioContextTime })
    } else {
      this._scheduled.set(clipId, { startTime: audioContextTime, stopTime: audioContextTime })
    }
    this._stopCbs.forEach(cb => cb(clipId))
  }

  isScheduled(clipId: string): boolean {
    return this._scheduled.has(clipId)
  }

  cancelScheduled(clipId: string): void {
    this._scheduled.delete(clipId)
  }

  onClipStart(cb: (clipId: string, startTime: number) => void): void {
    this._startCbs.push(cb)
  }

  onClipStop(cb: (clipId: string) => void): void {
    this._stopCbs.push(cb)
  }

  /**
   * Schedule clip start at the next quantization boundary.
   * Returns the scheduled start time.
   */
  scheduleAtNextBoundary(clipId: string, q: Quantization, bpm: number): number {
    const startTime = getNextQuantBoundary(q, bpm, this._ctx.currentTime)
    this.scheduleClipStart(clipId, startTime)
    return startTime
  }
}
