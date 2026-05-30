/**
 * registerActions — wires all built-in actions into an ActionRegistry.
 * Store imports are lazy (called inside handler closures) so this module
 * can be loaded without a full store environment during tests.
 */

import type { ActionRegistry } from './ActionRegistry.ts'

export function registerActions(registry: ActionRegistry): void {

  // ── Transport ──────────────────────────────────────────────────────────────

  registry.register({
    id: 'transport.play', label: 'Play', category: 'transport',
    description: 'Start or resume playback',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      const s = useTransportStore.getState()
      s.playing ? s.stop() : s.play()
    },
  })

  registry.register({
    id: 'transport.stop', label: 'Stop', category: 'transport',
    description: 'Stop playback and return to zero',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.getState().stop()
    },
  })

  registry.register({
    id: 'transport.record', label: 'Record', category: 'transport',
    description: 'Toggle record mode',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.getState().toggleRecord()
    },
  })

  registry.register({
    id: 'transport.rewind', label: 'Rewind to Start', category: 'transport',
    description: 'Jump playhead to bar 1',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.setState({ positionBar: 1, positionBeat: 0, positionTick: 0 })
    },
  })

  registry.register({
    id: 'transport.loop_toggle', label: 'Toggle Loop', category: 'transport',
    description: 'Enable or disable loop region',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.getState().toggleLoop()
    },
  })

  registry.register({
    id: 'transport.bpm_up', label: 'BPM +1', category: 'transport',
    description: 'Increase BPM by 1',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.getState().nudgeBpm(1)
    },
  })

  registry.register({
    id: 'transport.bpm_down', label: 'BPM -1', category: 'transport',
    description: 'Decrease BPM by 1',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.getState().nudgeBpm(-1)
    },
  })

  registry.register({
    id: 'transport.bpm_up_fine', label: 'BPM +0.1', category: 'transport',
    description: 'Increase BPM by 0.1',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.getState().nudgeBpm(0.1)
    },
  })

  registry.register({
    id: 'transport.bpm_down_fine', label: 'BPM -0.1', category: 'transport',
    description: 'Decrease BPM by 0.1',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.getState().nudgeBpm(-0.1)
    },
  })

  // ── Edit ───────────────────────────────────────────────────────────────────

  registry.register({
    id: 'edit.undo', label: 'Undo', category: 'edit',
    description: 'Undo last action',
    handler: () => {
      const { useHistoryStore } = require('../store/historyStore') as typeof import('../store/historyStore')
      useHistoryStore.getState().undo()
    },
  })

  registry.register({
    id: 'edit.redo', label: 'Redo', category: 'edit',
    description: 'Redo last undone action',
    handler: () => {
      const { useHistoryStore } = require('../store/historyStore') as typeof import('../store/historyStore')
      useHistoryStore.getState().redo()
    },
  })

  registry.register({
    id: 'edit.duplicate', label: 'Duplicate', category: 'edit',
    description: 'Duplicate selected clips',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const { undoableDuplicateClips } = require('../store/undoableActions') as typeof import('../store/undoableActions')
      const id = useProjectStore.getState().selectedClipId
      if (id) undoableDuplicateClips([id])
    },
  })

  registry.register({
    id: 'edit.delete', label: 'Delete', category: 'edit',
    description: 'Delete selected clips',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const { undoableDeleteClips } = require('../store/undoableActions') as typeof import('../store/undoableActions')
      const id = useProjectStore.getState().selectedClipId
      if (id) undoableDeleteClips([id])
    },
  })

  registry.register({
    id: 'edit.select_all', label: 'Select All', category: 'edit',
    description: 'Select all clips on all tracks',
    handler: () => {
      // Selection is managed per-app; signal via a UI store event
      // Components subscribe to this store key
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.setState({ selectAllSignal: (useUIStore.getState().selectAllSignal ?? 0) + 1 } as Parameters<typeof useUIStore.setState>[0])
    },
  })

  registry.register({
    id: 'edit.deselect_all', label: 'Deselect All', category: 'edit',
    description: 'Clear clip selection',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      useProjectStore.getState().selectClip(null)
    },
  })

  registry.register({
    id: 'edit.split_at_playhead', label: 'Split at Playhead', category: 'edit',
    description: 'Split selected clip at current playhead position',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      const { undoableSplitClip } = require('../store/undoableActions') as typeof import('../store/undoableActions')
      const clipId = useProjectStore.getState().selectedClipId
      const bar    = useTransportStore.getState().positionBar
      if (clipId) undoableSplitClip(clipId, bar)
    },
  })

  registry.register({
    id: 'edit.quantize', label: 'Quantize', category: 'edit',
    description: 'Snap selected clip to nearest bar',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const { undoableMoveClip } = require('../store/undoableActions') as typeof import('../store/undoableActions')
      const state  = useProjectStore.getState()
      const clipId = state.selectedClipId
      if (!clipId) return
      // Find clip and snap its startBar to nearest integer
      for (const t of state.project.tracks) {
        const clip = t.clips.find((c) => c.id === clipId)
        if (clip) {
          const snapped = Math.round(clip.startBar)
          if (snapped !== clip.startBar) {
            undoableMoveClip(clipId, snapped, t.id)
          }
          break
        }
      }
    },
  })

  registry.register({
    id: 'edit.cut', label: 'Cut', category: 'edit',
    description: 'Cut selected clip to clipboard',
    handler: () => {
      // Trigger browser clipboard via custom event — components listen
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const { undoableDeleteClips } = require('../store/undoableActions') as typeof import('../store/undoableActions')
      const id = useProjectStore.getState().selectedClipId
      if (id) undoableDeleteClips([id])
    },
  })

  // ── Navigation ─────────────────────────────────────────────────────────────

  registry.register({
    id: 'nav.go_to_start', label: 'Go to Start', category: 'navigation',
    description: 'Jump to bar 1',
    handler: () => {
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      useTransportStore.setState({ positionBar: 1, positionBeat: 0, positionTick: 0 })
    },
  })

  registry.register({
    id: 'nav.go_to_end', label: 'Go to End', category: 'navigation',
    description: 'Jump to last clip end',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const { useTransportStore } = require('../store/transportStore') as typeof import('../store/transportStore')
      let maxBar = 1
      for (const t of useProjectStore.getState().project.tracks) {
        for (const c of t.clips) {
          maxBar = Math.max(maxBar, c.startBar + c.lengthBars)
        }
      }
      useTransportStore.setState({ positionBar: maxBar, positionBeat: 0, positionTick: 0 })
    },
  })

  registry.register({
    id: 'nav.scroll_left', label: 'Scroll Left', category: 'navigation',
    description: 'Scroll timeline left 4 bars',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().scrollBy(-4)
    },
  })

  registry.register({
    id: 'nav.scroll_right', label: 'Scroll Right', category: 'navigation',
    description: 'Scroll timeline right 4 bars',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().scrollBy(4)
    },
  })

  registry.register({
    id: 'nav.zoom_in', label: 'Zoom In', category: 'navigation',
    description: 'Zoom in horizontally',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      const s = useUIStore.getState()
      s.setZoomX(s.zoomX * 1.5)
    },
  })

  registry.register({
    id: 'nav.zoom_out', label: 'Zoom Out', category: 'navigation',
    description: 'Zoom out horizontally',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      const s = useUIStore.getState()
      s.setZoomX(s.zoomX / 1.5)
    },
  })

  registry.register({
    id: 'nav.zoom_fit', label: 'Zoom to Fit', category: 'navigation',
    description: 'Fit all content in view',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().setZoomX(1)
      useUIStore.getState().setScrollOffset(0)
    },
  })

  registry.register({
    id: 'nav.zoom_reset', label: 'Reset Zoom', category: 'navigation',
    description: 'Reset zoom to 100%',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().setZoomX(1)
    },
  })

  // ── View ───────────────────────────────────────────────────────────────────

  registry.register({
    id: 'view.toggle_mixer', label: 'Toggle Mixer', category: 'view',
    description: 'Show or hide the mixer panel',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().toggleMixer()
    },
  })

  registry.register({
    id: 'view.toggle_piano_roll', label: 'Toggle Piano Roll', category: 'view',
    description: 'Show or hide the piano roll',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().togglePianoRoll()
    },
  })

  registry.register({
    id: 'view.toggle_sidebar', label: 'Toggle Sidebar', category: 'view',
    description: 'Show or hide the sidebar',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().toggleSidebar()
    },
  })

  registry.register({
    id: 'view.focus_arrangement', label: 'Arrangement', category: 'view',
    description: 'Switch to Arrangement view',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().setView('arrangement')
    },
  })

  registry.register({
    id: 'view.focus_mixer', label: 'Mixer View', category: 'view',
    description: 'Switch to Mixer view',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().setView('mixer')
    },
  })

  registry.register({
    id: 'view.focus_pianoroll', label: 'Piano Roll View', category: 'view',
    description: 'Switch to Piano Roll view',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().setView('pianoroll')
    },
  })

  // ── Tools ──────────────────────────────────────────────────────────────────

  const toolActions = [
    { id: 'tool.pointer', label: 'Pointer Tool', tool: 'pointer' as const },
    { id: 'tool.pencil',  label: 'Pencil Tool',  tool: 'pencil'  as const },
    { id: 'tool.eraser',  label: 'Eraser Tool',  tool: 'eraser'  as const },
    { id: 'tool.split',   label: 'Split Tool',   tool: 'split'   as const },
    { id: 'tool.zoom',    label: 'Zoom Tool',    tool: 'zoom'    as const },
  ]

  for (const { id, label, tool } of toolActions) {
    const t = tool
    registry.register({
      id, label, category: 'tool',
      description: `Activate ${label}`,
      handler: () => {
        const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
        useUIStore.getState().setActiveTool(t)
      },
    })
  }

  registry.register({
    id: 'tool.next', label: 'Next Tool', category: 'tool',
    description: 'Cycle to next tool',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().cycleTool(1)
    },
  })

  registry.register({
    id: 'tool.prev', label: 'Previous Tool', category: 'tool',
    description: 'Cycle to previous tool',
    handler: () => {
      const { useUIStore } = require('../store/uiStore') as typeof import('../store/uiStore')
      useUIStore.getState().cycleTool(-1)
    },
  })

  // ── Mix ────────────────────────────────────────────────────────────────────

  registry.register({
    id: 'mix.mute_selected', label: 'Mute Track', category: 'mix',
    description: 'Toggle mute on selected track',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const { undoableToggleMute } = require('../store/undoableActions') as typeof import('../store/undoableActions')
      const id = useProjectStore.getState().selectedTrackId
      if (id) undoableToggleMute(id)
    },
  })

  registry.register({
    id: 'mix.solo_selected', label: 'Solo Track', category: 'mix',
    description: 'Toggle solo on selected track',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const { undoableToggleSolo } = require('../store/undoableActions') as typeof import('../store/undoableActions')
      const id = useProjectStore.getState().selectedTrackId
      if (id) undoableToggleSolo(id)
    },
  })

  registry.register({
    id: 'mix.arm_selected', label: 'Arm Track', category: 'mix',
    description: 'Toggle record arm on selected track',
    handler: () => {
      const { useProjectStore } = require('../store/projectStore') as typeof import('../store/projectStore')
      const id = useProjectStore.getState().selectedTrackId
      if (id) useProjectStore.getState().toggleArm(id)
    },
  })
}
