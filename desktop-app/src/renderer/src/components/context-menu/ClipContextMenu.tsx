import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { useTransportStore } from '../../store/transportStore'
import {
  undoableDeleteClips,
  undoableDuplicateClips,
  undoableSplitClip,
} from '../../store/undoableActions'

interface ClipContextMenuProps {
  x: number
  y: number
  clipId: string
  clipType: 'audio' | 'midi'
  onClose: () => void
}

export function ClipContextMenu({ x, y, clipId, clipType, onClose }: ClipContextMenuProps): JSX.Element {
  const items: ContextMenuItem[] = [
    {
      id: 'cut',
      label: 'Cut',
      shortcut: 'Ctrl+X',
      icon: '✂️',
      action: () => undoableDeleteClips([clipId]),
    },
    {
      id: 'copy',
      label: 'Copy',
      shortcut: 'Ctrl+C',
      icon: '📋',
      action: () => { /* copy-to-clipboard not yet implemented */ },
    },
    {
      id: 'delete',
      label: 'Delete',
      shortcut: 'Del',
      icon: '🗑',
      action: () => undoableDeleteClips([clipId]),
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      icon: '⧉',
      action: () => undoableDuplicateClips([clipId]),
    },
    { id: 'sep1', label: '', separator: true },
    {
      id: 'split',
      label: 'Split at Playhead',
      icon: '⚡',
      action: () => {
        const positionBar = useTransportStore.getState().positionBar
        undoableSplitClip(clipId, positionBar)
      },
    },
    {
      id: 'loop',
      label: 'Toggle Mute',
      icon: '🔇',
      action: () => {
        useProjectStore.setState((s) => ({
          project: {
            ...s.project,
            tracks: s.project.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId ? { ...c, muted: !c.muted } : c,
              ),
            })),
          },
        }))
      },
    },
    {
      id: 'rename',
      label: 'Rename',
      icon: '✏️',
      action: () => {
        const name = window.prompt('Clip name:')
        if (name) {
          useProjectStore.setState((s) => ({
            project: {
              ...s.project,
              tracks: s.project.tracks.map((t) => ({
                ...t,
                clips: t.clips.map((c) =>
                  c.id === clipId ? { ...c, name } : c,
                ),
              })),
            },
          }))
        }
      },
    },
    ...(clipType === 'midi'
      ? [
          { id: 'sep2', label: '', separator: true },
          {
            id: 'open-piano-roll',
            label: 'Open in Piano Roll',
            icon: '🎹',
            action: () => {
              useUIStore.getState().setView('pianoroll')
              useProjectStore.getState().selectClip(clipId)
            },
          },
        ]
      : []),
    { id: 'sep3', label: '', separator: true },
    {
      id: 'properties',
      label: 'Properties',
      icon: 'ℹ️',
      action: () => {
        const store = useProjectStore.getState()
        let clipInfo: import('../../types/project').Clip | null = null
        store.project.tracks.forEach((t) => {
          const found = t.clips.find((c) => c.id === clipId)
          if (found) clipInfo = found
        })
        void clipInfo // properties panel integration point
      },
    },
  ]

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />
}
