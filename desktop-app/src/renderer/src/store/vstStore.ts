import { create } from 'zustand'
import { vstClient } from '../audio/vst/VstPluginClient'
import type {
  ScannedPlugin,
  LoadedInstance,
  PluginCategory,
  PluginCollection,
  PluginWindowInfo,
  ScanProgress,
  SearchFilters,
} from '../audio/vst/vstTypes'

// ── VST Store ──────────────────────────────────────────────────────────────────
// Zustand store for the VST plugin system.

interface VstState {
  plugins: ScannedPlugin[]
  loadedInstances: Record<string, LoadedInstance>
  scanning: boolean
  scanProgress: number
  selectedInstanceId: string | null
  searchQuery: string
  categoryFilter: PluginCategory | 'all'

  // Enhanced state
  favorites: string[]
  tags: Record<string, string[]>
  collections: PluginCollection[]
  openWindows: PluginWindowInfo[]
  activeScanProgress: ScanProgress | null
}

interface VstActions {
  scanPlugins: () => Promise<void>
  listPlugins: () => Promise<void>
  loadInstance: (pluginId: string, pluginName: string) => Promise<string>
  unloadInstance: (instanceId: string) => Promise<void>
  setBypass: (instanceId: string, bypassed: boolean) => Promise<void>
  setSelectedInstance: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setCategoryFilter: (f: PluginCategory | 'all') => void

  // Enhanced actions
  addFavorite: (pluginId: string) => Promise<void>
  removeFavorite: (pluginId: string) => Promise<void>
  addTag: (pluginId: string, tag: string) => Promise<void>
  removeTag: (pluginId: string, tag: string) => Promise<void>
  createCollection: (name: string) => Promise<PluginCollection>
  addToCollection: (collId: string, pluginId: string) => Promise<void>
  loadCollections: () => Promise<void>
  openWindow: (instanceId: string, pluginName: string) => Promise<void>
  closeWindow: (instanceId: string) => Promise<void>
  pinWindow: (instanceId: string, pinned: boolean) => Promise<void>
  setScanProgress: (progress: ScanProgress | null) => void
  searchAdvanced: (query: string, filters: SearchFilters) => Promise<ScannedPlugin[]>
  initVst: () => void
}

