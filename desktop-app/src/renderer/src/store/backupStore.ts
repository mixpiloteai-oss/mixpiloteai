/**
 * backupStore — Zustand store for named project backup management.
 */

import { create } from 'zustand'
import type { ProjectSnapshot } from '../audio/save/types'
import { getBackupEngine } from '../audio/save/BackupEngine'

interface BackupStore {
  backups:   ProjectSnapshot[]
  isLoading: boolean
  lastError: string | null

  loadBackups():                   Promise<void>
  createNamedBackup(label: string): Promise<void>
  restoreBackup(id: string):        Promise<void>
  deleteBackup(id: string):         Promise<void>
}

export const useBackupStore = create<BackupStore>((set) => ({
  backups:   [],
  isLoading: false,
  lastError: null,

  async loadBackups() {
    set({ isLoading: true, lastError: null })
    try {
      const engine  = getBackupEngine()
      await engine.init()
      const backups = await engine.listBackups()
      set({ backups, isLoading: false })
    } catch (err) {
      set({ isLoading: false, lastError: err instanceof Error ? err.message : String(err) })
    }
  },

  async createNamedBackup(label) {
    set({ isLoading: true, lastError: null })
    try {
      const engine = getBackupEngine()
      await engine.init()
      await engine.createBackup(label)
      await engine.pruneOld()
      const backups = await engine.listBackups()
      set({ backups, isLoading: false })
    } catch (err) {
      set({ isLoading: false, lastError: err instanceof Error ? err.message : String(err) })
    }
  },

  async restoreBackup(id) {
    set({ lastError: null })
    const engine = getBackupEngine()
    const result = await engine.restoreBackup(id)
    if (!result.ok) {
      set({ lastError: result.reason })
    }
  },

  async deleteBackup(id) {
    set({ isLoading: true, lastError: null })
    try {
      const engine  = getBackupEngine()
      await engine.deleteBackup(id)
      const backups = await engine.listBackups()
      set({ backups, isLoading: false })
    } catch (err) {
      set({ isLoading: false, lastError: err instanceof Error ? err.message : String(err) })
    }
  },
}))
