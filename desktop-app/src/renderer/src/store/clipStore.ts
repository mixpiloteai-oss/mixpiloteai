// ─── clipStore ────────────────────────────────────────────────────────────────
// Zustand store for clip launcher (Ableton Live-style) state.
// No persistence. All types defined inline.

import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClipLaunchMode = 'trigger' | 'gate' | 'toggle' | 'repeat'
export type FollowAction   = 'none' | 'stop' | 'again' | 'next' | 'prev' | 'first' | 'last' | 'any'
export type ClipState      = 'empty' | 'stopped' | 'queued' | 'playing' | 'recording'
export type Quantization   = 'none' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1' | '2' | '4'

export interface MidiNote {
  pitch:         number   // 0-127
  velocity:      number   // 1-127
  startBeat:     number   // beat offset within clip
  durationBeats: number
}

export interface AudioRegion {
  filePath:      string
  offsetSamples: number
  lengthSamples: number
  gain:          number   // linear 0..2
}

export type ClipData =
  | { type: 'midi';  notes: MidiNote[];  lengthBeats: number; loopStart: number; loopEnd: number }
  | { type: 'audio'; region: AudioRegion; lengthBeats: number; loopStart: number; loopEnd: number }

export interface Clip {
  id:                 string
  sceneId:            string
  trackId:            string
  name:               string
  color:              string
  data:               ClipData
  launchMode:         ClipLaunchMode
  followAction:       FollowAction
  followActionChance: number   // 0..1
  quantization:       Quantization | null   // null = use global
  state:              ClipState
  looping:            boolean
  gain:               number   // dB
  startOffset:        number   // beat offset
}

