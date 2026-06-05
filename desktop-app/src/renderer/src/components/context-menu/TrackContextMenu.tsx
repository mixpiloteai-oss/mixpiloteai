import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { useProjectStore } from '../../store/projectStore'
import { undoableAddTrack, undoableDuplicateClips } from '../../store/undoableActions'

interface TrackContextMenuProps {
  x: number
  y: number
  trackId: string
  onClose: () => void
}

const TRACK_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export function TrackContextMenu({ x, y, trackId, onClose }: TrackContextMenuProps): JSX.Element {
  const items: ContextMenuItem[] = [
    {
      id: 'rename',
      label: 'Rename',
      icon: '✏️',
      action: () => {
        const current = useProjectStore.getState().project.tracks.find(t => t.id === trackId)?.name ?? ''
        const name = window.prompt('Track name:', current)
        if (name && name.trim()) {
          useProjectStore.getState().renameTrack(trackId, name.trim())
        }
      },
    },
    {
      id: 'duplicate',
      label: 'Duplicate Track',
      icon: '⧉',
      action: () => {
        const store = useProjectStore.getState()
        const track = store.project.tracks.find((t) => t.id === trackId)
        if (!track) return
        const newTrack = {
          ...track,
          id: `tk-dup-${Date.now()}`,
          name: `${track.name} (copy)`,
          clips: track.clips.map((c) => ({ ...c, id: `${c.id}-dup-${Date.now()}`, trackId: `tk-dup-${Date.now()}` })),
        }
        undoableAddTrack(newTrack)
        const allClipIds = track.clips.map((c) => c.id)
        if (allClipIds.length > 0) {
          undoableDuplicateClips(allClipIds)
        }
      },
    },
    {
      id: 'delete',
      label: 'Delete Track',
      icon: '🗑',
      action: () => {
        const store = useProjectStore.getState()
        const track = store.project.tracks.find((t) => t.id === trackId)
        if (!track) return
        useProjectStore.setState((s) => ({
          project: {
            ...s.project,
            tracks: s.project.tracks.filter((t) => t.id !== trackId),
          },
        }))
      },
    },
    { id: 'sep1', label: '', separator: true },
    {
      id: 'mute',
      label: 'Mute',
      icon: '🔇',
      action: () => useProjectStore.getState().toggleMute(trackId),
    },
    {
      id: 'solo',
      label: 'Solo',
      icon: '🎯',
      action: () => useProjectStore.getState().toggleSolo(trackId),
    },
    {
      id: 'arm',
      label: 'Arm for Record',
      icon: '⏺',
      action: () => useProjectStore.getState().toggleArm(trackId),
    },
    { id: 'sep2', label: '', separator: true },
    ...TRACK_COLORS.map((color, i) => ({
      id: `color-${i}`,
      label: `Color ${i + 1}`,
      icon: '●',
      action: () => {
        useProjectStore.setState((s) => ({
          project: {
            ...s.project,
            tracks: s.project.tracks.map((t) =>
              t.id === trackId ? { ...t, color } : t,
            ),
          },
        }))
      },
    })),
    { id: 'sep3', label: '', separator: true },
    {
      id: 'add-midi-after',
      label: 'Add MIDI Track After',
      icon: '🎹',
      action: () => {
        const store = useProjectStore.getState()
        const count = store.project.tracks.length
        undoableAddTrack({
          id: `tk-midi-${Date.now()}`,
          name: `MIDI ${count + 1}`,
          type: 'midi',
          color: TRACK_COLORS[count % TRACK_COLORS.length],
          clips: [],
          gainDb: 0,
          panCenter: 0,
          muted: false,
          soloed: false,
          armed: false,
          sends: [],
          height: 64,
        })
      },
    },
    {
      id: 'add-audio-after',
      label: 'Add Audio Track After',
      icon: '🎵',
      action: () => {
        const store = useProjectStore.getState()
        const count = store.project.tracks.length
        undoableAddTrack({
          id: `tk-audio-${Date.now()}`,
          name: `Audio ${count + 1}`,
          type: 'audio',
          color: TRACK_COLORS[count % TRACK_COLORS.length],
          clips: [],
          gainDb: 0,
          panCenter: 0,
          muted: false,
          soloed: false,
          armed: false,
          sends: [],
          height: 64,
        })
      },
    },
  ]

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />
}
