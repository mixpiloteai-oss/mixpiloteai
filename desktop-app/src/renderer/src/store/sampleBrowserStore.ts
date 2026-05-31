import { create } from 'zustand'
import type { SampleCollection, SmartFolder, RecentEntry } from '../audio/browser/types'

export interface SampleRecord {
  id:         string
  path:       string
  name:       string
  ext:        string
  type:       string
  sizeBytes:  number
  modifiedAt: number
  dirPath:    string
  tags:       string[]
  favorite:   boolean
  userLabel:  string
  bpm:        number | null
  key:        string | null
  indexedAt:  number
}

interface ScanProgress {
  found:      number
  currentDir: string
}

interface ScanCompleteInfo {
  dir:        string
  totalFiles: number
  durationMs: number
}

interface SampleBrowserState {
  // Root directories managed by the main-process DB
  rootDirs:        string[]

  // Current search results (IPC-backed)
  results:         SampleRecord[]
  query:           string
  typeFilter:      string | null
  favoritesOnly:   boolean
  tagFilters:      string[]

  // All available tags
  allTags:         string[]

  // Selection & preview
  selectedId:      string | null
  previewingId:    string | null

  // Scan state
  scanning:        boolean
  scanProgress:    ScanProgress | null
  lastScanInfo:    ScanCompleteInfo | null

  // Stats
  stats:           { totalRecords: number; favorites: number; rootDirs: number; indexedAt: number } | null

  // Collections
  collections:         SampleCollection[]
  activeCollectionId:  string | null

  // Smart folders
  smartFolders:        SmartFolder[]

  // Recent history (renderer-only, last 50 accessed)
  recentSamples:       RecentEntry[]

  // Actions
  setQuery(q: string): void
  setTypeFilter(t: string | null): void
  setFavoritesOnly(v: boolean): void
  setTagFilters(tags: string[]): void
  setSelected(id: string | null): void
  setPreviewing(id: string | null): void
  setRootDirs(dirs: string[]): void
  setResults(r: SampleRecord[]): void
  setAllTags(tags: string[]): void
  setScanning(v: boolean): void
  setScanProgress(p: ScanProgress | null): void
  setLastScanInfo(info: ScanCompleteInfo | null): void
  setStats(s: SampleBrowserState['stats']): void
  toggleFavorite(id: string): void
  addTag(id: string, tag: string): void
  removeTag(id: string, tag: string): void
  searchSamples(): Promise<void>

  // Collections
  loadCollections(): Promise<void>
  createCollection(name: string): Promise<SampleCollection | null>
  deleteCollection(id: string): Promise<void>
  addToCollection(collId: string, sampleId: string): Promise<void>
  removeFromCollection(collId: string, sampleId: string): Promise<void>
  setActiveCollection(id: string | null): void

  // Smart folders
  loadSmartFolders(): Promise<void>
  createSmartFolder(name: string, query: string, opts: Omit<SmartFolder, 'id'|'name'|'query'|'createdAt'>): Promise<SmartFolder | null>
  deleteSmartFolder(id: string): Promise<void>

  // Recent history
  recordRecent(entry: Omit<RecentEntry, 'accessedAt'>): void
  clearRecent(): void
}

