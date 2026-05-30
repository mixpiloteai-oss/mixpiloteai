import { create } from 'zustand'
import type { Project, Clip, Track, MidiNote } from '../types/project'

const TRACK_COLORS = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6']

const mkClip = (id: string, trackId: string, name: string, start: number, len: number, color: string): Clip => ({
  id, trackId, name, startBar: start, lengthBars: len, color, muted: false, notes: [],
})

const SEED_PROJECT: Project = {
  id: 'proj-1',
  name: 'Untitled Session',
  bpm: 145,
  timeSignatureNumerator: 4,
  timeSignatureDenominator: 4,
  sampleRate: 44100,
  masterGainDb: 0,
  loopStart: 1,
  loopEnd: 17,
  totalBars: 32,
  tracks: [
    {
      id: 'tk-kick', name: 'Kick', type: 'midi', color: TRACK_COLORS[0],
      gainDb: 0, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
      clips: [
        mkClip('c1','tk-kick','Kick A',1,4,TRACK_COLORS[0]),
        mkClip('c2','tk-kick','Kick A',5,4,TRACK_COLORS[0]),
        mkClip('c3','tk-kick','Kick B',9,4,TRACK_COLORS[0]),
        mkClip('c4','tk-kick','Kick A',13,4,TRACK_COLORS[0]),
      ],
    },
    {
      id: 'tk-bass', name: 'Bass Synth', type: 'midi', color: TRACK_COLORS[1],
      gainDb: -2, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
      clips: [
        mkClip('c5','tk-bass','Bass Intro',1,8,TRACK_COLORS[1]),
        mkClip('c6','tk-bass','Bass Drop',9,8,TRACK_COLORS[1]),
      ],
    },
    {
      id: 'tk-lead', name: 'Lead Acid', type: 'midi', color: TRACK_COLORS[2],
      gainDb: -4, panCenter: 0.1, muted: false, soloed: false, armed: false, sends: [], height: 64,
      clips: [
        mkClip('c7','tk-lead','Acid A',3,2,TRACK_COLORS[2]),
        mkClip('c8','tk-lead','Acid B',7,4,TRACK_COLORS[2]),
        mkClip('c9','tk-lead','Acid C',13,2,TRACK_COLORS[2]),
      ],
    },
    {
      id: 'tk-chords', name: 'Chord Stabs', type: 'midi', color: TRACK_COLORS[3],
      gainDb: -6, panCenter: -0.1, muted: false, soloed: false, armed: false, sends: [], height: 64,
      clips: [
        mkClip('c10','tk-chords','Dm7',5,1,TRACK_COLORS[3]),
        mkClip('c11','tk-chords','Am7',7,1,TRACK_COLORS[3]),
        mkClip('c12','tk-chords','Gm7',9,1,TRACK_COLORS[3]),
        mkClip('c13','tk-chords','Dm7',11,1,TRACK_COLORS[3]),
        mkClip('c14','tk-chords','Am7',13,1,TRACK_COLORS[3]),
      ],
    },
    {
      id: 'tk-pad', name: 'Dark Pad', type: 'midi', color: TRACK_COLORS[4],
      gainDb: -10, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
      clips: [
        mkClip('c15','tk-pad','Pad',1,16,TRACK_COLORS[4]),
      ],
    },
    {
      id: 'tk-fx', name: 'FX / Noise', type: 'audio', color: TRACK_COLORS[5],
      gainDb: -12, panCenter: 0, muted: false, soloed: false, armed: false, sends: [], height: 64,
      clips: [
        mkClip('c16','tk-fx','Riser',7,2,TRACK_COLORS[5]),
        mkClip('c17','tk-fx','Impact',9,1,TRACK_COLORS[5]),
      ],
    },
  ],
}

interface ProjectStore {
  project: Project
  selectedTrackId: string | null
  selectedClipId: string | null
  selectTrack: (id: string | null) => void
  selectClip: (id: string | null) => void
  toggleMute: (trackId: string) => void
  toggleSolo: (trackId: string) => void
  toggleArm: (trackId: string) => void
  setTrackGain: (trackId: string, db: number) => void
  setTrackPan: (trackId: string, pan: number) => void
  setProjectName: (name: string) => void
  // Arrangement actions
  moveClip: (clipId: string, newStartBar: number, newTrackId: string) => void
  resizeClip: (clipId: string, newStartBar: number, newLengthBars: number) => void
  addClip: (clip: Clip) => void
  deleteClips: (clipIds: string[]) => void
  splitClip: (clipId: string, atBar: number) => void
  duplicateClips: (clipIds: string[]) => void
  addTrack: (track: Track) => void
  setTrackHeight: (trackId: string, height: number) => void
  setLoopRegion: (startBar: number, endBar: number) => void
  consolidateClips: (clipIds: string[]) => void
  stretchClip: (clipId: string, playbackRate: number) => void
  rippleShiftClips: (trackId: string, pivotBar: number, barDelta: number, excludeClipIds: string[]) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: SEED_PROJECT,
  selectedTrackId: null,
  selectedClipId: null,

  selectTrack: (id) => set({ selectedTrackId: id }),
  selectClip:  (id) => set({ selectedClipId: id }),

