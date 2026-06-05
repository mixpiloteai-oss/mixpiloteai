/**
 * safetyStore — Zustand store for the Project Safety System.
 *
 * Coordinates autosave, crash recovery, and backup management state.
 */

import { create } from 'zustand'
import { recoveryManager } from '../audio/safety/RecoveryManager'
import { autoSaveEngine } from '../audio/safety/AutoSaveEngine'
import { useProjectStore } from './projectStore'
import type { BackupEntry } from '../audio/safety/RecoveryManager'

// ── State & Actions ──────────────────────────────────────────────────────────

interface SafetyState {
  // Save status
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastSaveTime: number | null
  saveCount: number
  // Autosave config
  autosaveEnabled: boolean
  autosaveIntervalMs: number
  // Recovery
  hasCrashRecovery: boolean
  recoverySnapshots: BackupEntry[]
  showRecoveryDialog: boolean
  // Backups
  backups: BackupEntry[]
  isLoadingBackups: boolean
}

interface SafetyActions {
  initializeSafety: () => Promise<void>
  setSaveStatus: (s: 'idle' | 'saving' | 'saved' | 'error') => void
  setAutosaveEnabled: (v: boolean) => void
  setAutosaveInterval: (ms: number) => void
  dismissRecoveryDialog: () => void
  restoreSnapshot: (id: string) => Promise<void>
  discardRecovery: () => Promise<void>
  loadBackups: () => Promise<void>
  deleteBackup: (id: string) => Promise<void>
  forceSave: () => Promise<void>
}

type SafetyStore = SafetyState & SafetyActions

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSafetyStore = create<SafetyStore>((set, get) => ({
  // Initial state
  saveStatus: 'idle',
  lastSaveTime: null,
  saveCount: 0,
  autosaveEnabled: true,
  autosaveIntervalMs: 30_000,
  hasCrashRecovery: false,
  recoverySnapshots: [],
  showRecoveryDialog: false,
  backups: [],
  isLoadingBackups: false,

  // ── Actions ──────────────────────────────────────────────────────────────────

  initializeSafety: async () => {
    // Check for crash recovery
    const result = await recoveryManager.checkForRecovery()
    if (result.hasCrashRecovery) {
      set({
        hasCrashRecovery: true,
        showRecoveryDialog: true,
        recoverySnapshots: result.snapshots,
      })
    }

    // Start autosave engine
    autoSaveEngine.setEnabled(get().autosaveEnabled)
    autoSaveEngine.start(() => {
      const s = useProjectStore.getState()
      return { bpm: s.project.bpm, tracks: s.project.tracks }
    })

    // Subscribe to save events
    autoSaveEngine.onSaved((saveResult) => {
      set({
        saveStatus: 'saved',
        lastSaveTime: saveResult.timestamp,
        saveCount: get().saveCount + 1,
      })
    })

    autoSaveEngine.onError(() => {
      set({ saveStatus: 'error' })
    })
  },

  setSaveStatus: (s) => set({ saveStatus: s }),

  setAutosaveEnabled: (v) => {
    set({ autosaveEnabled: v })
    autoSaveEngine.setEnabled(v)
  },

  setAutosaveInterval: (ms) => {
    set({ autosaveIntervalMs: ms })
    autoSaveEngine.setInterval(ms)
  },

  dismissRecoveryDialog: () => set({ showRecoveryDialog: false }),

  restoreSnapshot: async (id) => {
    const result = await recoveryManager.restoreSnapshot(id)
    if (result.success) {
      set({ showRecoveryDialog: false, hasCrashRecovery: false })
    }
  },

  discardRecovery: async () => {
    await recoveryManager.discardRecovery()
    set({ showRecoveryDialog: false, hasCrashRecovery: false, recoverySnapshots: [] })
  },

  loadBackups: async () => {
    set({ isLoadingBackups: true })
    try {
      const backups = await recoveryManager.listBackups()
      set({ backups })
    } finally {
      set({ isLoadingBackups: false })
    }
  },

  deleteBackup: async (id) => {
    await recoveryManager.deleteBackup(id)
    // Refresh list
    await get().loadBackups()
  },

  forceSave: async () => {
    set({ saveStatus: 'saving' })
    try {
      const result = await autoSaveEngine.forceSave(() => {
        const s = useProjectStore.getState()
        return { bpm: s.project.bpm, tracks: s.project.tracks }
      })
      if (result.success) {
        set({
          saveStatus: 'saved',
          lastSaveTime: result.timestamp,
          saveCount: get().saveCount + 1,
        })
      } else {
        set({ saveStatus: 'error' })
      }
    } catch {
      set({ saveStatus: 'error' })
    }
  },
}))
