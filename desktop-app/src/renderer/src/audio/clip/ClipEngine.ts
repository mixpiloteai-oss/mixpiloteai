// ─── ClipEngine ───────────────────────────────────────────────────────────────
// Pure clip state management logic. No browser API imports — Node-compatible.

import type { Quantization } from './ClipScheduler.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClipLaunchMode = 'trigger' | 'gate' | 'toggle' | 'repeat'
export type FollowAction   = 'none' | 'stop' | 'again' | 'next' | 'prev' | 'first' | 'last' | 'any'
export type ClipState      = 'empty' | 'stopped' | 'queued' | 'playing' | 'recording'

export interface ClipEngineClip {
  sceneId:            string
  state:              ClipState
  launchMode:         ClipLaunchMode
  followAction:       FollowAction
  followActionChance: number
}

export interface ClipEngineContext {
  scenes:          string[]  // ordered scene IDs
  clips:           Record<string, ClipEngineClip>
  getClipsInScene: (sceneId: string) => string[]  // returns clipIds in that scene
}

export type FollowActionResult =
  | { action: 'launch'; targetClipId: string }
  | { action: 'stop' }

// ─── ClipEngine ───────────────────────────────────────────────────────────────

export class ClipEngine {
  private _playing: Set<string> = new Set()
  private _queued:  Set<string> = new Set()

  // Called by transport on each beat — hook for subclasses
  onBeat(_beat: number, _bpm: number): void { /* hook for subclasses */ }

  /** Queue a clip for launch */
  queueClip(clipId: string): void {
    this._queued.add(clipId)
  }

  /** Activate a queued clip (move from queued → playing) */
  activateClip(clipId: string): void {
    this._queued.delete(clipId)
    this._playing.add(clipId)
  }

  /** Stop a clip */
  deactivateClip(clipId: string): void {
    this._playing.delete(clipId)
    this._queued.delete(clipId)
  }

  getPlayingClips(): string[] { return [...this._playing] }
  getQueuedClips():  string[] { return [...this._queued]  }
  isPlaying(clipId: string): boolean { return this._playing.has(clipId) }
  isQueued(clipId: string):  boolean { return this._queued.has(clipId)  }

  stopAll(): void {
    this._playing.clear()
    this._queued.clear()
  }

  /**
   * PURE follow-action resolution — no side effects, just returns the target clipId/action.
   * Returns { action: 'stop' } if action is 'stop' or chance check fails.
   * Returns { action: 'launch', targetClipId } otherwise.
   */
  resolveFollowAction(
    finishedClipId: string,
    ctx: ClipEngineContext,
  ): FollowActionResult {
    const clip = ctx.clips[finishedClipId]
    if (!clip) return { action: 'stop' }

    // Chance check
    if (clip.followActionChance < 1 && Math.random() > clip.followActionChance) {
      return { action: 'stop' }
    }

    const { followAction, sceneId } = clip
    const sceneIdx = ctx.scenes.indexOf(sceneId)

    if (followAction === 'none')  return { action: 'launch', targetClipId: finishedClipId }  // keep looping
    if (followAction === 'stop')  return { action: 'stop' }
    if (followAction === 'again') return { action: 'launch', targetClipId: finishedClipId }

    let targetSceneId: string | undefined
    if (followAction === 'first') targetSceneId = ctx.scenes[0]
    if (followAction === 'last')  targetSceneId = ctx.scenes[ctx.scenes.length - 1]
    if (followAction === 'next')  targetSceneId = ctx.scenes[Math.min(sceneIdx + 1, ctx.scenes.length - 1)]
    if (followAction === 'prev')  targetSceneId = ctx.scenes[Math.max(sceneIdx - 1, 0)]
    if (followAction === 'any')   targetSceneId = ctx.scenes[Math.floor(Math.random() * ctx.scenes.length)]

    if (!targetSceneId) return { action: 'stop' }

    // Find the clip in the same track column of the target scene
    const targetClips = ctx.getClipsInScene(targetSceneId)
    const finishedClip = ctx.clips[finishedClipId]

    // Find clip in same track (different id from finished, in the target scene)
    const sameTrackClip = targetClips.find(id => {
      if (id === finishedClipId) return false
      const c = ctx.clips[id]
      return c !== undefined && finishedClip !== undefined
    })

    if (!sameTrackClip) return { action: 'stop' }
    return { action: 'launch', targetClipId: sameTrackClip }
  }
}

// Re-export Quantization so consumers can import from one place if desired
export type { Quantization }
