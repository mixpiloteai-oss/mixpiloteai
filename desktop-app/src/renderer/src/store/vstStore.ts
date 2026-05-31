import { create } from 'zustand'
import { vstClient } from '../audio/vst/VstPluginClient'
import type { ScannedPlugin, LoadedInstance, PluginCategory } from '../audio/vst/vstTypes'

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
}

export const useVstStore = create<VstState & VstActions>((set, get) => ({
  plugins: [],
  loadedInstances: {},
  scanning: false,
  scanProgress: 0,
  selectedInstanceId: null,
  searchQuery: '',
  categoryFilter: 'all',

  scanPlugins: async () => {
    set({ scanning: true, scanProgress: 0 })
    try {
      await vstClient.scanPlugins()
      await get().listPlugins()
    } finally {
      set({ scanning: false, scanProgress: 100 })
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
}))
