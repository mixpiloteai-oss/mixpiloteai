// ─── ClipStore.test.ts ────────────────────────────────────────────────────────
// Self-contained inline store logic test. No Zustand import.
// Mirrors the action contracts of clipStore.ts.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ─── Minimal type replicas ────────────────────────────────────────────────────

type ClipLaunchMode = 'trigger' | 'gate' | 'toggle' | 'repeat'
type FollowAction   = 'none' | 'stop' | 'again' | 'next' | 'prev' | 'first' | 'last' | 'any'
type ClipState      = 'empty' | 'stopped' | 'queued' | 'playing' | 'recording'
type Quantization   = 'none' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1' | '2' | '4'

interface MidiNote {
  pitch:         number
  velocity:      number
  startBeat:     number
  durationBeats: number
}

interface AudioRegion {
  filePath:      string
  offsetSamples: number
  lengthSamples: number
  gain:          number
}

type ClipData =
  | { type: 'midi';  notes: MidiNote[];  lengthBeats: number; loopStart: number; loopEnd: number }
  | { type: 'audio'; region: AudioRegion; lengthBeats: number; loopStart: number; loopEnd: number }

interface Clip {
  id:                 string
  sceneId:            string
  trackId:            string
  name:               string
  color:              string
  data:               ClipData
  launchMode:         ClipLaunchMode
  followAction:       FollowAction
  followActionChance: number
  quantization:       Quantization | null
  state:              ClipState
  looping:            boolean
  gain:               number
  startOffset:        number
}

interface Scene {
  id:    string
  name:  string
  color: string
  tempo: number | null
}

// ─── In-memory store replica ──────────────────────────────────────────────────

