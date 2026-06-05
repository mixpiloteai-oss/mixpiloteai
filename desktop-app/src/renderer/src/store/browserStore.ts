import { create } from 'zustand'
import type { SampleEntry, SampleFilter, SampleSort, SortDir, FolderNode, ScanProgress } from '../audio/browser/types'
import { DEFAULT_FILTER } from '../audio/browser/types'

interface BrowserStore {
  // All loaded samples
  samples:         SampleEntry[]

  // Folder tree
  folderTree:      FolderNode | null
  selectedFolder:  string | null

  // Scan state
  scanning:        boolean
  scanProgress:    ScanProgress | null

  // Filter & sort
  filter:          SampleFilter
  sort:            SampleSort
  sortDir:         SortDir

  // Selection & preview
  selectedId:      string | null
  previewingId:    string | null
  previewVolume:   number
  autoPreview:     boolean

  // Analysis queue
  analyzingCount:  number

  // UI state
  waveformVisible: boolean
  sidebarWidth:    number

  // Actions
  setSamples(samples: SampleEntry[]): void
  addSamples(samples: SampleEntry[]): void
  updateSample(id: string, patch: Partial<SampleEntry>): void

  setFolderTree(tree: FolderNode | null): void
  setSelectedFolder(path: string | null): void

  setScanning(v: boolean): void
  setScanProgress(p: ScanProgress | null): void

  setFilter(patch: Partial<SampleFilter>): void
  resetFilter(): void
  setSort(sort: SampleSort, dir?: SortDir): void
  toggleSortDir(): void

  setSelected(id: string | null): void
  setPreviewing(id: string | null): void
  setPreviewVolume(v: number): void
  setAutoPreview(v: boolean): void

  setAnalyzingCount(n: number): void
  toggleFavorite(id: string): void
  addUserTag(id: string, tag: string): void
  removeUserTag(id: string, tag: string): void

  setWaveformVisible(v: boolean): void
  setSidebarWidth(w: number): void
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  samples:         [],
  folderTree:      null,
  selectedFolder:  null,
  scanning:        false,
  scanProgress:    null,
  filter:          { ...DEFAULT_FILTER },
  sort:            'name',
  sortDir:         'asc',
  selectedId:      null,
  previewingId:    null,
  previewVolume:   0.8,
  autoPreview:     true,
  analyzingCount:  0,
  waveformVisible: true,
  sidebarWidth:    240,

  setSamples: (samples) => set({ samples }),

  addSamples: (samples) => set((s) => ({
    samples: [...s.samples, ...samples],
  })),

  updateSample: (id, patch) => set((s) => ({
    samples: s.samples.map((sample) =>
      sample.id === id ? { ...sample, ...patch } : sample
    ),
  })),

  setFolderTree: (tree) => set({ folderTree: tree }),

  setSelectedFolder: (path) => set({ selectedFolder: path }),

  setScanning: (v) => set({ scanning: v }),

  setScanProgress: (p) => set({ scanProgress: p }),

  setFilter: (patch) => set((s) => ({
    filter: { ...s.filter, ...patch },
  })),

  resetFilter: () => set({ filter: { ...DEFAULT_FILTER } }),

  setSort: (sort, dir) => {
    const state = get()
    if (dir !== undefined) {
      set({ sort, sortDir: dir })
    } else if (sort === state.sort) {
      set({ sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      set({ sort, sortDir: 'asc' })
    }
  },

  toggleSortDir: () => set((s) => ({
    sortDir: s.sortDir === 'asc' ? 'desc' : 'asc',
  })),

  setSelected: (id) => set({ selectedId: id }),

  setPreviewing: (id) => set({ previewingId: id }),

  setPreviewVolume: (v) => set({ previewVolume: Math.max(0, Math.min(1, v)) }),

  setAutoPreview: (v) => set({ autoPreview: v }),

  setAnalyzingCount: (n) => set({ analyzingCount: n }),

  toggleFavorite: (id) => set((s) => ({
    samples: s.samples.map((sample) =>
      sample.id === id ? { ...sample, favorite: !sample.favorite } : sample
    ),
  })),

  addUserTag: (id, tag) => set((s) => ({
    samples: s.samples.map((sample) =>
      sample.id === id && !sample.userTags.includes(tag)
        ? { ...sample, userTags: [...sample.userTags, tag] }
        : sample
    ),
  })),

  removeUserTag: (id, tag) => set((s) => ({
    samples: s.samples.map((sample) =>
      sample.id === id
        ? { ...sample, userTags: sample.userTags.filter((t) => t !== tag) }
        : sample
    ),
  })),

  setWaveformVisible: (v) => set({ waveformVisible: v }),

  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(140, Math.min(480, w)) }),
}))
