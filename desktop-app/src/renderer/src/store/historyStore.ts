import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HistoryDomain =
  | 'arrangement'
  | 'mixer'
  | 'midi'
  | 'automation'
  | 'plugin'
  | 'editor'

export interface HistoryCommand {
  id:        string
  label:     string
  domain:    HistoryDomain
  timestamp: number
  undo():    void
  redo():    void
}

export type HistoryEntry = Omit<HistoryCommand, 'undo' | 'redo'>

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 100

// ─── State ────────────────────────────────────────────────────────────────────

interface HistoryState {
  // Undo stack — most-recent entry is last
  past:   HistoryCommand[]
  // Redo stack — most-recent entry is first
  future: HistoryCommand[]

  // Whether the last undo/redo operation threw (anti-corruption flag)
  corrupted: boolean

  // ── Computed (derived, re-evaluated on each set) ──────────────────────────
  canUndo:    boolean
  canRedo:    boolean
  undoLabel:  string | null
  redoLabel:  string | null

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Push a new command onto the undo stack.
   * Clears the redo stack.
   * Evicts oldest entry when MAX_HISTORY is reached.
   */
  push(cmd: Omit<HistoryCommand, 'id' | 'timestamp'>): void

  /**
   * Execute the most-recent command's `undo` function.
   * Moves it from `past` to `future`.
   * If `undo()` throws the stack is left unchanged (anti-corruption).
   */
  undo(): void

  /**
   * Execute the most-recent future command's `redo` function.
   * Moves it from `future` to `past`.
   * If `redo()` throws the stack is left unchanged (anti-corruption).
   */
  redo(): void

  /** Clear entire history (both past and future). */
  clear(): void

  /** Returns a read-only snapshot of the past entries (no undo/redo fns). */
  getEntries(): HistoryEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0
function nextId(): string {
  return `h-${Date.now()}-${++_idCounter}`
}

function derive(past: HistoryCommand[], future: HistoryCommand[]) {
  return {
    canUndo:   past.length > 0,
    canRedo:   future.length > 0,
    undoLabel: past.length   > 0 ? past[past.length - 1].label   : null,
    redoLabel: future.length > 0 ? future[0].label               : null,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past:      [],
  future:    [],
  corrupted: false,
  ...derive([], []),

  push(cmd) {
    const command: HistoryCommand = {
      ...cmd,
      id:        nextId(),
      timestamp: Date.now(),
    }
    set((s) => {
      const past = [...s.past, command]
      // Evict oldest if over limit
      if (past.length > MAX_HISTORY) past.shift()
      const future: HistoryCommand[] = []
      return { past, future, corrupted: false, ...derive(past, future) }
    })
  },

  undo() {
    const { past, future } = get()
    if (past.length === 0) return
    const cmd = past[past.length - 1]
    try {
      cmd.undo()
    } catch (err) {
      console.error('[HistoryStore] undo threw — stack preserved', err)
      set({ corrupted: true })
      return
    }
    set((s) => {
      const newPast   = s.past.slice(0, -1)
      const newFuture = [cmd, ...s.future]
      return { past: newPast, future: newFuture, corrupted: false, ...derive(newPast, newFuture) }
    })
  },

  redo() {
    const { future } = get()
    if (future.length === 0) return
    const cmd = future[0]
    try {
      cmd.redo()
    } catch (err) {
      console.error('[HistoryStore] redo threw — stack preserved', err)
      set({ corrupted: true })
      return
    }
    set((s) => {
      const newFuture = s.future.slice(1)
      const newPast   = [...s.past, cmd]
      return { past: newPast, future: newFuture, corrupted: false, ...derive(newPast, newFuture) }
    })
  },

  clear() {
    set({ past: [], future: [], corrupted: false, ...derive([], []) })
  },

  getEntries() {
    return get().past.map(({ id, label, domain, timestamp }) => ({
      id, label, domain, timestamp,
    }))
  },
}))

// ─── Jump to arbitrary history position ───────────────────────────────────────

/**
 * Undo/redo until the command at `targetIndex` (in past[]) is the last entry.
 * If targetIndex === -1, undo everything.
 * Safe: wraps each step in the existing anti-corruption undo/redo logic.
 */
export function jumpToHistory(targetIndex: number): void {
  const store = useHistoryStore.getState()
  const currentIndex = store.past.length - 1

  if (targetIndex === currentIndex) return

  if (targetIndex < currentIndex) {
    // Undo until we reach targetIndex
    const steps = currentIndex - targetIndex
    for (let i = 0; i < steps; i++) {
      useHistoryStore.getState().undo()
      if (useHistoryStore.getState().corrupted) break
    }
  } else {
    // Redo until we reach targetIndex
    const steps = targetIndex - currentIndex
    for (let i = 0; i < steps; i++) {
      useHistoryStore.getState().redo()
      if (useHistoryStore.getState().corrupted) break
    }
  }
}

// ─── Batching helper ──────────────────────────────────────────────────────────

/**
 * Execute `fn` while collecting all push() calls into a single compound command.
 * Useful for multi-step operations that should be undone as one unit.
 */
let _batchActive  = false
let _batchItems:  HistoryCommand[] = []
let _batchDomain: HistoryDomain = 'arrangement'

export function withUndoGroup(label: string, domain: HistoryDomain, fn: () => void): void {
  if (_batchActive) {
    // Nested group — just run inline, outer group collects everything
    fn()
    return
  }
  _batchActive  = true
  _batchItems   = []
  _batchDomain  = domain
  fn()
  _batchActive  = false
  if (_batchItems.length === 0) return

  const items = [..._batchItems]
  _batchItems  = []

  useHistoryStore.getState().push({
    label,
    domain,
    undo: () => { for (let i = items.length - 1; i >= 0; i--) items[i].undo() },
    redo: () => { for (const item of items) item.redo() },
  })
}

/**
 * Internal: intercepts push() calls during a batch.
 * Called from undoableActions instead of historyStore.push() directly.
 */
export function _pushOrBatch(cmd: Omit<HistoryCommand, 'id' | 'timestamp'>): void {
  if (_batchActive) {
    const command: HistoryCommand = {
      ...cmd,
      id:        nextId(),
      timestamp: Date.now(),
    }
    _batchItems.push(command)
  } else {
    useHistoryStore.getState().push(cmd)
  }
}
