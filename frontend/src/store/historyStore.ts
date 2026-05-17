// ============================================================
// NEUROTEK AI — DAW Undo/Redo History Store
// Explicit-checkpoint model: call checkpoint() before any
// destructive operation (note edit, clip move, mixer change).
// appStore → historyStore is one-way; no circular dep.
// ============================================================
import { create } from 'zustand';
import type { Project, MixAnalysis } from '../types';

const MAX_HISTORY = 100;

export interface UndoableSnapshot {
  projects: Project[];
  activeProject: Project | null;
  mixAnalysis: MixAnalysis | null;
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: string;
  state: UndoableSnapshot;
}

interface HistoryStore {
  past: HistoryEntry[];
  future: HistoryEntry[];
  // Actions
  checkpoint: (label: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

// Set once by appStore via initHistoryBridge() to avoid module-level
// import cycle (historyStore ← appStore ← historyStore would be cyclic).
let _getSnapshot: (() => UndoableSnapshot) | null = null;
let _applySnapshot: ((s: UndoableSnapshot) => void) | null = null;

export function initHistoryBridge(
  get: () => UndoableSnapshot,
  apply: (s: UndoableSnapshot) => void,
): void {
  _getSnapshot = get;
  _applySnapshot = apply;
}

function captureSnapshot(): UndoableSnapshot {
  if (_getSnapshot) return _getSnapshot();
  return { projects: [], activeProject: null, mixAnalysis: null };
}

function applySnapshot(snap: UndoableSnapshot): void {
  _applySnapshot?.(snap);
}

export const useHistoryStore = create<HistoryStore>()((set, get) => ({
  past: [],
  future: [],

  checkpoint: (label: string) => {
    const snap = captureSnapshot();
    const entry: HistoryEntry = {
      id:        `hist-${Date.now()}`,
      label,
      timestamp: new Date().toISOString(),
      state:     snap,
    };
    set((s) => ({
      past:   [...s.past.slice(-(MAX_HISTORY - 1)), entry],
      future: [],
    }));
  },

  undo: () => {
    const { past, future } = get();
    if (!past.length) return;

    const currentEntry: HistoryEntry = {
      id:        `hist-future-${Date.now()}`,
      label:     'current',
      timestamp: new Date().toISOString(),
      state:     captureSnapshot(),
    };
    const prev = past[past.length - 1];
    applySnapshot(prev.state);
    set({
      past:   past.slice(0, -1),
      future: [currentEntry, ...future],
    });
  },

  redo: () => {
    const { past, future } = get();
    if (!future.length) return;

    const currentEntry: HistoryEntry = {
      id:        `hist-past-${Date.now()}`,
      label:     'current',
      timestamp: new Date().toISOString(),
      state:     captureSnapshot(),
    };
    const next = future[0];
    applySnapshot(next.state);
    set({
      past:   [...past, currentEntry],
      future: future.slice(1),
    });
  },

  clear: () => set({ past: [], future: [] }),
}));
