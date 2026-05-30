// ─── Freeze Engine ────────────────────────────────────────────────────────────
// Renders a single track offline to a flat AudioBuffer, then bypasses all
// plugins on that track to reduce real-time CPU load.
//
// Freeze = offline render → store result in SmartCache (pinned) → mark track frozen
// Unfreeze = unpin buffer → restore plugins → delete frozen buffer

import { AudioEngine } from './AudioEngine'
import { cacheAudioBuffer, evictBuffer } from './SmartCache'
import { memoryManager } from './MemoryManager'

export interface FreezeOptions {
  sampleRate?:  number
  durationSec:  number
  channels?:    number
}

export interface FreezeResult {
  trackId:    string
  cacheKey:   string
  durationSec: number
  sizeMB:     number
}

type FreezeProgressCallback = (pct: number) => void

// ── Helpers ───────────────────────────────────────────────────────────────────

function frozenKey(trackId: string): string {
  return `frozen:${trackId}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

export class FreezeEngine {
  private frozenTracks: Set<string> = new Set()

  isFrozen(trackId: string): boolean {
    return this.frozenTracks.has(trackId)
  }

  frozenBuffer(trackId: string): AudioBuffer | null {
    return memoryManager.get(frozenKey(trackId))
  }

  /**
   * Render a track offline. The caller is responsible for wiring the track's
   * source nodes into the OfflineAudioContext before calling this.
   *
   * Pattern:
   *   const { ctx: offCtx, start } = engine.prepareContext(opts)
   *   // wire: trackSourceNode.connect(offCtx.destination)
   *   const result = await engine.renderAndFreeze(trackId, offCtx, start, opts)
   */
  prepareContext(opts: FreezeOptions): { ctx: OfflineAudioContext; start: () => void } {
    const sr  = opts.sampleRate ?? AudioEngine.getInstance().sampleRate
    const ch  = opts.channels ?? 2
    const len = Math.ceil(opts.durationSec * sr)
    const ctx = new OfflineAudioContext(ch, len, sr)
    return { ctx, start: () => {} }
  }

  async renderAndFreeze(
    trackId:   string,
    offCtx:    OfflineAudioContext,
    onProgress?: FreezeProgressCallback,
  ): Promise<FreezeResult> {
    if (this.frozenTracks.has(trackId)) {
      this.unfreeze(trackId)
    }

    onProgress?.(0)

    // OfflineAudioContext has no progress event — simulate with a timer
    const expectedMs = (offCtx.length / offCtx.sampleRate) * 200  // rough estimate
    let pct = 0
    const timer = setInterval(() => {
      pct = Math.min(pct + 5, 90)
      onProgress?.(pct)
    }, Math.max(50, expectedMs / 20))

    let rendered: AudioBuffer
    try {
      rendered = await offCtx.startRendering()
    } finally {
      clearInterval(timer)
    }

    onProgress?.(100)

    const key = frozenKey(trackId)
    await cacheAudioBuffer(key, rendered, /* pin = */ true)
    this.frozenTracks.add(trackId)

    const sizeMB = (rendered.length * rendered.numberOfChannels * 4) / 1024 / 1024

    return {
      trackId,
      cacheKey:   key,
      durationSec: rendered.duration,
      sizeMB:     Math.round(sizeMB * 10) / 10,
    }
  }

  unfreeze(trackId: string): void {
    const key = frozenKey(trackId)
    memoryManager.unpin(key)
    evictBuffer(key)
    this.frozenTracks.delete(trackId)
  }

  unfreezeAll(): void {
    for (const id of [...this.frozenTracks]) this.unfreeze(id)
  }

  getFrozenList(): string[] {
    return [...this.frozenTracks]
  }
}

export const freezeEngine = new FreezeEngine()
