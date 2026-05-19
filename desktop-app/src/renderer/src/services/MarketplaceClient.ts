import type { MarketProduct, InstalledPack, ProductCategory } from '../store/marketplaceStore'

const API_URL = 'https://mixpiloteai-production.up.railway.app'

// ─── Mock seed data ────────────────────────────────────────────────────────────
const MOCK_PRODUCTS: MarketProduct[] = [
  {
    id: 'mock-001', slug: 'hardtek-kick-pack', name: 'Hardtek Kick Pack', description: 'Hard industrial kicks for Hardtek and Frenchcore',
    category: 'kick', tags: ['hardtek', 'industrial', '145bpm'], creatorId: 'u1', creatorName: 'BassForge',
    price: 0, fileSize: 48 * 1024 * 1024, previewUrl: '', coverUrl: '',
    bpm: 145, sampleCount: 24, downloads: 1240, likes: 340, commentCount: 18,
    featured: true, trendingScore: 95, createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'mock-002', slug: 'dark-techno-hats', name: 'Dark Techno Hats', description: 'Crisp hi-hats for dark techno and acid',
    category: 'hat', tags: ['techno', 'dark', 'acid'], creatorId: 'u2', creatorName: 'NightFreq',
    price: 4.99, fileSize: 22 * 1024 * 1024, previewUrl: '', coverUrl: '',
    sampleCount: 32, downloads: 890, likes: 210, commentCount: 9,
    featured: false, trendingScore: 78, createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'mock-003', slug: 'frenchcore-snare-arsenal', name: 'Frenchcore Snare Arsenal', description: 'Layered distorted snares tuned for Frenchcore',
    category: 'snare', tags: ['frenchcore', 'hardcore', '175bpm'], creatorId: 'u3', creatorName: 'CrunchLab',
    price: 7.99, fileSize: 35 * 1024 * 1024, previewUrl: '', coverUrl: '',
    bpm: 175, sampleCount: 18, downloads: 670, likes: 198, commentCount: 14,
    featured: true, trendingScore: 82, createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'mock-004', slug: 'tekno-perc-bundle', name: 'Tekno Perc Bundle', description: 'Percussion loops and one-shots for free tekno',
    category: 'perc', tags: ['tekno', 'tribal', 'free'], creatorId: 'u4', creatorName: 'TeknoWolf',
    price: 0, fileSize: 60 * 1024 * 1024, previewUrl: '', coverUrl: '',
    sampleCount: 48, downloads: 2100, likes: 520, commentCount: 33,
    featured: true, trendingScore: 99, createdAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'mock-005', slug: 'acid-bass-presets', name: 'Acid Bass Presets', description: '303-style acid bass synthesiser presets',
    category: 'preset', tags: ['acid', 'bass', '303'], creatorId: 'u5', creatorName: 'AcidCore',
    price: 9.99, fileSize: 4 * 1024 * 1024, previewUrl: '', coverUrl: '',
    downloads: 430, likes: 155, commentCount: 7,
    featured: false, trendingScore: 60, createdAt: Date.now() - 86400000 * 10,
  },
  {
    id: 'mock-006', slug: 'hardstyle-template', name: 'Hardstyle Template', description: 'Full hardstyle production template with stems',
    category: 'template', tags: ['hardstyle', 'template', 'reverse-bass'], creatorId: 'u6', creatorName: 'HardLab',
    price: 14.99, fileSize: 120 * 1024 * 1024, previewUrl: '', coverUrl: '',
    bpm: 150, downloads: 320, likes: 98, commentCount: 21,
    featured: true, trendingScore: 74, createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'mock-007', slug: 'fx-rack-distortion', name: 'FX Rack — Distortion Suite', description: 'Distortion and saturation FX rack for heavy music',
    category: 'rack', tags: ['fx', 'distortion', 'rack'], creatorId: 'u7', creatorName: 'IronPlugin',
    price: 0, fileSize: 2 * 1024 * 1024, previewUrl: '', coverUrl: '',
    downloads: 1800, likes: 440, commentCount: 27,
    featured: false, trendingScore: 88, createdAt: Date.now() - 86400000 * 4,
  },
  {
    id: 'mock-008', slug: 'neuro-bass-vst', name: 'Neuro Bass Plugin', description: 'VST3 neurofunk bass synth engine',
    category: 'plugin', tags: ['vst', 'bass', 'neuro'], creatorId: 'u8', creatorName: 'SynthForge',
    price: 29.99, fileSize: 80 * 1024 * 1024, previewUrl: '', coverUrl: '',
    downloads: 210, likes: 87, commentCount: 15,
    featured: true, trendingScore: 71, createdAt: Date.now() - 86400000 * 14,
  },
  {
    id: 'mock-009', slug: 'industrial-atmosphere-samples', name: 'Industrial Atmospheres', description: 'Textural industrial ambience and drone samples',
    category: 'sample', tags: ['industrial', 'ambient', 'texture'], creatorId: 'u9', creatorName: 'VoidSonic',
    price: 0, fileSize: 95 * 1024 * 1024, previewUrl: '', coverUrl: '',
    sampleCount: 64, downloads: 3200, likes: 790, commentCount: 45,
    featured: true, trendingScore: 97, createdAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'mock-010', slug: 'rave-soundbank', name: 'Rave Era Soundbank', description: '90s rave & gabber complete soundbank',
    category: 'soundbank', tags: ['rave', '90s', 'gabber'], creatorId: 'u10', creatorName: 'RetroRave',
    price: 19.99, fileSize: 200 * 1024 * 1024, previewUrl: '', coverUrl: '',
    sampleCount: 256, downloads: 540, likes: 178, commentCount: 22,
    featured: false, trendingScore: 65, createdAt: Date.now() - 86400000 * 20,
  },
  {
    id: 'mock-011', slug: 'dark-melody-loops', name: 'Dark Melody Loops', description: 'Dark chromatic melody loops for Hardtek and DnB',
    category: 'melody', tags: ['melody', 'dark', 'loops'], creatorId: 'u11', creatorName: 'MeloticDark',
    price: 5.99, fileSize: 28 * 1024 * 1024, previewUrl: '', coverUrl: '',
    bpm: 145, key: 'D Minor', sampleCount: 20, downloads: 710, likes: 220, commentCount: 11,
    featured: false, trendingScore: 72, createdAt: Date.now() - 86400000 * 6,
  },
  {
    id: 'mock-012', slug: 'sub-bass-toolkit', name: 'Sub Bass Toolkit', description: 'Deep sub bass one-shots and loops for club music',
    category: 'bass', tags: ['sub', 'bass', 'club'], creatorId: 'u12', creatorName: 'SubLevel',
    price: 0, fileSize: 40 * 1024 * 1024, previewUrl: '', coverUrl: '',
    sampleCount: 30, downloads: 2800, likes: 620, commentCount: 38,
    featured: true, trendingScore: 93, createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'mock-013', slug: 'psytrance-kick-collection', name: 'Psytrance Kick Collection', description: 'Punchy, layered kicks engineered for full-power psytrance',
    category: 'kick', tags: ['psytrance', 'fullon', '145bpm'], creatorId: 'u13', creatorName: 'PsyLab',
    price: 3.99, fileSize: 18 * 1024 * 1024, previewUrl: '', coverUrl: '',
    bpm: 145, sampleCount: 16, downloads: 980, likes: 290, commentCount: 13,
    featured: false, trendingScore: 80, createdAt: Date.now() - 86400000 * 8,
  },
  {
    id: 'mock-014', slug: 'gabber-snare-pack', name: 'Gabber Snare Pack', description: 'Classic distorted gabber snares and claps',
    category: 'snare', tags: ['gabber', 'hardcore', 'classic'], creatorId: 'u14', creatorName: 'GabberGod',
    price: 0, fileSize: 14 * 1024 * 1024, previewUrl: '', coverUrl: '',
    sampleCount: 22, downloads: 1560, likes: 380, commentCount: 19,
    featured: false, trendingScore: 85, createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'mock-015', slug: 'acid-techno-template', name: 'Acid Techno Template', description: 'Complete Acid Techno project template at 138 BPM',
    category: 'template', tags: ['acid', 'techno', 'template'], creatorId: 'u15', creatorName: 'AcidCore',
    price: 12.99, fileSize: 90 * 1024 * 1024, previewUrl: '', coverUrl: '',
    bpm: 138, downloads: 460, likes: 142, commentCount: 17,
    featured: false, trendingScore: 69, createdAt: Date.now() - 86400000 * 12,
  },
]

