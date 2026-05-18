import { create } from 'zustand'
import type { Project, Clip } from '../types/project'

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
}))