export const useVstStore = create<VstState & VstActions>((set, get) => ({
  plugins: [],
  loadedInstances: {},
  scanning: false,
  scanProgress: 0,
  selectedInstanceId: null,
  searchQuery: '',
  categoryFilter: 'all',

  // Enhanced initial state
  favorites: [],
  tags: {},
  collections: [],
  openWindows: [],
  activeScanProgress: null,

  // ── Core actions ────────────────────────────────────────────────────────

  scanPlugins: async () => {
    set({ scanning: true, scanProgress: 0 })
    try {
      await vstClient.scanPlugins()
      await get().listPlugins()
    } finally {
      set({ scanning: false, scanProgress: 100, activeScanProgress: null })
    }
  },

  listPlugins: async () => {
    const plugins = await vstClient.listPlugins()
    set({ plugins })
  },

  loadInstance: async (pluginId: string, pluginName: string) => {
    const instanceId = await vstClient.loadInstance(pluginId)
    const instance: LoadedInstance = {
      instanceId,
      pluginId,
      pluginName,
      bypassed: false,
    }
    set(state => ({
      loadedInstances: { ...state.loadedInstances, [instanceId]: instance },
    }))
    return instanceId
  },

  unloadInstance: async (instanceId: string) => {
    await vstClient.unloadInstance(instanceId)
    set(state => {
      const next = { ...state.loadedInstances }
      delete next[instanceId]
      return {
        loadedInstances: next,
        selectedInstanceId: state.selectedInstanceId === instanceId ? null : state.selectedInstanceId,
        openWindows: state.openWindows.filter(w => w.instanceId !== instanceId),
      }
    })
  },

  setBypass: async (instanceId: string, bypassed: boolean) => {
    await vstClient.setBypass(instanceId, bypassed)
    set(state => {
      const instance = state.loadedInstances[instanceId]
      if (!instance) return state
      return {
        loadedInstances: {
          ...state.loadedInstances,
          [instanceId]: { ...instance, bypassed },
        },
      }
    })
  },

  setSelectedInstance: (id: string | null) => set({ selectedInstanceId: id }),

  setSearchQuery: (q: string) => set({ searchQuery: q }),

  setCategoryFilter: (f: PluginCategory | 'all') => set({ categoryFilter: f }),

  // ── Enhanced actions ────────────────────────────────────────────────────

  addFavorite: async (pluginId: string) => {
    await vstClient.addFavorite(pluginId)
    set(state => ({
      favorites: state.favorites.includes(pluginId)
        ? state.favorites
        : [...state.favorites, pluginId],
    }))
  },

  removeFavorite: async (pluginId: string) => {
    await vstClient.removeFavorite(pluginId)
    set(state => ({
      favorites: state.favorites.filter(id => id !== pluginId),
    }))
  },

  addTag: async (pluginId: string, tag: string) => {
    await vstClient.addTag(pluginId, tag)
    set(state => {
      const existing = state.tags[pluginId] ?? []
      if (existing.includes(tag)) return state
      return {
        tags: { ...state.tags, [pluginId]: [...existing, tag] },
      }
    })
  },

  removeTag: async (pluginId: string, tag: string) => {
    await vstClient.removeTag(pluginId, tag)
    set(state => {
      const existing = state.tags[pluginId] ?? []
      return {
        tags: { ...state.tags, [pluginId]: existing.filter(t => t !== tag) },
      }
    })
  },

  createCollection: async (name: string) => {
    const coll = await vstClient.createCollection(name)
    set(state => ({
      collections: [...state.collections, coll],
    }))
    return coll
  },

  addToCollection: async (collId: string, pluginId: string) => {
    await vstClient.addToCollection(collId, pluginId)
    set(state => ({
      collections: state.collections.map(c =>
        c.id === collId
          ? { ...c, pluginIds: c.pluginIds.includes(pluginId) ? c.pluginIds : [...c.pluginIds, pluginId] }
          : c
      ),
    }))
  },

  loadCollections: async () => {
    const collections = await vstClient.getCollections()
    set({ collections })
  },

  openWindow: async (instanceId: string, pluginName: string) => {
    const info = await vstClient.openWindow(instanceId, pluginName)
    set(state => ({
      openWindows: [
        ...state.openWindows.filter(w => w.instanceId !== instanceId),
        info,
      ],
    }))
  },

  closeWindow: async (instanceId: string) => {
    await vstClient.closeWindow(instanceId)
    set(state => ({
      openWindows: state.openWindows.filter(w => w.instanceId !== instanceId),
    }))
  },

  pinWindow: async (instanceId: string, pinned: boolean) => {
    await vstClient.pinWindow(instanceId, pinned)
    set(state => ({
      openWindows: state.openWindows.map(w =>
        w.instanceId === instanceId ? { ...w, pinned } : w
      ),
    }))
  },

  setScanProgress: (progress: ScanProgress | null) => {
    set({ activeScanProgress: progress })
    if (progress) {
      set({ scanProgress: Math.round((progress.scanned / Math.max(progress.total, 1)) * 100) })
    }
  },

  searchAdvanced: async (query: string, filters: SearchFilters) => {
    return await vstClient.searchAdvanced(query, filters)
  },

  // ── Init ────────────────────────────────────────────────────────────────

  initVst: () => {
    // Subscribe to scan progress events from main process
    const unsubscribe = vstClient.onScanProgress((p: ScanProgress) => {
      get().setScanProgress(p)
    })

    // Return unsubscribe so caller can clean up if needed
    // (stored via closure; called on next initVst or app teardown)
    return unsubscribe
  },
}))
