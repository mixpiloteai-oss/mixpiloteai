// ============================================================
// NEUROTEK AI — useHistory hook
// Wraps historyStore and exposes canUndo / canRedo booleans.
// ============================================================
import { useHistoryStore } from '../store/historyStore';
import type { HistoryEntry } from '../store/historyStore';

export type { HistoryEntry };

export function useHistory() {
  const { past, future, checkpoint, undo, redo, clear } = useHistoryStore();
  return {
    past,
    future,
    canUndo:   past.length > 0,
    canRedo:   future.length > 0,
    lastLabel: past.length > 0 ? past[past.length - 1].label : null,
    nextLabel: future.length > 0 ? future[0].label : null,
    checkpoint,
    undo,
    redo,
    clear,
  };
}