export interface Scene {
  id:    string
  name:  string
  color: string
  tempo: number | null   // null = use project BPM
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#e2e8f0']

const SEED_SCENES: Scene[] = [
  { id: 'scene-0', name: 'Scene 1', color: COLORS[0], tempo: null },
  { id: 'scene-1', name: 'Scene 2', color: COLORS[1], tempo: null },
  { id: 'scene-2', name: 'Scene 3', color: COLORS[2], tempo: null },
  { id: 'scene-3', name: 'Scene 4', color: COLORS[3], tempo: null },
]

const SEED_TRACK_IDS = ['track-0', 'track-1', 'track-2', 'track-3']

function makeClip(
  id: string,
  sceneId: string,
  trackId: string,
  name: string,
  color: string,
  data: ClipData,
): Clip {
  return {
    id,
    sceneId,
    trackId,
    name,
    color,
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
}

const SEED_CLIPS: Clip[] = [
  // scene-0 track-0: Kick — 4-bar loop, quarter notes at beats 0,2,4,6
  makeClip('clip-s0-t0', 'scene-0', 'track-0', 'Kick', COLORS[0], {
    type: 'midi',
    lengthBeats: 16,
    loopStart: 0,
    loopEnd: 16,
    notes: [
      { pitch: 36, velocity: 100, startBeat: 0,  durationBeats: 0.5 },
      { pitch: 36, velocity: 100, startBeat: 2,  durationBeats: 0.5 },
      { pitch: 36, velocity: 100, startBeat: 4,  durationBeats: 0.5 },
      { pitch: 36, velocity: 100, startBeat: 6,  durationBeats: 0.5 },
      { pitch: 36, velocity: 100, startBeat: 8,  durationBeats: 0.5 },
      { pitch: 36, velocity: 100, startBeat: 10, durationBeats: 0.5 },
      { pitch: 36, velocity: 100, startBeat: 12, durationBeats: 0.5 },
      { pitch: 36, velocity: 100, startBeat: 14, durationBeats: 0.5 },
    ],
  }),

  // scene-0 track-1: Snare — 4-bar loop, notes at beats 1,3,5,7
  makeClip('clip-s0-t1', 'scene-0', 'track-1', 'Snare', COLORS[1], {
    type: 'midi',
    lengthBeats: 16,
    loopStart: 0,
    loopEnd: 16,
    notes: [
      { pitch: 38, velocity: 90, startBeat: 1,  durationBeats: 0.25 },
      { pitch: 38, velocity: 90, startBeat: 3,  durationBeats: 0.25 },
      { pitch: 38, velocity: 90, startBeat: 5,  durationBeats: 0.25 },
      { pitch: 38, velocity: 90, startBeat: 7,  durationBeats: 0.25 },
      { pitch: 38, velocity: 90, startBeat: 9,  durationBeats: 0.25 },
      { pitch: 38, velocity: 90, startBeat: 11, durationBeats: 0.25 },
      { pitch: 38, velocity: 90, startBeat: 13, durationBeats: 0.25 },
      { pitch: 38, velocity: 90, startBeat: 15, durationBeats: 0.25 },
    ],
  }),

  // scene-0 track-2: Hi-hat — 2-bar loop, 8 eighth notes
  makeClip('clip-s0-t2', 'scene-0', 'track-2', 'Hi-hat', COLORS[2], {
    type: 'midi',
    lengthBeats: 8,
    loopStart: 0,
    loopEnd: 8,
    notes: [
      { pitch: 42, velocity: 70, startBeat: 0,   durationBeats: 0.25 },
      { pitch: 42, velocity: 70, startBeat: 0.5, durationBeats: 0.25 },
      { pitch: 42, velocity: 70, startBeat: 1,   durationBeats: 0.25 },
      { pitch: 42, velocity: 70, startBeat: 1.5, durationBeats: 0.25 },
      { pitch: 42, velocity: 70, startBeat: 2,   durationBeats: 0.25 },
      { pitch: 42, velocity: 70, startBeat: 2.5, durationBeats: 0.25 },
      { pitch: 42, velocity: 70, startBeat: 3,   durationBeats: 0.25 },
      { pitch: 42, velocity: 70, startBeat: 3.5, durationBeats: 0.25 },
    ],
  }),

  // scene-0 track-3: Bass — 4-bar loop, various pitches
  makeClip('clip-s0-t3', 'scene-0', 'track-3', 'Bass', COLORS[3], {
    type: 'midi',
    lengthBeats: 16,
    loopStart: 0,
    loopEnd: 16,
    notes: [
      { pitch: 36, velocity: 80, startBeat: 0,   durationBeats: 1 },
      { pitch: 38, velocity: 80, startBeat: 1.5, durationBeats: 0.5 },
      { pitch: 40, velocity: 80, startBeat: 2,   durationBeats: 1 },
      { pitch: 36, velocity: 80, startBeat: 3,   durationBeats: 0.5 },
      { pitch: 41, velocity: 80, startBeat: 4,   durationBeats: 1 },
      { pitch: 43, velocity: 80, startBeat: 5.5, durationBeats: 0.5 },
    ],
  }),

  // scene-1 track-0: audio clip kick.wav 4-bar
  makeClip('clip-s1-t0', 'scene-1', 'track-0', 'Kick (audio)', COLORS[4], {
    type: 'audio',
    lengthBeats: 16,
    loopStart: 0,
    loopEnd: 16,
    region: {
      filePath:      'samples/kick.wav',
      offsetSamples: 0,
      lengthSamples: 176400,  // 4 bars at 120bpm, 44100hz
      gain:          1,
    },
  }),

  // scene-1 track-1: audio clip bass.wav 8-bar
  makeClip('clip-s1-t1', 'scene-1', 'track-1', 'Bass (audio)', COLORS[5], {
    type: 'audio',
    lengthBeats: 32,
    loopStart: 0,
    loopEnd: 32,
    region: {
      filePath:      'samples/bass.wav',
      offsetSamples: 0,
      lengthSamples: 352800,  // 8 bars at 120bpm, 44100hz
      gain:          1,
    },
  }),

  // scene-2 track-2: Lead — 8-bar MIDI loop with 16 melodic notes
  makeClip('clip-s2-t2', 'scene-2', 'track-2', 'Lead', COLORS[6], {
    type: 'midi',
    lengthBeats: 32,
    loopStart: 0,
    loopEnd: 32,
    notes: [
      { pitch: 60, velocity: 85, startBeat: 0,  durationBeats: 1 },
      { pitch: 62, velocity: 82, startBeat: 2,  durationBeats: 1 },
      { pitch: 64, velocity: 88, startBeat: 4,  durationBeats: 1 },
      { pitch: 65, velocity: 80, startBeat: 6,  durationBeats: 1 },
      { pitch: 67, velocity: 90, startBeat: 8,  durationBeats: 1 },
      { pitch: 65, velocity: 82, startBeat: 10, durationBeats: 1 },
      { pitch: 64, velocity: 85, startBeat: 12, durationBeats: 1 },
      { pitch: 62, velocity: 80, startBeat: 14, durationBeats: 1 },
      { pitch: 60, velocity: 88, startBeat: 16, durationBeats: 2 },
      { pitch: 64, velocity: 85, startBeat: 18, durationBeats: 1 },
      { pitch: 67, velocity: 90, startBeat: 20, durationBeats: 1 },
      { pitch: 69, velocity: 85, startBeat: 22, durationBeats: 1 },
      { pitch: 67, velocity: 82, startBeat: 24, durationBeats: 1 },
      { pitch: 65, velocity: 80, startBeat: 26, durationBeats: 1 },
      { pitch: 64, velocity: 85, startBeat: 28, durationBeats: 1 },
      { pitch: 60, velocity: 90, startBeat: 30, durationBeats: 2 },
    ],
  }),

  // scene-3 track-0: Intro — 4-bar MIDI clip, single note
  makeClip('clip-s3-t0', 'scene-3', 'track-0', 'Intro', COLORS[7], {
    type: 'midi',
    lengthBeats: 16,
    loopStart: 0,
    loopEnd: 16,
    notes: [
      { pitch: 60, velocity: 80, startBeat: 0, durationBeats: 16 },
    ],
  }),
]

function seedClips(): Record<string, Clip> {
  const result: Record<string, Clip> = {}
  for (const clip of SEED_CLIPS) {
    result[clip.id] = clip
  }
  return result
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface ClipStore {
  clips:              Record<string, Clip>
  scenes:             Scene[]
  trackIds:           string[]
  globalQuantization: Quantization
  clipStates:         Record<string, ClipState>
  playingScene:       string | null
  selectedClip:       string | null

  // Actions
  addClip(sceneId: string, trackId: string, data: ClipData, name?: string): Clip
  removeClip(clipId: string): void
  updateClip(clipId: string, patch: Partial<Omit<Clip, 'id'>>): void
  setClipState(clipId: string, state: ClipState): void
  duplicateClip(clipId: string): Clip | null
  selectClip(clipId: string | null): void
  addScene(name?: string): Scene
  removeScene(sceneId: string): void
  renameScene(sceneId: string, name: string): void
  addTrack(trackId: string): void
  removeTrack(trackId: string): void
  setGlobalQuantization(q: Quantization): void
  setPlayingScene(sceneId: string | null): void
  getClipsInScene(sceneId: string): Clip[]
  getClipAt(sceneId: string, trackId: string): Clip | null
}

// ─── ID generator ─────────────────────────────────────────────────────────────

let _clipSeq = 100
function nextClipId(): string { return `clip-${++_clipSeq}` }

let _sceneSeq = 10
function nextSceneId(): string { return `scene-${++_sceneSeq}` }

// ─── Store ────────────────────────────────────────────────────────────────────

export const useClipStore = create<ClipStore>((set, get) => ({
  clips:              seedClips(),
  scenes:             SEED_SCENES,
  trackIds:           SEED_TRACK_IDS,
  globalQuantization: '1',
  clipStates:         {},
  playingScene:       null,
  selectedClip:       null,

  addClip: (sceneId, trackId, data, name) => {
    const clip: Clip = {
      id:                 nextClipId(),
      sceneId,
      trackId,
      name:               name ?? 'Clip',
      color:              COLORS[Math.floor(Math.random() * COLORS.length)],
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
    set(s => ({ clips: { ...s.clips, [clip.id]: clip } }))
    return clip
  },

  removeClip: (clipId) => set(s => {
    const { [clipId]: _omit, ...rest } = s.clips
    const { [clipId]: _stateOmit, ...restStates } = s.clipStates
    return { clips: rest, clipStates: restStates }
  }),

  updateClip: (clipId, patch) => set(s => {
    const existing = s.clips[clipId]
    if (!existing) return {}
    return { clips: { ...s.clips, [clipId]: { ...existing, ...patch } } }
  }),

  setClipState: (clipId, state) => set(s => {
    const existing = s.clips[clipId]
    if (!existing) return {}
    return {
      clips:      { ...s.clips, [clipId]: { ...existing, state } },
      clipStates: { ...s.clipStates, [clipId]: state },
    }
  }),

  duplicateClip: (clipId) => {
    const existing = get().clips[clipId]
    if (!existing) return null
    const newClip: Clip = {
      ...existing,
      id:   nextClipId(),
      name: existing.name + ' (copy)',
      state: 'stopped',
    }
    set(s => ({ clips: { ...s.clips, [newClip.id]: newClip } }))
    return newClip
  },

  selectClip: (clipId) => set({ selectedClip: clipId }),

  addScene: (name) => {
    const id    = nextSceneId()
    const scene: Scene = {
      id,
      name:  name ?? `Scene ${id}`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      tempo: null,
    }
    set(s => ({ scenes: [...s.scenes, scene] }))
    return scene
  },

  removeScene: (sceneId) => set(s => ({
    scenes: s.scenes.filter(sc => sc.id !== sceneId),
    clips:  Object.fromEntries(
      Object.entries(s.clips).filter(([, c]) => c.sceneId !== sceneId)
    ),
  })),

  renameScene: (sceneId, name) => set(s => ({
    scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, name } : sc),
  })),

  addTrack: (trackId) => set(s => {
    if (s.trackIds.includes(trackId)) return {}
    return { trackIds: [...s.trackIds, trackId] }
  }),

  removeTrack: (trackId) => set(s => ({
    trackIds: s.trackIds.filter(id => id !== trackId),
    clips:    Object.fromEntries(
      Object.entries(s.clips).filter(([, c]) => c.trackId !== trackId)
    ),
  })),

  setGlobalQuantization: (q) => set({ globalQuantization: q }),

  setPlayingScene: (sceneId) => set({ playingScene: sceneId }),

  getClipsInScene: (sceneId) => {
    return Object.values(get().clips).filter(c => c.sceneId === sceneId)
  },

  getClipAt: (sceneId, trackId) => {
    return Object.values(get().clips).find(c => c.sceneId === sceneId && c.trackId === trackId) ?? null
  },
}))
