import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { useProjectStore } from '../../store/projectStore'
import { useTransportStore } from '../../store/transportStore'
import { undoableAddTrack } from '../../store/undoableActions'

interface TimelineContextMenuProps {
  x: number
  y: number
  barPosition: number
  onClose: () => void
}

const TRACK_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export function TimelineContextMenu({ x, y, barPosition, onClose }: TimelineContextMenuProps): JSX.Element {
  const items: ContextMenuItem[] = [
    {
      id: 'add-audio',
      label: 'Insert Audio Track',
      icon: '🎵',
      action: () => {
        const count = useProjectStore.getState().project.tracks.length
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
    {
      id: 'add-midi',
      label: 'Insert MIDI Track',
      icon: '🎹',
      action: () => {
        const count = useProjectStore.getState().project.tracks.length
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
    { id: 'sep1', label: '', separator: true },
    {
      id: 'paste',
      label: 'Paste',
      shortcut: 'Ctrl+V',
      icon: '📋',
      action: () => { void barPosition /* paste-at-bar not yet implemented */ },
    },
    { id: 'sep2', label: '', separator: true },
    {
      id: 'loop-start',
      label: 'Set Loop Start Here',
      icon: '◀',
      action: () => {
        const transport = useTransportStore.getState()
        transport.setLoopRegion(barPosition, transport.loopEndBar)
      },
    },
    {
      id: 'loop-end',
      label: 'Set Loop End Here',
      icon: '▶',
      action: () => {
        const transport = useTransportStore.getState()
        transport.setLoopRegion(transport.loopStartBar, barPosition)
      },
    },
  ]

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />
}
