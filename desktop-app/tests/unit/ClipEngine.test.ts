// ─── ClipEngine.test.ts ───────────────────────────────────────────────────────
// Tests for ClipEngine pure logic.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ClipEngine } from '../../src/renderer/src/audio/clip/ClipEngine.ts'
import type { ClipEngineContext } from '../../src/renderer/src/audio/clip/ClipEngine.ts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(overrides?: Partial<ClipEngineContext>): ClipEngineContext {
  const scenes = ['scene-0', 'scene-1', 'scene-2']

  // Default: each scene has one clip per track (track-0 and track-1)
  const clips: ClipEngineContext['clips'] = {
    'clip-s0-t0': { sceneId: 'scene-0', state: 'stopped', launchMode: 'trigger', followAction: 'none',  followActionChance: 1 },
    'clip-s0-t1': { sceneId: 'scene-0', state: 'stopped', launchMode: 'trigger', followAction: 'none',  followActionChance: 1 },
    'clip-s1-t0': { sceneId: 'scene-1', state: 'stopped', launchMode: 'trigger', followAction: 'none',  followActionChance: 1 },
    'clip-s1-t1': { sceneId: 'scene-1', state: 'stopped', launchMode: 'trigger', followAction: 'none',  followActionChance: 1 },
    'clip-s2-t0': { sceneId: 'scene-2', state: 'stopped', launchMode: 'trigger', followAction: 'none',  followActionChance: 1 },
    'clip-s2-t1': { sceneId: 'scene-2', state: 'stopped', launchMode: 'trigger', followAction: 'none',  followActionChance: 1 },
  }

  const getClipsInScene = (sceneId: string) =>
    Object.entries(clips)
      .filter(([, c]) => c.sceneId === sceneId)
      .map(([id]) => id)

  return {
    scenes,
    clips,
    getClipsInScene,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let engine: ClipEngine

describe('ClipEngine', () => {
  beforeEach(() => {
    engine = new ClipEngine()
  })

  describe('queueClip / isQueued', () => {
    it('queueClip → isQueued returns true', () => {
      engine.queueClip('clip-1')
      assert.equal(engine.isQueued('clip-1'), true)
    })

    it('non-queued clip returns false', () => {
      assert.equal(engine.isQueued('clip-x'), false)
    })
  })

  describe('activateClip', () => {
    it('activateClip → isPlaying=true, isQueued=false', () => {
      engine.queueClip('clip-1')
      engine.activateClip('clip-1')
      assert.equal(engine.isPlaying('clip-1'), true)
      assert.equal(engine.isQueued('clip-1'), false)
    })

    it('appears in getPlayingClips', () => {
      engine.activateClip('clip-1')
      assert.ok(engine.getPlayingClips().includes('clip-1'))
    })
  })

  describe('deactivateClip', () => {
    it('deactivateClip → isPlaying=false', () => {
      engine.activateClip('clip-1')
      engine.deactivateClip('clip-1')
      assert.equal(engine.isPlaying('clip-1'), false)
    })

    it('also removes from queued', () => {
      engine.queueClip('clip-1')
      engine.deactivateClip('clip-1')
      assert.equal(engine.isQueued('clip-1'), false)
    })
  })

  describe('stopAll', () => {
    it('getPlayingClips returns [] after stopAll', () => {
      engine.activateClip('clip-1')
      engine.activateClip('clip-2')
      engine.stopAll()
      assert.deepEqual(engine.getPlayingClips(), [])
    })

    it('getQueuedClips returns [] after stopAll', () => {
      engine.queueClip('clip-1')
      engine.stopAll()
      assert.deepEqual(engine.getQueuedClips(), [])
    })
  })

  describe('resolveFollowAction', () => {
    it('"stop" → { action: "stop" }', () => {
      const ctx = makeContext()
      ctx.clips['clip-s0-t0'].followAction = 'stop'
      const result = engine.resolveFollowAction('clip-s0-t0', ctx)
      assert.deepEqual(result, { action: 'stop' })
    })

    it('"again" → { action: "launch", targetClipId: finishedClipId }', () => {
      const ctx = makeContext()
      ctx.clips['clip-s0-t0'].followAction = 'again'
      const result = engine.resolveFollowAction('clip-s0-t0', ctx)
      assert.deepEqual(result, { action: 'launch', targetClipId: 'clip-s0-t0' })
    })

    it('"none" → { action: "launch", targetClipId: finishedClipId } (loop)', () => {
      const ctx = makeContext()
      ctx.clips['clip-s0-t0'].followAction = 'none'
      const result = engine.resolveFollowAction('clip-s0-t0', ctx)
      assert.deepEqual(result, { action: 'launch', targetClipId: 'clip-s0-t0' })
    })

    it('"next" with 3 scenes → returns clip from scene[1] for clip in scene[0]', () => {
      const ctx = makeContext()
      ctx.clips['clip-s0-t0'].followAction = 'next'
      const result = engine.resolveFollowAction('clip-s0-t0', ctx)
      assert.equal(result.action, 'launch')
      if (result.action === 'launch') {
        assert.equal(ctx.clips[result.targetClipId].sceneId, 'scene-1')
      }
    })

    it('"prev" at first scene → returns clip from scene[0] (clamped)', () => {
      const ctx = makeContext()
      ctx.clips['clip-s0-t0'].followAction = 'prev'
      const result = engine.resolveFollowAction('clip-s0-t0', ctx)
      // scene-0 is the first scene, clamped to scene-0, but returns a different clip in scene-0
      assert.equal(result.action, 'launch')
      if (result.action === 'launch') {
        assert.equal(ctx.clips[result.targetClipId].sceneId, 'scene-0')
      }
    })

    it('"first" → returns clip from scene[0]', () => {
      const ctx = makeContext()
      ctx.clips['clip-s2-t0'].followAction = 'first'
      const result = engine.resolveFollowAction('clip-s2-t0', ctx)
      assert.equal(result.action, 'launch')
      if (result.action === 'launch') {
        assert.equal(ctx.clips[result.targetClipId].sceneId, 'scene-0')
      }
    })

    it('"last" → returns clip from last scene', () => {
      const ctx = makeContext()
      ctx.clips['clip-s0-t0'].followAction = 'last'
      const result = engine.resolveFollowAction('clip-s0-t0', ctx)
      assert.equal(result.action, 'launch')
      if (result.action === 'launch') {
        assert.equal(ctx.clips[result.targetClipId].sceneId, 'scene-2')
      }
    })

    it('returns { action: "stop" } for unknown clip', () => {
      const ctx = makeContext()
      const result = engine.resolveFollowAction('nonexistent', ctx)
      assert.deepEqual(result, { action: 'stop' })
    })

    it('chance=1 always follows through', () => {
      const ctx = makeContext()
      ctx.clips['clip-s0-t0'].followAction = 'again'
      ctx.clips['clip-s0-t0'].followActionChance = 1
      // Run multiple times to verify determinism at chance=1
      for (let i = 0; i < 10; i++) {
        const result = engine.resolveFollowAction('clip-s0-t0', ctx)
        assert.equal(result.action, 'launch')
      }
    })
  })
})