// ─── Type guard for API response ───────────────────────────────────────────────
function isProductArray(v: unknown): v is MarketProduct[] {
  return Array.isArray(v)
}

// ─── Client ────────────────────────────────────────────────────────────────────
export class MarketplaceClient {
  private static _instance: MarketplaceClient

  static getInstance(): MarketplaceClient {
    if (!MarketplaceClient._instance) {
      MarketplaceClient._instance = new MarketplaceClient()
    }
    return MarketplaceClient._instance
  }

  private async _get<T>(path: string, fallback: T): Promise<T> {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: unknown = await res.json()
      return data as T
    } catch {
      return fallback
    }
  }

  async fetchProducts(filters?: {
    category?: string
    search?: string
    sort?: string
  }): Promise<MarketProduct[]> {
    const params = new URLSearchParams()
    if (filters?.category && filters.category !== 'all') params.set('category', filters.category)
    if (filters?.search) params.set('search', filters.search)
    if (filters?.sort) params.set('sort', filters.sort)
    const qs = params.toString()
    const path = `/api/marketplace/products${qs ? `?${qs}` : ''}`
    const raw = await this._get<unknown>(path, null)
    if (isProductArray(raw)) return raw
    return [...MOCK_PRODUCTS]
  }

  async fetchFeatured(): Promise<MarketProduct[]> {
    const raw = await this._get<unknown>('/api/marketplace/products/featured', null)
    if (isProductArray(raw)) return raw
    return MOCK_PRODUCTS.filter((p) => p.featured)
  }

  async fetchTrending(limit = 10): Promise<MarketProduct[]> {
    const raw = await this._get<unknown>(`/api/marketplace/products/trending?limit=${limit}`, null)
    if (isProductArray(raw)) return raw
    return [...MOCK_PRODUCTS]
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit)
  }

  async toggleLike(
    productId: string,
    userId: string,
  ): Promise<{ liked: boolean; likes: number }> {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/products/${productId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { liked: boolean; likes: number }
      return data
    } catch {
      return { liked: true, likes: 0 }
    }
  }

  async downloadPack(
    product: MarketProduct,
    onProgress: (pct: number) => void,
  ): Promise<InstalledPack> {
    return new Promise<InstalledPack>((resolve) => {
      let pct = 0
      const interval = setInterval(() => {
        pct = Math.min(pct + Math.random() * 12 + 5, 100)
        onProgress(Math.round(pct))
        if (pct >= 100) {
          clearInterval(interval)
          const pack: InstalledPack = {
            productId: product.id,
            name: product.name,
            category: product.category as ProductCategory,
            installedAt: Date.now(),
            fileCount: product.sampleCount ?? 1,
            localPath: `~/Documents/NeuroTek/Packs/${product.category}/${product.name}`,
            size: product.fileSize,
            version: '1.0.0',
          }
          resolve(pack)
        }
      }, 150)
    })
  }

  async uninstallPack(productId: string): Promise<void> {
    // Simulate local file removal — no server call needed
    await new Promise<void>((resolve) => setTimeout(resolve, 200))
    void productId
  }

  async getRecommendations(
    userId: string,
    likedCategories: string[],
  ): Promise<MarketProduct[]> {
    const qs = new URLSearchParams({ userId, limit: '6' })
    likedCategories.forEach((c) => qs.append('category', c))
    const raw = await this._get<unknown>(
      `/api/marketplace/recommendations?${qs.toString()}`,
      null,
    )
    if (isProductArray(raw)) return raw
    // Fallback: top trending
    return [...MOCK_PRODUCTS].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 6)
  }
}

export const marketplaceClient = MarketplaceClient.getInstance()
