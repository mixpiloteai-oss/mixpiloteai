/**
 * Undoable wrappers for project, mixer, and MIDI operations.
 *
 * Each function:
 *  1. Snapshots the relevant slice of state (structuredClone)
 *  2. Delegates to the underlying store action
 *  3. Captures the post-action state
 *  4. Pushes a HistoryCommand whose undo/redo are pure setState calls
 *
 * Call these instead of the raw store actions from components when
 * the operation should be undoable.
 */

import { useProjectStore } from './projectStore'
import { _pushOrBatch, withUndoGroup } from './historyStore'
import type { Clip, MidiNote, Track } from '../types/project'

// Re-export for convenience
export { withUndoGroup }

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

function snapProject() {
  return structuredClone(useProjectStore.getState().project)
}

function restoreProject(snap: ReturnType<typeof snapProject>) {
  useProjectStore.setState({ project: snap })
}

// ─── Arrangement — Clips ──────────────────────────────────────────────────────

export function undoableMoveClip(
  clipId: string,
  newStartBar: number,
  newTrackId: string,
): void {
  const before = snapProject()
  useProjectStore.getState().moveClip(clipId, newStartBar, newTrackId)
  const after = snapProject()
  _pushOrBatch({
    label:  'Move clip',
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableResizeClip(
  clipId: string,
  newStartBar: number,
  newLengthBars: number,
): void {
  const before = snapProject()
  useProjectStore.getState().resizeClip(clipId, newStartBar, newLengthBars)
  const after = snapProject()
  _pushOrBatch({
    label:  'Resize clip',
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableAddClip(clip: Clip): void {
  const before = snapProject()
  useProjectStore.getState().addClip(clip)
  const after = snapProject()
  _pushOrBatch({
    label:  'Add clip',
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableDeleteClips(clipIds: string[]): void {
  const before = snapProject()
  useProjectStore.getState().deleteClips(clipIds)
  const after = snapProject()
  const label = clipIds.length === 1 ? 'Delete clip' : `Delete ${clipIds.length} clips`
  _pushOrBatch({
    label,
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableSplitClip(clipId: string, atBar: number): void {
  const before = snapProject()
  useProjectStore.getState().splitClip(clipId, atBar)
  const after = snapProject()
  _pushOrBatch({
    label:  'Split clip',
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableDuplicateClips(clipIds: string[]): void {
  const before = snapProject()
  useProjectStore.getState().duplicateClips(clipIds)
  const after = snapProject()
  const label = clipIds.length === 1 ? 'Duplicate clip' : `Duplicate ${clipIds.length} clips`
  _pushOrBatch({
    label,
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableConsolidateClips(clipIds: string[]): void {
  const before = snapProject()
  useProjectStore.getState().consolidateClips(clipIds)
  const after = snapProject()
  _pushOrBatch({
    label:  'Consolidate clips',
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableStretchClip(clipId: string, playbackRate: number): void {
  const before = snapProject()
  useProjectStore.getState().stretchClip(clipId, playbackRate)
  const after = snapProject()
  _pushOrBatch({
    label:  'Stretch clip',
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableRippleShiftClips(
  trackId: string,
  pivotBar: number,
  barDelta: number,
  excludeClipIds: string[],
): void {
  const before = snapProject()
  useProjectStore.getState().rippleShiftClips(trackId, pivotBar, barDelta, excludeClipIds)
  const after = snapProject()
  _pushOrBatch({
    label:  'Ripple shift',
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

// ─── Arrangement — Tracks ─────────────────────────────────────────────────────

export function undoableAddTrack(track: Track): void {
  const before = snapProject()
  useProjectStore.getState().addTrack(track)
  const after = snapProject()
  _pushOrBatch({
    label:  `Add track "${track.name}"`,
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableSetProjectName(name: string): void {
  const before = snapProject()
  useProjectStore.getState().setProjectName(name)
  const after = snapProject()
  _pushOrBatch({
    label:  'Rename project',
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

// ─── Mixer ────────────────────────────────────────────────────────────────────

export function undoableSetTrackGain(trackId: string, gainDb: number): void {
  const before = snapProject()
  useProjectStore.getState().setTrackGain(trackId, gainDb)
  const after = snapProject()
  _pushOrBatch({
    label:  'Set gain',
    domain: 'mixer',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableSetTrackPan(trackId: string, pan: number): void {
  const before = snapProject()
  useProjectStore.getState().setTrackPan(trackId, pan)
  const after = snapProject()
  _pushOrBatch({
    label:  'Set pan',
    domain: 'mixer',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableToggleMute(trackId: string): void {
  const before = snapProject()
  useProjectStore.getState().toggleMute(trackId)
  const after = snapProject()
  const track = after.tracks.find((t) => t.id === trackId)
  const label = track ? (track.muted ? 'Mute track' : 'Unmute track') : 'Toggle mute'
  _pushOrBatch({
    label,
    domain: 'mixer',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableToggleSolo(trackId: string): void {
  const before = snapProject()
  useProjectStore.getState().toggleSolo(trackId)
  const after = snapProject()
  _pushOrBatch({
    label:  'Toggle solo',
    domain: 'mixer',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableSetBpm(bpm: number): void {
  // BPM lives on the project
  const before = snapProject()
  // BPM is stored in projectStore.project.bpm
  useProjectStore.setState((s) => ({
    project: { ...s.project, bpm },
  }))
  const after = snapProject()
  _pushOrBatch({
    label:  `Set BPM to ${bpm}`,
    domain: 'arrangement',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

// ─── MIDI — Note editing (piano roll) ────────────────────────────────────────
// Notes live on clip.notes inside projectStore, so snapshots cover them.

export function undoableAddNote(clipId: string, note: MidiNote): void {
  const before = snapProject()
  // Find the clip and add the note immutably
  useProjectStore.setState((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, notes: [...c.notes, note] } : c
        ),
      })),
    },
  }))
  const after = snapProject()
  _pushOrBatch({
    label:  'Add note',
    domain: 'midi',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableDeleteNotes(clipId: string, noteIds: string[]): void {
  const before = snapProject()
  useProjectStore.setState((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? { ...c, notes: c.notes.filter((n) => !noteIds.includes(n.id)) }
            : c
        ),
      })),
    },
  }))
  const after = snapProject()
  const label = noteIds.length === 1 ? 'Delete note' : `Delete ${noteIds.length} notes`
  _pushOrBatch({
    label,
    domain: 'midi',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableMoveNote(
  clipId: string,
  noteId: string,
  newStartBeat: number,
  newPitch: number,
): void {
  const before = snapProject()
  useProjectStore.setState((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                notes: c.notes.map((n) =>
                  n.id === noteId
                    ? { ...n, startBeat: newStartBeat, pitch: newPitch }
                    : n
                ),
              }
            : c
        ),
      })),
    },
  }))
  const after = snapProject()
  _pushOrBatch({
    label:  'Move note',
    domain: 'midi',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableResizeNote(
  clipId: string,
  noteId: string,
  newLengthBeats: number,
): void {
  const before = snapProject()
  useProjectStore.setState((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                notes: c.notes.map((n) =>
                  n.id === noteId ? { ...n, lengthBeats: newLengthBeats } : n
                ),
              }
            : c
        ),
      })),
    },
  }))
  const after = snapProject()
  _pushOrBatch({
    label:  'Resize note',
    domain: 'midi',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

export function undoableSetNoteVelocity(
  clipId: string,
  noteId: string,
  velocity: number,
): void {
  const before = snapProject()
  useProjectStore.setState((s) => ({
    project: {
      ...s.project,
      tracks: s.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                notes: c.notes.map((n) =>
                  n.id === noteId ? { ...n, velocity } : n
                ),
              }
            : c
        ),
      })),
    },
  }))
  const after = snapProject()
  _pushOrBatch({
    label:  'Set velocity',
    domain: 'midi',
    undo:   () => restoreProject(before),
    redo:   () => restoreProject(after),
  })
}

// ─── Plugin parameter (fire-and-forget IPC, undo restores value via IPC) ─────

export function undoablePluginSetParameter(
  instanceId: string,
  paramId: number,
  newValue: number,
  oldValue: number,
  paramLabel = 'parameter',
): void {
  _pushOrBatch({
    label:  `Set plugin ${paramLabel}`,
    domain: 'plugin',
    undo: () => {
      window.electronAPI?.pluginSetParameter(instanceId, paramId, oldValue).catch(() => {})
    },
    redo: () => {
      window.electronAPI?.pluginSetParameter(instanceId, paramId, newValue).catch(() => {})
    },
  })
}

// ─── Automation — placeholder (no automation store yet) ───────────────────────

/**
 * Record an automation point change for undo/redo.
 * Call after updating the automation value in whatever store manages it.
 */
export function undoableAutomationChange(
  label: string,
  undo: () => void,
  redo: () => void,
): void {
  _pushOrBatch({ label, domain: 'automation', undo, redo })
}
