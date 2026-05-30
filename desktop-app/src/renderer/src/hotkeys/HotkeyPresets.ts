/**
 * HotkeyPresets — DAW shortcut presets.
 * Each preset maps actionId → array of combo strings.
 * Ableton Live 11 / FL Studio 21 / Logic Pro X conventions.
 */

export type PresetName = 'default' | 'ableton' | 'fl' | 'logic'

export const DEFAULT_PRESET: Record<string, string[]> = {
  // Transport
  'transport.play':          ['Space'],
  'transport.stop':          ['Escape'],
  'transport.record':        ['Ctrl+R', 'Cmd+R'],
  'transport.rewind':        ['Home'],
  'transport.loop_toggle':   ['Ctrl+L', 'Cmd+L'],
  'transport.bpm_up':        ['Ctrl+Up'],
  'transport.bpm_down':      ['Ctrl+Down'],
  'transport.bpm_up_fine':   ['Ctrl+Shift+Up'],
  'transport.bpm_down_fine': ['Ctrl+Shift+Down'],

  // Edit
  'edit.undo':               ['Ctrl+Z', 'Cmd+Z'],
  'edit.redo':               ['Ctrl+Shift+Z', 'Cmd+Shift+Z', 'Ctrl+Y'],
  'edit.cut':                ['Ctrl+X', 'Cmd+X'],
  'edit.copy':               ['Ctrl+C', 'Cmd+C'],
  'edit.paste':              ['Ctrl+V', 'Cmd+V'],
  'edit.duplicate':          ['Ctrl+D', 'Cmd+D'],
  'edit.delete':             ['Delete', 'Backspace'],
  'edit.select_all':         ['Ctrl+A', 'Cmd+A'],
  'edit.deselect_all':       ['Ctrl+Shift+A', 'Cmd+Shift+A'],
  'edit.split_at_playhead':  ['S'],
  'edit.quantize':           ['Ctrl+Q', 'Cmd+Q'],

  // Navigation
  'nav.go_to_start':         ['Home', 'Ctrl+Left'],
  'nav.go_to_end':           ['End'],
  'nav.scroll_left':         ['Left'],
  'nav.scroll_right':        ['Right'],
  'nav.zoom_in':             ['Ctrl+=', 'Cmd+='],
  'nav.zoom_out':            ['Ctrl+-', 'Cmd+-'],
  'nav.zoom_fit':            ['Ctrl+0', 'Cmd+0'],
  'nav.zoom_reset':          ['Ctrl+Shift+0'],

  // View
  'view.toggle_mixer':       ['Ctrl+M', 'Cmd+M'],
  'view.toggle_piano_roll':  ['Ctrl+P', 'Cmd+P'],
  'view.toggle_sidebar':     ['Ctrl+B', 'Cmd+B'],
  'view.focus_arrangement':  ['Ctrl+1', 'Cmd+1'],
  'view.focus_mixer':        ['Ctrl+2', 'Cmd+2'],
  'view.focus_pianoroll':    ['Ctrl+3', 'Cmd+3'],

  // Tools
  'tool.pointer':            ['F1'],
  'tool.pencil':             ['F2'],
  'tool.eraser':             ['F3'],
  'tool.split':              ['F4'],
  'tool.zoom':               ['F5'],
  'tool.next':               ['Tab'],
  'tool.prev':               ['Shift+Tab'],

  // Mix
  'mix.mute_selected':       ['M'],
  'mix.solo_selected':       ['Alt+S'],
  'mix.arm_selected':        ['Alt+R'],
}

// ─── Ableton Live 11 preset ───────────────────────────────────────────────────

export const ABLETON_PRESET: Record<string, string[]> = {
  ...DEFAULT_PRESET,
  // Ableton uses Tab to switch arrangement ↔ session
  'view.focus_arrangement':  ['Tab'],
  'view.focus_mixer':        ['Ctrl+Alt+M'],
  // Ableton uses U for quantize
  'edit.quantize':           ['Ctrl+U', 'Cmd+U'],
  // Ableton uses numeric +/-
  'nav.zoom_in':             ['+'],
  'nav.zoom_out':            ['-'],
  // Ableton: Shift+Space → play from selection
  'transport.play':          ['Space'],
  'transport.stop':          ['Space', 'Escape'],
}

// ─── FL Studio 21 preset ──────────────────────────────────────────────────────

export const FL_STUDIO_PRESET: Record<string, string[]> = {
  ...DEFAULT_PRESET,
  'transport.play':          ['Space', 'Ctrl+Space'],
  'transport.stop':          ['Ctrl+H'],
  'transport.record':        ['Ctrl+R'],
  // FL uses Y for redo
  'edit.redo':               ['Ctrl+Y'],
  // FL uses B for duplicate
  'edit.duplicate':          ['Ctrl+B'],
  // FL uses Delete only
  'edit.delete':             ['Delete'],
  // FL split at song position
  'edit.split_at_playhead':  ['Ctrl+S'],
  'nav.zoom_in':             ['Ctrl+='],
  'nav.zoom_out':            ['Ctrl+-'],
  'mix.mute_selected':       ['Alt+M'],
  'mix.solo_selected':       ['Alt+S'],
  'view.toggle_mixer':       ['F9'],
  'view.toggle_piano_roll':  ['F7'],
}

// ─── Logic Pro X preset ───────────────────────────────────────────────────────

export const LOGIC_PRESET: Record<string, string[]> = {
  ...DEFAULT_PRESET,
  'transport.play':          ['Space', 'Return'],
  'transport.stop':          ['Space'],
  'transport.record':        ['R'],
  'transport.rewind':        ['Return'],
  // Logic uses C for cycle/loop
  'transport.loop_toggle':   ['C'],
  'edit.undo':               ['Cmd+Z'],
  'edit.redo':               ['Cmd+Shift+Z'],
  // Logic split = Cmd+T
  'edit.split_at_playhead':  ['Cmd+T'],
  // Logic quantize = just Q
  'edit.quantize':           ['Q'],
  'edit.delete':             ['Backspace', 'Delete'],
  'nav.go_to_start':         ['Home', 'Cmd+Left'],
  'nav.zoom_in':             ['Ctrl+Right'],
  'nav.zoom_out':            ['Ctrl+Left'],
  'view.toggle_mixer':       ['Cmd+2'],
  'view.toggle_piano_roll':  ['Cmd+4'],
  'mix.solo_selected':       ['S'],
  'mix.mute_selected':       ['M'],
}

export const PRESETS: Record<PresetName, Record<string, string[]>> = {
  default: DEFAULT_PRESET,
  ableton: ABLETON_PRESET,
  fl:      FL_STUDIO_PRESET,
  logic:   LOGIC_PRESET,
}
