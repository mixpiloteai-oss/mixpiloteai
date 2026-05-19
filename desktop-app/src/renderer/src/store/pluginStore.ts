import { create } from 'zustand'
import { persist }  from 'zustand/middleware'
import type { PluginFormat, PluginCategory } from '../types/audio'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PluginArch = '64bit' | '32bit' | 'unknown'

export interface PluginInfo {
  id:           string
  name:         string
  vendor:       string
  path:         string
  format:       PluginFormat
  category:     PluginCategory
  architecture: PluginArch
  isBlacklisted: boolean
  crashCount:   number
  isFavorite:   boolean
  hasEditor:    boolean
  paramCount:   number
  version:      string
  scannedAt:    number
}

export interface PluginInstance {
  instanceId: string
  pluginId:   string
  name:       string
  vendor:     string
  paramCount: number
  pid:        number
  loadedAt:   number
}

export interface PluginPreset {
  id:       string
  pluginId: string
  name:     string
  savedAt:  number
  isFactory: boolean
}

export interface BlacklistEntry {
  path:         string
  name:         string
  crashCount:   number
  blacklistedAt: number | null
}

interface PluginStore {
  // Registry
  plugins:      PluginInfo[]
  scanning:     boolean
  lastScanAt:   number
  // Loaded instances
  instances:    PluginInstance[]
  // Presets (keyed by pluginId)
  presets:      Record<string, PluginPreset[]>
  // Blacklist
  blacklist:    BlacklistEntry[]
  // Favorites (persisted)
  favorites:    Set<string>
  // Crash notification
  lastCrash:    { instanceId: string; pluginName: string; crashCount: number; blacklisted: boolean } | null

  // Actions
  setPlugins:   (p: PluginInfo[]) => void
  setScanning:  (v: boolean) => void
  addInstance:  (i: PluginInstance) => void
  removeInstance: (instanceId: string) => void
  setPresets:   (pluginId: string, presets: PluginPreset[]) => void
  setBlacklist: (b: BlacklistEntry[]) => void
  toggleFavorite: (pluginId: string) => void
  setLastCrash: (c: PluginStore['lastCrash']) => void
  clearLastCrash: () => void
}

export const usePluginStore = create<PluginStore>()(
  persist(
    (set) => ({
      plugins:    [],
      scanning:   false,
      lastScanAt: 0,
      instances:  [],
      presets:    {},
      blacklist:  [],
      favorites:  new Set(),
      lastCrash:  null,

      setPlugins:  (plugins) => set(s => ({
        plugins: plugins.map(p => ({ ...p, isFavorite: s.favorites.has(p.id) })),
        lastScanAt: Date.now(),
      })),
      setScanning: (scanning) => set({ scanning }),
      addInstance: (i)    => set(s => ({ instances: [...s.instances, i] })),
      removeInstance: (id) => set(s => ({ instances: s.instances.filter(i => i.instanceId !== id) })),
      setPresets:  (pluginId, presets) => set(s => ({ presets: { ...s.presets, [pluginId]: presets } })),
      setBlacklist: (blacklist) => set({ blacklist }),
      toggleFavorite: (pluginId) => set(s => {
        const fav = new Set(s.favorites)
        if (fav.has(pluginId)) fav.delete(pluginId)
        else                   fav.add(pluginId)
        return {
          favorites: fav,
          plugins: s.plugins.map(p => p.id === pluginId ? { ...p, isFavorite: fav.has(p.id) } : p),
        }
      }),
      setLastCrash:  (c) => set({ lastCrash: c }),
      clearLastCrash: () => set({ lastCrash: null }),
    }),
    {
      name: 'neurotek-plugin-store',
      partialize: (s) => ({ favorites: [...s.favorites] as unknown }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray((state as { favorites: unknown }).favorites)) {
          state.favorites = new Set((state as unknown as { favorites: string[] }).favorites)
        }
      },
    },
  ),
)