export const useSampleBrowserStore = create<SampleBrowserState>((set, get) => ({
  rootDirs:            [],
  results:             [],
  query:               '',
  typeFilter:          null,
  favoritesOnly:       false,
  tagFilters:          [],
  allTags:             [],
  selectedId:          null,
  previewingId:        null,
  scanning:            false,
  scanProgress:        null,
  lastScanInfo:        null,
  stats:               null,
  collections:         [],
  activeCollectionId:  null,
  smartFolders:        [],
  recentSamples:       [],

  setQuery: (q) => set({ query: q }),
  setTypeFilter: (t) => set({ typeFilter: t }),
  setFavoritesOnly: (v) => set({ favoritesOnly: v }),
  setTagFilters: (tags) => set({ tagFilters: tags }),
  setSelected: (id) => set({ selectedId: id }),
  setPreviewing: (id) => set({ previewingId: id }),
  setRootDirs: (dirs) => set({ rootDirs: dirs }),
  setResults: (r) => set({ results: r }),
  setAllTags: (tags) => set({ allTags: tags }),
  setScanning: (v) => set({ scanning: v }),
  setScanProgress: (p) => set({ scanProgress: p }),
  setLastScanInfo: (info) => set({ lastScanInfo: info }),
  setStats: (s) => set({ stats: s }),

  toggleFavorite: (id) => {
    set((state) => ({
      results: state.results.map((r) =>
        r.id === id ? { ...r, favorite: !r.favorite } : r
      ),
    }))
    const rec = get().results.find((r) => r.id === id)
    if (rec) {
      window.electronAPI?.samplesSetFavorite(id, !rec.favorite).catch(() => {})
    }
  },

  addTag: (id, tag) => {
    set((state) => ({
      results: state.results.map((r) =>
        r.id === id && !r.tags.includes(tag) ? { ...r, tags: [...r.tags, tag] } : r
      ),
    }))
    window.electronAPI?.samplesAddTag(id, tag).catch(() => {})
  },

  removeTag: (id, tag) => {
    set((state) => ({
      results: state.results.map((r) =>
        r.id === id ? { ...r, tags: r.tags.filter((t) => t !== tag) } : r
      ),
    }))
    window.electronAPI?.samplesRemoveTag(id, tag).catch(() => {})
  },

  searchSamples: async () => {
    const state = get()
    const api = window.electronAPI
    if (!api) return
    const opts: { type?: string; favorite?: boolean; tags?: string[] } = {}
    if (state.typeFilter) opts.type = state.typeFilter
    if (state.favoritesOnly) opts.favorite = true
    if (state.tagFilters.length) opts.tags = state.tagFilters
    const results = await api.samplesSearch(state.query, opts)
    set({ results: results as SampleRecord[] })
  },

  // Collections
  loadCollections: async () => {
    const cols = await window.electronAPI?.samplesListCollections() as SampleCollection[] | undefined
    if (cols) set({ collections: cols })
  },
  createCollection: async (name) => {
    const col = await window.electronAPI?.samplesCreateCollection(name) as SampleCollection | undefined
    if (col) set(s => ({ collections: [...s.collections, col] }))
    return col ?? null
  },
  deleteCollection: async (id) => {
    await window.electronAPI?.samplesDeleteCollection(id)
    set(s => ({ collections: s.collections.filter(c => c.id !== id), activeCollectionId: s.activeCollectionId === id ? null : s.activeCollectionId }))
  },
  addToCollection: async (collId, sampleId) => {
    await window.electronAPI?.samplesAddToCollection(collId, sampleId)
    set(s => ({
      collections: s.collections.map(c =>
        c.id === collId && !c.sampleIds.includes(sampleId)
          ? { ...c, sampleIds: [...c.sampleIds, sampleId], updatedAt: Date.now() }
          : c
      ),
    }))
  },
  removeFromCollection: async (collId, sampleId) => {
    await window.electronAPI?.samplesRemoveFromCollection(collId, sampleId)
    set(s => ({
      collections: s.collections.map(c =>
        c.id === collId
          ? { ...c, sampleIds: c.sampleIds.filter(id => id !== sampleId), updatedAt: Date.now() }
          : c
      ),
    }))
  },
  setActiveCollection: (id) => {
    set({ activeCollectionId: id })
  },

  // Smart folders
  loadSmartFolders: async () => {
    const sfs = await window.electronAPI?.samplesListSmartFolders() as SmartFolder[] | undefined
    if (sfs) set({ smartFolders: sfs })
  },
  createSmartFolder: async (name, query, opts) => {
    const sf = await window.electronAPI?.samplesCreateSmartFolder(name, query, opts) as SmartFolder | undefined
    if (sf) set(s => ({ smartFolders: [...s.smartFolders, sf] }))
    return sf ?? null
  },
  deleteSmartFolder: async (id) => {
    await window.electronAPI?.samplesDeleteSmartFolder(id)
    set(s => ({ smartFolders: s.smartFolders.filter(f => f.id !== id) }))
  },

  // Recent history
  recordRecent: (entry) => {
    const rec: RecentEntry = { ...entry, accessedAt: Date.now() }
    set(s => {
      const filtered = s.recentSamples.filter(r => r.sampleId !== entry.sampleId)
      return { recentSamples: [rec, ...filtered].slice(0, 50) }
    })
  },
  clearRecent: () => {
    set({ recentSamples: [] })
  },
}))

// ── IPC-backed search action (call this from components) ──────────────────────
export async function searchSamples(
  query: string,
  opts?: { type?: string; favorite?: boolean; tags?: string[] },
): Promise<SampleRecord[]> {
  const api = window.electronAPI
  if (!api) return []
  const results = await api.samplesSearch(query, opts)
  return results as SampleRecord[]
}

// ── Bootstrap: load root dirs, stats, tags on app start ──────────────────────
export async function initSampleBrowser(): Promise<void> {
  const api = window.electronAPI
  if (!api) return
  const store = useSampleBrowserStore.getState()

  const [rootDirs, stats, allTags] = await Promise.all([
    api.samplesGetRootDirs(),
    api.samplesGetStats(),
    api.samplesGetAllTags(),
  ])

  store.setRootDirs(rootDirs as string[])
  store.setStats(stats as SampleBrowserState['stats'])
  store.setAllTags(allTags as string[])

  await Promise.all([
    store.loadCollections(),
    store.loadSmartFolders(),
  ])

  // Register scan events
  api.onSamplesScanProgress((info) => {
    const i = info as ScanProgress
    useSampleBrowserStore.getState().setScanProgress(i)
  })
  api.onSamplesScanComplete((info) => {
    const i = info as ScanCompleteInfo
    useSampleBrowserStore.getState().setLastScanInfo(i)
    useSampleBrowserStore.getState().setScanning(false)
    useSampleBrowserStore.getState().setScanProgress(null)
    // Refresh stats
    api.samplesGetStats().then((s) =>
      useSampleBrowserStore.getState().setStats(s as SampleBrowserState['stats'])
    ).catch(() => {})
  })
}

// ── Add root directory (opens OS folder picker, scans in background) ──────────
export async function addRootDir(): Promise<string | null> {
  const api = window.electronAPI
  if (!api) return null
  useSampleBrowserStore.getState().setScanning(true)
  const dir = await api.samplesAddRootDir()
  const newDirs = await api.samplesGetRootDirs()
  useSampleBrowserStore.getState().setRootDirs(newDirs as string[])
  return dir as string | null
}
