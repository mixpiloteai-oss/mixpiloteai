// ─── recordingStore ────────────────────────────────────────────────────────────
// Zustand store for per-track recording state, takes, and global record settings.
// No persistence.

import { create } from 'zustand'
import type { Take } from '../audio/recording/TakeManager.ts'
import type { AudioDeviceInfo } from '../audio/recording/InputDeviceManager.ts'

export type RecordingStatus = 'idle' | 'armed' | 'recording' | 'stopping'

export interface RecordingState {
  status:      RecordingStatus
  startTime:   number | null
  currentTake: number
  sessionId:   string | null
}

interface RecordingStore {
  // Per-track state
  armedTracks:     Record<string, boolean>
  recordingStates: Record<string, RecordingState>
  takes:           Record<string, Take[]>
  activeTakes:     Record<string, string>          // trackId → takeId
  selectedInputs:  Record<string, string>          // trackId → deviceId
  channelCounts:   Record<string, 1 | 2>           // trackId → channelCount
  monitorEnabled:  Record<string, boolean>
  directMonitor:   Record<string, boolean>
  inputGains:      Record<string, number>          // trackId → gainDb

  // Global settings
  inputDevices:    AudioDeviceInfo[]
  recordFormat:    'wav' | 'flac'
  recordBitDepth:  16 | 24 | 32
  punchIn:         number | null
  punchOut:        number | null
  loopRecording:   boolean

  // Actions
  armTrack:            (trackId: string) => void
  disarmTrack:         (trackId: string) => void
  setRecordingState:   (trackId: string, state: Partial<RecordingState>) => void
  addTake:             (trackId: string, take: Take) => void
  setActiveTake:       (trackId: string, takeId: string) => void
  deleteTake:          (trackId: string, takeId: string) => void
  renameTake:          (trackId: string, takeId: string, label: string) => void
  setInputDevice:      (trackId: string, deviceId: string) => void
  setChannelCount:     (trackId: string, count: 1 | 2) => void
  setInputGain:        (trackId: string, gainDb: number) => void
  toggleMonitor:       (trackId: string) => void
  toggleDirectMonitor: (trackId: string) => void
  setInputDevices:     (devices: AudioDeviceInfo[]) => void
  setRecordFormat:     (fmt: 'wav' | 'flac') => void
  setRecordBitDepth:   (depth: 16 | 24 | 32) => void
  setPunchIn:          (bar: number | null) => void
  setPunchOut:         (bar: number | null) => void
  toggleLoopRecording: () => void
}

export const useRecordingStore = create<RecordingStore>((set, _get) => ({
  armedTracks:     {},
  recordingStates: {},
  takes:           {},
  activeTakes:     {},
  selectedInputs:  {},
  channelCounts:   {},
  monitorEnabled:  {},
  directMonitor:   {},
  inputGains:      {},
  inputDevices:    [],
  recordFormat:    'wav',
  recordBitDepth:  24,
  punchIn:         null,
  punchOut:        null,
  loopRecording:   false,

  armTrack: (trackId) => set(s => ({
    armedTracks: { ...s.armedTracks, [trackId]: true },
    recordingStates: {
      ...s.recordingStates,
      [trackId]: {
        status:      'armed',
        startTime:   null,
        currentTake: (s.takes[trackId]?.length ?? 0) + 1,
        sessionId:   null,
      },
    },
  })),

  disarmTrack: (trackId) => set(s => {
    const { [trackId]: _omit, ...rest } = s.armedTracks
    return {
      armedTracks: rest,
      recordingStates: {
        ...s.recordingStates,
        [trackId]: { status: 'idle', startTime: null, currentTake: 0, sessionId: null },
      },
    }
  }),

  setRecordingState: (trackId, patch) => set(s => ({
    recordingStates: {
      ...s.recordingStates,
      [trackId]: {
        ...(s.recordingStates[trackId] ?? { status: 'idle', startTime: null, currentTake: 0, sessionId: null }),
        ...patch,
      },
    },
  })),

  addTake: (trackId, take) => set(s => ({
    takes:       { ...s.takes, [trackId]: [...(s.takes[trackId] ?? []), take] },
    activeTakes: { ...s.activeTakes, [trackId]: take.id },
  })),

  setActiveTake: (trackId, takeId) => set(s => ({
    activeTakes: { ...s.activeTakes, [trackId]: takeId },
  })),

  deleteTake: (trackId, takeId) => set(s => {
    const list      = (s.takes[trackId] ?? []).filter(t => t.id !== takeId)
    const active    = s.activeTakes[trackId]
    const newActive = active === takeId ? (list[list.length - 1]?.id ?? '') : active
    return {
      takes:       { ...s.takes, [trackId]: list },
      activeTakes: { ...s.activeTakes, [trackId]: newActive },
    }
  }),

  renameTake: (trackId, takeId, label) => set(s => ({
    takes: {
      ...s.takes,
      [trackId]: (s.takes[trackId] ?? []).map(t => t.id === takeId ? { ...t, label } : t),
    },
  })),

  setInputDevice:  (trackId, deviceId) => set(s => ({ selectedInputs: { ...s.selectedInputs, [trackId]: deviceId } })),
  setChannelCount: (trackId, count)    => set(s => ({ channelCounts:  { ...s.channelCounts,  [trackId]: count } })),
  setInputGain:    (trackId, gainDb)   => set(s => ({ inputGains:     { ...s.inputGains,     [trackId]: gainDb } })),

  toggleMonitor:       (trackId) => set(s => ({ monitorEnabled: { ...s.monitorEnabled, [trackId]: !s.monitorEnabled[trackId] } })),
  toggleDirectMonitor: (trackId) => set(s => ({ directMonitor:  { ...s.directMonitor,  [trackId]: !s.directMonitor[trackId] } })),

  setInputDevices:   (devices) => set({ inputDevices: devices }),
  setRecordFormat:   (fmt)     => set({ recordFormat: fmt }),
  setRecordBitDepth: (depth)   => set({ recordBitDepth: depth }),
  setPunchIn:        (bar)     => set({ punchIn: bar }),
  setPunchOut:       (bar)     => set({ punchOut: bar }),
  toggleLoopRecording: ()      => set(s => ({ loopRecording: !s.loopRecording })),
}))