  toggleMute: (trackId) => set(s => ({
    project: { ...s.project, tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t) },
  })),

  toggleSolo: (trackId) => set(s => ({
    project: { ...s.project, tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, soloed: !t.soloed } : t) },
  })),

  toggleArm: (trackId) => set(s => ({
    project: { ...s.project, tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, armed: !t.armed } : t) },
  })),

  setTrackGain: (trackId, db) => set(s => ({
    project: { ...s.project, tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, gainDb: db } : t) },
  })),

  setTrackPan: (trackId, pan) => set(s => ({
    project: { ...s.project, tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, panCenter: pan } : t) },
  })),

  setProjectName: (name) => set(s => ({ project: { ...s.project, name } })),

  moveClip: (clipId, newStartBar, newTrackId) => set(s => {
    const tracks = s.project.tracks.map(t => ({
      ...t,
      clips: t.clips.filter(c => c.id !== clipId),
    }))
    let movedClip: Clip | undefined
    s.project.tracks.forEach(t => {
      const found = t.clips.find(c => c.id === clipId)
      if (found) movedClip = { ...found, startBar: newStartBar, trackId: newTrackId }
    })
    if (!movedClip) return {}
    const finalTracks = tracks.map(t =>
      t.id === newTrackId ? { ...t, clips: [...t.clips, movedClip!] } : t
    )
    return { project: { ...s.project, tracks: finalTracks } }
  }),

  resizeClip: (clipId, newStartBar, newLengthBars) => set(s => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id === clipId ? { ...c, startBar: newStartBar, lengthBars: newLengthBars } : c
        ),
      })),
    },
  })),

  addClip: (clip) => set(s => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t =>
        t.id === clip.trackId ? { ...t, clips: [...t.clips, clip] } : t
      ),
    },
  })),

  deleteClips: (clipIds) => set(s => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => ({
        ...t,
        clips: t.clips.filter(c => !clipIds.includes(c.id)),
      })),
    },
  })),

  splitClip: (clipId, atBar) => set(s => {
    let left: Clip | undefined
    let right: Clip | undefined
    s.project.tracks.forEach(t => {
      const clip = t.clips.find(c => c.id === clipId)
      if (!clip) return
      if (atBar <= clip.startBar || atBar >= clip.startBar + clip.lengthBars) return
      left  = { ...clip, id: `${clip.id}-L`, lengthBars: atBar - clip.startBar }
      right = { ...clip, id: `${clip.id}-R`, startBar: atBar, lengthBars: clip.startBar + clip.lengthBars - atBar }
    })
    if (!left || !right) return {}
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: [
            ...t.clips.filter(c => c.id !== clipId),
            ...(t.clips.some(c => c.id === clipId) ? [left!, right!] : []),
          ],
        })),
      },
    }
  }),

  duplicateClips: (clipIds) => set(s => {
    const newClips: Clip[] = []
    s.project.tracks.forEach(t => {
      t.clips.forEach(c => {
        if (clipIds.includes(c.id)) {
          newClips.push({ ...c, id: `${c.id}-dup-${Date.now()}`, startBar: c.startBar + c.lengthBars })
        }
      })
    })
    const byTrack = new Map<string, Clip[]>()
    newClips.forEach(c => {
      const arr = byTrack.get(c.trackId) ?? []
      arr.push(c)
      byTrack.set(c.trackId, arr)
    })
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: [...t.clips, ...(byTrack.get(t.id) ?? [])],
        })),
      },
    }
  }),

  addTrack: (track) => set(s => ({
    project: { ...s.project, tracks: [...s.project.tracks, track] },
  })),

  setTrackHeight: (trackId, height) => set(s => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, height } : t),
    },
  })),

  setLoopRegion: (startBar, endBar) => set(s => ({
    project: { ...s.project, loopStart: startBar, loopEnd: endBar },
  })),

  consolidateClips: (clipIds) => set(s => {
    if (clipIds.length < 2) return {}
    const tsTop = s.project.timeSignatureNumerator

    // Group selected clips by track
    const byTrack = new Map<string, Clip[]>()
    s.project.tracks.forEach(t => {
      const sel = t.clips.filter(c => clipIds.includes(c.id))
      if (sel.length > 0) byTrack.set(t.id, sel)
    })

    const merged: Clip[] = []
    byTrack.forEach((clips, trackId) => {
      if (clips.length < 2) return
      const track = s.project.tracks.find(t => t.id === trackId)
      if (!track) return
      const startBar = Math.min(...clips.map(c => c.startBar))
      const endBar = Math.max(...clips.map(c => c.startBar + c.lengthBars))
      const notes: MidiNote[] = []
      clips.forEach(clip => {
        const offsetBeats = (clip.startBar - startBar) * tsTop
        clip.notes.forEach(n => notes.push({ ...n, id: `${n.id}-m${Date.now()}`, startBeat: n.startBeat + offsetBeats }))
      })
      merged.push({
        id: `clip-consolidated-${Date.now()}-${trackId}`,
        trackId,
        name: clips[0].name,
        startBar,
        lengthBars: endBar - startBar,
        color: track.color,
        muted: false,
        notes,
      })
    })

    const toDelete = new Set(clipIds)
    const mergedByTrack = new Map(merged.map(c => [c.trackId, c]))

    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => ({
          ...t,
          clips: [
            ...t.clips.filter(c => !toDelete.has(c.id)),
            ...(mergedByTrack.has(t.id) ? [mergedByTrack.get(t.id)!] : []),
          ],
        })),
      },
    }
  }),

  stretchClip: (clipId, playbackRate) => set(s => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => c.id === clipId ? { ...c, playbackRate } : c),
      })),
    },
  })),

  rippleShiftClips: (trackId, pivotBar, barDelta, excludeClipIds) => set(s => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map(t => {
        if (t.id !== trackId) return t
        return {
          ...t,
          clips: t.clips.map(c => {
            if (excludeClipIds.includes(c.id)) return c
            if (c.startBar >= pivotBar) return { ...c, startBar: Math.max(1, c.startBar + barDelta) }
            return c
          }),
        }
      }),
    },
  })),
}))
