import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ProductCategory =
  | 'kick' | 'hat' | 'snare' | 'perc' | 'preset' | 'template'
  | 'rack' | 'plugin' | 'sample' | 'soundbank' | 'melody' | 'bass'

export interface MarketProduct {
  id: string
  slug: string
  name: string
  description: string
  category: ProductCategory
  tags: string[]
  creatorId: string
  creatorName: string
  price: number
  fileSize: number
  previewUrl: string
  coverUrl: string
  bpm?: number
  key?: string
  sampleCount?: number
  downloads: number
  likes: number
  commentCount: number
  featured: boolean
  trendingScore: number
  createdAt: number
}

export interface InstalledPack {
  productId: string
  name: string
  category: ProductCategory
  installedAt: number
  fileCount: number
  localPath: string
  size: number
  version: string
}

export type DownloadStatus = 'idle' | 'downloading' | 'installing' | 'done' | 'error'

export interface ActiveDownload {
  productId: string
  name: string
  progress: number
  status: DownloadStatus
  error?: string
}

interface MarketplaceStore {
  products: MarketProduct[]
  featured: MarketProduct[]
  trending: MarketProduct[]
  installed: InstalledPack[]
  downloads: ActiveDownload[]
  likedIds: Set<string>
  searchQuery: string
  activeCategory: ProductCategory | 'all'
  sortBy: 'trending' | 'newest' | 'popular' | 'free' | 'price-asc'
  loading: boolean
  error: string | null

  setProducts: (p: MarketProduct[]) => void
  setFeatured: (p: MarketProduct[]) => void
  setTrending: (p: MarketProduct[]) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  toggleLike: (id: string) => void
  startDownload: (productId: string, name: string) => void
  updateDownload: (productId: string, progress: number, status: DownloadStatus, error?: string) => void
  finishInstall: (productId: string, pack: InstalledPack) => void
  setSearch: (q: string) => void
  setCategory: (c: ProductCategory | 'all') => void
  setSort: (s: MarketplaceStore['sortBy']) => void
  removeInstalled: (productId: string) => void
}

// Persist-serialisable shape (Set → string[])
interface PersistedShape {
  likedIds: string[]
  installed: InstalledPack[]
}

export const useMarketplaceStore = create<MarketplaceStore>()(
  persist(
    (set) => ({
      products: [],
      featured: [],
      trending: [],
      installed: [],
      downloads: [],
      likedIds: new Set<string>(),
      searchQuery: '',
      activeCategory: 'all',
      sortBy: 'trending',
      loading: false,
      error: null,

      setProducts: (p) => set({ products: p }),
      setFeatured: (p) => set({ featured: p }),
      setTrending: (p) => set({ trending: p }),
      setLoading: (v) => set({ loading: v }),
      setError: (e) => set({ error: e }),

      toggleLike: (id) =>
        set((s) => {
          const next = new Set(s.likedIds)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { likedIds: next }
        }),

      startDownload: (productId, name) =>
        set((s) => ({
          downloads: [
            ...s.downloads.filter((d) => d.productId !== productId),
            { productId, name, progress: 0, status: 'downloading' as DownloadStatus },
          ],
        })),

      updateDownload: (productId, progress, status, error) =>
        set((s) => ({
          downloads: s.downloads.map((d) =>
            d.productId === productId ? { ...d, progress, status, error } : d,
          ),
        })),

      finishInstall: (productId, pack) =>
        set((s) => ({
          installed: [
            ...s.installed.filter((i) => i.productId !== productId),
            pack,
          ],
          downloads: s.downloads.map((d) =>
            d.productId === productId ? { ...d, progress: 100, status: 'done' as DownloadStatus } : d,
          ),
        })),

      setSearch: (q) => set({ searchQuery: q }),
      setCategory: (c) => set({ activeCategory: c }),
      setSort: (s) => set({ sortBy: s }),
      removeInstalled: (productId) =>
        set((s) => ({ installed: s.installed.filter((i) => i.productId !== productId) })),
    }),
    {
      name: 'marketplace-store',
      partialize: (state): PersistedShape => ({
        likedIds: Array.from(state.likedIds),
        installed: state.installed,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<PersistedShape>
        return {
          ...current,
          likedIds: new Set<string>(Array.isArray(p.likedIds) ? p.likedIds : []),
          installed: Array.isArray(p.installed) ? p.installed : [],
        }
      },
    },
  ),
)
