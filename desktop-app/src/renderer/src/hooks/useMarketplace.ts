import { useCallback, useEffect, useMemo } from 'react'
import { useMarketplaceStore } from '../store/marketplaceStore'
import { marketplaceClient } from '../services/MarketplaceClient'
import type { MarketProduct } from '../store/marketplaceStore'

export function useMarketplace() {
  const store = useMarketplaceStore()

  // ── Initial load ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    store.setLoading(true)
    store.setError(null)
    try {
      const [featured, trending, products] = await Promise.all([
        marketplaceClient.fetchFeatured(),
        marketplaceClient.fetchTrending(10),
        marketplaceClient.fetchProducts({
          category: store.activeCategory === 'all' ? undefined : store.activeCategory,
          sort: store.sortBy,
        }),
      ])
      store.setFeatured(featured)
      store.setTrending(trending)
      store.setProducts(products)
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Failed to load marketplace')
    } finally {
      store.setLoading(false)
    }
  // Intentionally not including store methods (they are stable) nor filter values (refresh is manual/on-mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void refresh()
  // Run only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Filtered + sorted products ──────────────────────────────────────────────
  const filteredProducts: MarketProduct[] = useMemo(() => {
    let list = [...store.products]

    // Category filter
    if (store.activeCategory !== 'all') {
      list = list.filter((p) => p.category === store.activeCategory)
    }

    // Search filter
    if (store.searchQuery.trim()) {
      const q = store.searchQuery.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.creatorName.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }

    // Sort
    switch (store.sortBy) {
      case 'trending':
        list.sort((a, b) => b.trendingScore - a.trendingScore)
        break
      case 'newest':
        list.sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'popular':
        list.sort((a, b) => b.downloads - a.downloads)
        break
      case 'free':
        list = list.filter((p) => p.price === 0)
        list.sort((a, b) => b.downloads - a.downloads)
        break
      case 'price-asc':
        list.sort((a, b) => a.price - b.price)
        break
    }

    return list
  }, [store.products, store.activeCategory, store.searchQuery, store.sortBy])

  // ── Download handler ────────────────────────────────────────────────────────
  const downloadPack = useCallback(
    async (product: MarketProduct) => {
      store.startDownload(product.id, product.name)
      try {
        const pack = await marketplaceClient.downloadPack(product, (pct) => {
          store.updateDownload(product.id, pct, 'downloading')
        })
        store.updateDownload(product.id, 100, 'installing')
        await new Promise<void>((r) => setTimeout(r, 400))
        store.finishInstall(product.id, pack)
      } catch (err) {
        store.updateDownload(
          product.id,
          0,
          'error',
          err instanceof Error ? err.message : 'Download failed',
        )
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ── Uninstall handler ───────────────────────────────────────────────────────
  const uninstallPack = useCallback(async (productId: string) => {
    await marketplaceClient.uninstallPack(productId)
    store.removeInstalled(productId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Like handler ────────────────────────────────────────────────────────────
  const toggleLike = useCallback((productId: string) => {
    store.toggleLike(productId)
    void marketplaceClient.toggleLike(productId, 'local-user')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    products: store.products,
    filteredProducts,
    featured: store.featured,
    trending: store.trending,
    installed: store.installed,
    downloads: store.downloads,
    likedIds: store.likedIds,
    loading: store.loading,
    error: store.error,
    searchQuery: store.searchQuery,
    activeCategory: store.activeCategory,
    sortBy: store.sortBy,
    setSearch: store.setSearch,
    setCategory: store.setCategory,
    setSort: store.setSort,
    downloadPack,
    uninstallPack,
    toggleLike,
    refresh,
  }
}