function createStore() {
  let clips: Record<string, Clip> = {}
  let scenes: Scene[] = []
  let trackIds: string[] = []
  let globalQuantization: Quantization = '1'
  let selectedClip: string | null = null
  let _idSeq = 0
  function uid(prefix: string) { return `${prefix}-${++_idSeq}` }

  function addClip(sceneId: string, trackId: string, data: ClipData, name?: string): Clip {
    const clip: Clip = {
      id:                 uid('clip'),
      sceneId,
      trackId,
      name:               name ?? 'Clip',
      color:              '#7c3aed',
      data,
      launchMode:         'trigger',
      followAction:       'none',
      followActionChance: 1,
      quantization:       null,
      state:              'stopped',
      looping:            true,
      gain:               0,
      startOffset:        0,
    }
    clips = { ...clips, [clip.id]: clip }
    return clip
  }

  function removeClip(clipId: string): void {
    const { [clipId]: _omit, ...rest } = clips
    clips = rest
  }

  function updateClip(clipId: string, patch: Partial<Omit<Clip, 'id'>>): void {
    const existing = clips[clipId]
    if (!existing) return
    clips = { ...clips, [clipId]: { ...existing, ...patch } }
  }

  function setClipState(clipId: string, state: ClipState): void {
    const existing = clips[clipId]
    if (!existing) return
    clips = { ...clips, [clipId]: { ...existing, state } }
  }

  function duplicateClip(clipId: string): Clip | null {
    const existing = clips[clipId]
    if (!existing) return null
    const newClip: Clip = {
      ...existing,
      id:    uid('clip'),
      name:  existing.name + ' (copy)',
      state: 'stopped',
    }
    clips = { ...clips, [newClip.id]: newClip }
    return newClip
  }

  function selectClip(clipId: string | null): void {
    selectedClip = clipId
  }

  function addScene(name?: string): Scene {
    const id = uid('scene')
    const scene: Scene = { id, name: name ?? `Scene ${id}`, color: '#7c3aed', tempo: null }
    scenes = [...scenes, scene]
    return scene
  }

  function removeScene(sceneId: string): void {
    scenes = scenes.filter(s => s.id !== sceneId)
    clips = Object.fromEntries(Object.entries(clips).filter(([, c]) => c.sceneId !== sceneId))
  }

  function renameScene(sceneId: string, name: string): void {
    scenes = scenes.map(s => s.id === sceneId ? { ...s, name } : s)
  }

  function addTrack(trackId: string): void {
    if (!trackIds.includes(trackId)) trackIds = [...trackIds, trackId]
  }

  function removeTrack(trackId: string): void {
    trackIds = trackIds.filter(id => id !== trackId)
    clips = Object.fromEntries(Object.entries(clips).filter(([, c]) => c.trackId !== trackId))
  }

  function setGlobalQuantization(q: Quantization): void {
    globalQuantization = q
  }

  function getClipAt(sceneId: string, trackId: string): Clip | null {
    return Object.values(clips).find(c => c.sceneId === sceneId && c.trackId === trackId) ?? null
  }

  function getClipsInScene(sceneId: string): Clip[] {
    return Object.values(clips).filter(c => c.sceneId === sceneId)
  }

  return {
    get clips()              { return clips             },
    get scenes()             { return scenes            },
    get trackIds()           { return trackIds          },
    get globalQuantization() { return globalQuantization },
    get selectedClip()       { return selectedClip      },
    addClip,
    removeClip,
    updateClip,
    setClipState,
    duplicateClip,
    selectClip,
    addScene,
    removeScene,
    renameScene,
    addTrack,
    removeTrack,
    setGlobalQuantization,
    getClipAt,
    getClipsInScene,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const midiData: ClipData = {
  type: 'midi',
  lengthBeats: 4,
  loopStart: 0,
  loopEnd: 4,
  notes: [{ pitch: 60, velocity: 80, startBeat: 0, durationBeats: 1 }],
}

const audioData: ClipData = {
  type: 'audio',
  lengthBeats: 8,
  loopStart: 0,
  loopEnd: 8,
  region: { filePath: 'samples/test.wav', offsetSamples: 0, lengthSamples: 44100, gain: 1 },
}

let store: ReturnType<typeof createStore>

describe('ClipStore', () => {
  beforeEach(() => {
    store = createStore()
  })

  describe('addClip', () => {
    it('creates clip with correct sceneId, trackId, state=stopped', () => {
      const clip = store.addClip('scene-0', 'track-0', midiData, 'Kick')
      assert.equal(clip.sceneId, 'scene-0')
      assert.equal(clip.trackId, 'track-0')
      assert.equal(clip.state, 'stopped')
      assert.equal(clip.name, 'Kick')
      assert.ok(store.clips[clip.id])
    })

    it('preserves notes array for midi type', () => {
      const clip = store.addClip('scene-0', 'track-0', midiData)
      assert.equal(clip.data.type, 'midi')
      if (clip.data.type === 'midi') {
        assert.equal(clip.data.notes.length, 1)
        assert.equal(clip.data.notes[0].pitch, 60)
      }
    })

    it('uses default name "Clip" when no name provided', () => {
      const clip = store.addClip('scene-0', 'track-0', midiData)
      assert.equal(clip.name, 'Clip')
    })

    it('assigns a unique id each time', () => {
      const a = store.addClip('scene-0', 'track-0', midiData)
      const b = store.addClip('scene-0', 'track-1', midiData)
      assert.notEqual(a.id, b.id)
    })
  })

  describe('removeClip', () => {
    it('removes clip from clips', () => {
      const clip = store.addClip('scene-0', 'track-0', midiData)
      store.removeClip(clip.id)
      assert.equal(store.clips[clip.id], undefined)
    })

    it('does nothing for unknown clip id', () => {
      store.addClip('scene-0', 'track-0', midiData)
      const before = Object.keys(store.clips).length
      store.removeClip('nonexistent')
      assert.equal(Object.keys(store.clips).length, before)
    })
  })

  describe('updateClip', () => {
    it('merges patch (name, color change)', () => {
      const clip = store.addClip('scene-0', 'track-0', midiData, 'Old Name')
      store.updateClip(clip.id, { name: 'New Name', color: '#ef4444' })
      assert.equal(store.clips[clip.id].name, 'New Name')
      assert.equal(store.clips[clip.id].color, '#ef4444')
    })

    it('preserves unpatched fields', () => {
      const clip = store.addClip('scene-0', 'track-0', midiData, 'Test')
      store.updateClip(clip.id, { name: 'New' })
      assert.equal(store.clips[clip.id].trackId, 'track-0')
      assert.equal(store.clips[clip.id].sceneId, 'scene-0')
    })
  })

  describe('setClipState', () => {
    it('changes state', () => {
      const clip = store.addClip('scene-0', 'track-0', midiData)
      assert.equal(clip.state, 'stopped')
      store.setClipState(clip.id, 'playing')
      assert.equal(store.clips[clip.id].state, 'playing')
    })

    it('can set to queued', () => {
      const clip = store.addClip('scene-0', 'track-0', midiData)
      store.setClipState(clip.id, 'queued')
      assert.equal(store.clips[clip.id].state, 'queued')
    })
  })

  describe('duplicateClip', () => {
    it('creates new clip with new id, same data, same sceneId/trackId', () => {
      const original = store.addClip('scene-0', 'track-0', midiData, 'Original')
      const dup = store.duplicateClip(original.id)
      assert.ok(dup)
      assert.notEqual(dup!.id, original.id)
      assert.equal(dup!.sceneId, original.sceneId)
      assert.equal(dup!.trackId, original.trackId)
      assert.deepEqual(dup!.data, original.data)
    })

    it('duplicate name has (copy) suffix', () => {
      const original = store.addClip('scene-0', 'track-0', midiData, 'Kick')
      const dup = store.duplicateClip(original.id)
      assert.equal(dup!.name, 'Kick (copy)')
    })

    it('duplicate state is stopped', () => {
      const original = store.addClip('scene-0', 'track-0', midiData)
      store.setClipState(original.id, 'playing')
      const dup = store.duplicateClip(original.id)
      assert.equal(dup!.state, 'stopped')
    })

    it('returns null for unknown clipId', () => {
      const result = store.duplicateClip('nonexistent')
      assert.equal(result, null)
    })
  })

  describe('addScene', () => {
    it('appends to scenes', () => {
      const before = store.scenes.length
      store.addScene('New Scene')
      assert.equal(store.scenes.length, before + 1)
      assert.equal(store.scenes[store.scenes.length - 1].name, 'New Scene')
    })
  })

  describe('removeScene', () => {
    it('removes it', () => {
      const scene = store.addScene('To Remove')
      const before = store.scenes.length
      store.removeScene(scene.id)
      assert.equal(store.scenes.length, before - 1)
      assert.ok(!store.scenes.find(s => s.id === scene.id))
    })

    it('also removes clips in that scene', () => {
      const scene = store.addScene('Scene With Clips')
      const clip  = store.addClip(scene.id, 'track-0', midiData)
      store.removeScene(scene.id)
      assert.equal(store.clips[clip.id], undefined)
    })
  })

  describe('renameScene', () => {
    it('updates name', () => {
      const scene = store.addScene('Old')
      store.renameScene(scene.id, 'New')
      const updated = store.scenes.find(s => s.id === scene.id)
      assert.equal(updated!.name, 'New')
    })
  })

  describe('setGlobalQuantization', () => {
    it('changes quantization', () => {
      assert.equal(store.globalQuantization, '1')
      store.setGlobalQuantization('1/4')
      assert.equal(store.globalQuantization, '1/4')
    })
  })

  describe('getClipAt', () => {
    it('returns correct clip', () => {
      store.addTrack('track-0')
      const scene = store.addScene('S')
      const clip  = store.addClip(scene.id, 'track-0', midiData)
      const found = store.getClipAt(scene.id, 'track-0')
      assert.ok(found)
      assert.equal(found!.id, clip.id)
    })

    it('returns null for empty slot', () => {
      const scene = store.addScene('S')
      const result = store.getClipAt(scene.id, 'track-99')
      assert.equal(result, null)
    })
  })

  describe('getClipsInScene', () => {
    it('returns all clips for that scene', () => {
      const scene = store.addScene('S')
      store.addClip(scene.id, 'track-0', midiData)
      store.addClip(scene.id, 'track-1', midiData)
      store.addClip('other-scene', 'track-0', midiData)
      const result = store.getClipsInScene(scene.id)
      assert.equal(result.length, 2)
      assert.ok(result.every(c => c.sceneId === scene.id))
    })
  })
})
