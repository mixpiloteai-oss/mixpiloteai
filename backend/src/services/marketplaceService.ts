// ============================================================
// NEUROTEK AI — Marketplace Service
// All data persisted in PostgreSQL via marketplaceRepository.
// ============================================================
import { mediumCache, shortCache }  from '../lib/serverCache'
import { isSupabaseConfigured }     from '../lib/supabase'
import { marketplaceRepository }    from '../repositories/marketplaceRepository'
import { logger }                    from '../utils/logger'

export type ProductCategory =
  | 'kick' | 'hat' | 'snare' | 'perc' | 'preset' | 'template'
  | 'rack' | 'plugin' | 'sample' | 'soundbank' | 'melody' | 'bass'

export type ProductStatus = 'pending' | 'approved' | 'rejected' | 'flagged'

export interface MarketProduct {
  id: string; slug: string; name: string; description: string
  category: ProductCategory; tags: string[]
  creatorId: string; creatorName: string
  price: number; currency: 'USD'
  fileSize: number; fileUrl: string; previewUrl: string; coverUrl: string
  bpm?: number; key?: string; sampleCount?: number
  status: ProductStatus
  downloads: number; likes: number; likedBy: Set<string>
  commentCount: number; createdAt: number; updatedAt: number
  featured: boolean; trendingScore: number
}

export interface ProductComment {
  id: string; productId: string; userId: string; userName: string
  text: string; rating: number; createdAt: number
}

// ── Row → Domain mapper ───────────────────────────────────────
function rowToProduct(r: any): MarketProduct {
  return {
    id: r.id, slug: r.slug, name: r.name, description: r.description,
    category: r.category as ProductCategory, tags: r.tags ?? [],
    creatorId: r.creator_id, creatorName: r.creator_name,
    price: r.price, currency: 'USD',
    fileSize: r.file_size ?? 0, fileUrl: r.file_url ?? '',
    previewUrl: r.preview_url ?? '', coverUrl: r.cover_url ?? '',
    bpm: r.bpm ?? undefined, key: r.key ?? undefined, sampleCount: r.sample_count ?? undefined,
    status: r.status as ProductStatus,
    downloads: r.downloads ?? 0, likes: r.likes ?? 0,
    likedBy: new Set<string>(),   // populated lazily if needed
    commentCount: r.comment_count ?? 0,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
    featured: r.featured ?? false,
    trendingScore: Number(r.trending_score ?? 0),
  }
}

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Seed data (runs once on first startup) ─────────────────────
let _seeded = false

export async function seedProducts(): Promise<void> {
  if (_seeded) return
  _seeded = true
  try {
    if (!isSupabaseConfigured) return   // no DB — in-memory fallback handles product data
    const count = await marketplaceRepository.count()
    if (count > 0) return   // already seeded

    const now = Date.now(); const day = 86_400_000
    let counter = 1
    function makeId() { return `mp-${String(counter++).padStart(4, '0')}` }

    const seeds: Omit<MarketProduct, 'id' | 'slug' | 'likedBy' | 'trendingScore'>[] = [
      { name: 'Dark Collective Kick Vol.1', description: 'Ultra-punchy hardtek and mentalcore kicks.', category: 'kick', tags: ['hardtek','mentalcore','dark'], creatorId: 'cr-001', creatorName: 'Dark Collective', price: 0, currency: 'USD', fileSize: 18_500_000, fileUrl: '/uploads/dark-collective-kick-vol1.zip', previewUrl: '/previews/dark-collective-kick-vol1.mp3', coverUrl: '/covers/dark-collective-kick-vol1.jpg', bpm: 200, sampleCount: 48, status: 'approved', downloads: 4823, likes: 921, commentCount: 134, createdAt: now-45*day, updatedAt: now-2*day, featured: true },
      { name: 'Dark Collective Kick Vol.2', description: 'Second volume — deeper sub, rawer compression.', category: 'kick', tags: ['hardtek','mentalcore','sub','raw'], creatorId: 'cr-001', creatorName: 'Dark Collective', price: 499, currency: 'USD', fileSize: 22_100_000, fileUrl: '/uploads/dark-collective-kick-vol2.zip', previewUrl: '/previews/dark-collective-kick-vol2.mp3', coverUrl: '/covers/dark-collective-kick-vol2.jpg', bpm: 200, sampleCount: 64, status: 'approved', downloads: 2341, likes: 512, commentCount: 78, createdAt: now-30*day, updatedAt: now-1*day, featured: false },
      { name: 'Industrial Kick Bundle', description: 'Heavy metal-influenced kicks for industrial techno.', category: 'kick', tags: ['industrial','techno','metal'], creatorId: 'cr-003', creatorName: 'IndustrialMind', price: 999, currency: 'USD', fileSize: 31_200_000, fileUrl: '/uploads/industrial-kick-bundle.zip', previewUrl: '/previews/industrial-kick-bundle.mp3', coverUrl: '/covers/industrial-kick-bundle.jpg', bpm: 150, sampleCount: 72, status: 'approved', downloads: 1654, likes: 389, commentCount: 56, createdAt: now-20*day, updatedAt: now-3*day, featured: false },
      { name: 'Crispy Hi-Hat Collection', description: '120 open and closed hi-hats.', category: 'hat', tags: ['house','techno','crispy'], creatorId: 'cr-002', creatorName: 'SynthMaster', price: 299, currency: 'USD', fileSize: 9_800_000, fileUrl: '/uploads/crispy-hihat-collection.zip', previewUrl: '/previews/crispy-hihat-collection.mp3', coverUrl: '/covers/crispy-hihat-collection.jpg', sampleCount: 120, status: 'approved', downloads: 3201, likes: 644, commentCount: 89, createdAt: now-60*day, updatedAt: now-5*day, featured: true },
      { name: 'Tribe Tribal Hats', description: 'Organic hand percussion-derived hi-hat textures.', category: 'hat', tags: ['tribe','organic','forest'], creatorId: 'cr-005', creatorName: 'TribeWarrior', price: 0, currency: 'USD', fileSize: 7_400_000, fileUrl: '/uploads/tribe-tribal-hats.zip', previewUrl: '/previews/tribe-tribal-hats.mp3', coverUrl: '/covers/tribe-tribal-hats.jpg', sampleCount: 88, status: 'approved', downloads: 2890, likes: 543, commentCount: 67, createdAt: now-50*day, updatedAt: now-4*day, featured: false },
      { name: 'Hardtek Snare Arsenal', description: 'Punishing snare collection for 200 BPM tekno.', category: 'snare', tags: ['hardtek','tekno','reverb'], creatorId: 'cr-001', creatorName: 'Dark Collective', price: 799, currency: 'USD', fileSize: 12_300_000, fileUrl: '/uploads/hardtek-snare-arsenal.zip', previewUrl: '/previews/hardtek-snare-arsenal.mp3', coverUrl: '/covers/hardtek-snare-arsenal.jpg', bpm: 200, sampleCount: 56, status: 'approved', downloads: 2145, likes: 478, commentCount: 72, createdAt: now-35*day, updatedAt: now-2*day, featured: false },
      { name: 'Electronic Snare Pack', description: 'Classic TR-909 and 808 snares resampled.', category: 'snare', tags: ['909','808','electronic','classic'], creatorId: 'cr-004', creatorName: 'RetroFuture', price: 0, currency: 'USD', fileSize: 8_100_000, fileUrl: '/uploads/electronic-snare-pack.zip', previewUrl: '/previews/electronic-snare-pack.mp3', coverUrl: '/covers/electronic-snare-pack.jpg', sampleCount: 40, status: 'approved', downloads: 5432, likes: 1102, commentCount: 198, createdAt: now-90*day, updatedAt: now-10*day, featured: true },
      { name: 'Ambient Texture Palette', description: 'Evolving ambient textures, drones, and field recordings.', category: 'sample', tags: ['ambient','texture','drone','field'], creatorId: 'cr-008', creatorName: 'ChillWave', price: 0, currency: 'USD', fileSize: 67_000_000, fileUrl: '/uploads/ambient-texture-palette.zip', previewUrl: '/previews/ambient-texture-palette.mp3', coverUrl: '/covers/ambient-texture-palette.jpg', sampleCount: 80, status: 'approved', downloads: 7654, likes: 1987, commentCount: 312, createdAt: now-110*day, updatedAt: now-8*day, featured: true },
      { name: 'Hardtek Full Soundbank', description: 'Complete hardtek soundbank: 300+ samples.', category: 'soundbank', tags: ['hardtek','complete','full'], creatorId: 'cr-001', creatorName: 'Dark Collective', price: 4999, currency: 'USD', fileSize: 280_000_000, fileUrl: '/uploads/hardtek-full-soundbank.zip', previewUrl: '/previews/hardtek-full-soundbank.mp3', coverUrl: '/covers/hardtek-full-soundbank.jpg', bpm: 200, sampleCount: 320, status: 'approved', downloads: 2341, likes: 678, commentCount: 134, createdAt: now-18*day, updatedAt: now-1*day, featured: true },
      { name: 'Acid Melody Loops', description: '80 acid melody loops in various keys.', category: 'melody', tags: ['acid','loops','303'], creatorId: 'cr-006', creatorName: 'PsychAcid', price: 799, currency: 'USD', fileSize: 34_000_000, fileUrl: '/uploads/acid-melody-loops.zip', previewUrl: '/previews/acid-melody-loops.mp3', coverUrl: '/covers/acid-melody-loops.jpg', bpm: 135, sampleCount: 80, status: 'approved', downloads: 3214, likes: 723, commentCount: 123, createdAt: now-48*day, updatedAt: now-4*day, featured: false },
      { name: 'Emotional Piano Phrases', description: 'Heartfelt piano phrases for lo-fi, soul, and R&B.', category: 'melody', tags: ['piano','emotional','soul','lofi'], creatorId: 'cr-008', creatorName: 'ChillWave', price: 1499, currency: 'USD', fileSize: 42_000_000, fileUrl: '/uploads/emotional-piano-phrases.zip', previewUrl: '/previews/emotional-piano-phrases.mp3', coverUrl: '/covers/emotional-piano-phrases.jpg', bpm: 80, key: 'Cm', sampleCount: 60, status: 'approved', downloads: 5678, likes: 1456, commentCount: 267, createdAt: now-92*day, updatedAt: now-9*day, featured: true },
      { name: 'Sub Bass Toolkit', description: '60 sub bass one-shots and loops.', category: 'bass', tags: ['sub','bass','deep','808'], creatorId: 'cr-001', creatorName: 'Dark Collective', price: 699, currency: 'USD', fileSize: 22_000_000, fileUrl: '/uploads/sub-bass-toolkit.zip', previewUrl: '/previews/sub-bass-toolkit.mp3', coverUrl: '/covers/sub-bass-toolkit.jpg', sampleCount: 60, status: 'approved', downloads: 3890, likes: 867, commentCount: 145, createdAt: now-55*day, updatedAt: now-3*day, featured: false },
      { name: 'DnB & Jungle Breaks Pack', description: 'Essential drum & bass and jungle break patterns.', category: 'sample', tags: ['dnb','jungle','breaks','amen'], creatorId: 'cr-004', creatorName: 'RetroFuture', price: 0, currency: 'USD', fileSize: 43_000_000, fileUrl: '/uploads/dnb-jungle-breaks-pack.zip', previewUrl: '/previews/dnb-jungle-breaks-pack.mp3', coverUrl: '/covers/dnb-jungle-breaks-pack.jpg', bpm: 170, sampleCount: 90, status: 'approved', downloads: 9123, likes: 2234, commentCount: 412, createdAt: now-130*day, updatedAt: now-12*day, featured: true },
      { name: 'Kick + Sub Layering Rack', description: 'Rack for blending kick and sub bass.', category: 'rack', tags: ['kick','sub','layer','phase'], creatorId: 'cr-001', creatorName: 'Dark Collective', price: 499, currency: 'USD', fileSize: 780_000, fileUrl: '/uploads/kick-sub-layering-rack.zip', previewUrl: '/previews/kick-sub-layering-rack.mp3', coverUrl: '/covers/kick-sub-layering-rack.jpg', status: 'approved', downloads: 6789, likes: 1543, commentCount: 289, createdAt: now-88*day, updatedAt: now-2*day, featured: false },
      { name: 'Snare Rolls & Fills Kit', description: 'Live-feel snare rolls and fills.', category: 'snare', tags: ['rolls','fills','ghost','live-feel'], creatorId: 'cr-007', creatorName: 'LiveMaster', price: 0, currency: 'USD', fileSize: 14_000_000, fileUrl: '/uploads/snare-rolls-fills-kit.zip', previewUrl: '/previews/snare-rolls-fills-kit.mp3', coverUrl: '/covers/snare-rolls-fills-kit.jpg', sampleCount: 100, status: 'approved', downloads: 5890, likes: 1234, commentCount: 198, createdAt: now-95*day, updatedAt: now-9*day, featured: false },
    ]

    for (const s of seeds) {
      const id = makeId()
      const slug = makeSlug(s.name)
      const trendingScore = s.downloads * 2 + s.likes * 3
      await marketplaceRepository.upsert({
        id, slug, name: s.name, description: s.description,
        category: s.category, tags: s.tags,
        creator_id: s.creatorId, creator_name: s.creatorName,
        price: s.price, currency: 'USD',
        file_size: s.fileSize, file_url: s.fileUrl,
        preview_url: s.previewUrl, cover_url: s.coverUrl,
        bpm: s.bpm ?? null, key: s.key ?? null, sample_count: s.sampleCount ?? null,
        status: s.status, downloads: s.downloads, likes: s.likes,
        comment_count: s.commentCount, featured: s.featured, trending_score: trendingScore,
        created_at: new Date(s.createdAt).toISOString(),
        updated_at: new Date(s.updatedAt).toISOString(),
      })
    }
    logger.info(`marketplaceService: seeded ${seeds.length} products`)
  } catch (e) {
    _seeded = false
    logger.warn('marketplaceService: seed failed', { error: e })
  }
}

// ── Filters & pagination ──────────────────────────────────────
interface GetProductsOpts {
  category?: ProductCategory
  tags?: string
  search?: string
  sort?: 'trending' | 'newest' | 'popular' | 'price-asc' | 'price-desc' | 'free'
  page?: number
  limit?: number
}

export async function getProducts(filters: GetProductsOpts = {}): Promise<{
  products: MarketProduct[]
  total: number
  page: number
  pages: number
}> {
  await seedProducts()
  if (!isSupabaseConfigured) return { products: [], total: 0, page: 1, pages: 0 }
  const { category, tags, search, sort = 'trending', page = 1, limit = 20 } = filters
  const cacheKey = `market:list:${JSON.stringify({ category, tags, search, sort, page, limit })}`
  const hit = mediumCache.get(cacheKey)
  if (hit) return hit as { products: MarketProduct[]; total: number; page: number; pages: number }

  const sortBy =
    sort === 'newest'     ? 'created_at' :
    sort === 'popular'    ? 'downloads' :
    sort === 'price-asc'  ? 'created_at' :   // secondary sort by price done in-memory
    sort === 'price-desc' ? 'created_at' :
    sort === 'free'       ? 'downloads' :
                            'trending_score'

  const rows = await marketplaceRepository.list({
    category, search, status: 'approved',
    sortBy,
    freeOnly: sort === 'free',
    limit:  limit * 5,   // fetch more than needed for in-memory price-sort & tag filter
    offset: 0,
  })

  let result = rows.map(rowToProduct)

  // Tag filter (Supabase doesn't support array-contains-any natively via the JS client easily)
  if (tags) {
    const tagList = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    result = result.filter(p => tagList.some(t => p.tags.includes(t)))
  }

  // In-memory sorts that need special ordering
  if (sort === 'price-asc')  result.sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') result.sort((a, b) => b.price - a.price)

  const total = result.length
  const pages = Math.ceil(total / limit)
  const start = (page - 1) * limit
  const paged = { products: result.slice(start, start + limit), total, page, pages }

  mediumCache.set(cacheKey, paged, 3 * 60_000)
  return paged
}

export async function getProduct(id: string): Promise<MarketProduct | null> {
  await seedProducts()
  if (!isSupabaseConfigured) return null
  const cacheKey = `market:product:${id}`
  const hit = mediumCache.get(cacheKey)
  if (hit) return hit as MarketProduct
  const row = await marketplaceRepository.findById(id)
  if (!row) return null
  const product = rowToProduct(row)
  mediumCache.set(cacheKey, product, 10 * 60_000)
  return product
}

export async function getFeatured(): Promise<MarketProduct[]> {
  await seedProducts()
  if (!isSupabaseConfigured) return []
  const rows = await marketplaceRepository.list({ featuredOnly: true, status: 'approved', sortBy: 'trending', limit: 6 })
  return rows.map(rowToProduct)
}

export async function getTrending(limit = 10): Promise<MarketProduct[]> {
  await seedProducts()
  if (!isSupabaseConfigured) return []
  const rows = await marketplaceRepository.list({ status: 'approved', sortBy: 'trending', limit })
  return rows.map(rowToProduct)
}

export async function getByCreator(creatorId: string): Promise<MarketProduct[]> {
  if (!creatorId || !isSupabaseConfigured) return []
  const { supabase } = await import('../lib/db')
  if (!supabase) return []
  const { data } = await supabase.from('marketplace_products').select('*').eq('creator_id', creatorId)
  return (data ?? []).map(rowToProduct)
}

export async function toggleLike(productId: string, userId: string): Promise<{ liked: boolean; likes: number }> {
  if (!isSupabaseConfigured) return { liked: false, likes: 0 }
  const { liked, totalLikes } = await marketplaceRepository.toggleLike(productId, userId)
  mediumCache.delete(`market:product:${productId}`)
  mediumCache.invalidatePrefix('market:list:')
  return { liked, likes: totalLikes }
}

export async function recordDownload(productId: string, _userId: string): Promise<void> {
  if (!isSupabaseConfigured) return
  await marketplaceRepository.incrementDownloads(productId)
  mediumCache.delete(`market:product:${productId}`)
  mediumCache.invalidatePrefix('market:list:')
}

export async function addComment(
  productId: string, userId: string, userName: string, text: string, rating: number
): Promise<ProductComment> {
  if (!isSupabaseConfigured) throw new Error('DB not configured')
  const row = await marketplaceRepository.addComment({
    product_id: productId, user_id: userId, user_name: userName, text,
    rating: Math.min(5, Math.max(1, rating)),
  })
  return {
    id: row.id, productId: row.product_id, userId: row.user_id, userName: row.user_name,
    text: row.text, rating: row.rating, createdAt: new Date(row.created_at).getTime(),
  }
}

export async function getComments(productId: string): Promise<ProductComment[]> {
  if (!isSupabaseConfigured) return []
  const rows = await marketplaceRepository.getComments(productId)
  return rows.map(r => ({
    id: r.id, productId: r.product_id, userId: r.user_id, userName: r.user_name,
    text: r.text, rating: r.rating, createdAt: new Date(r.created_at).getTime(),
  }))
}

export async function createProduct(
  data: Omit<MarketProduct, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'downloads' | 'likes' | 'likedBy' | 'commentCount' | 'trendingScore'>
): Promise<MarketProduct> {
  const { supabase, isSupabaseConfigured } = await import('../lib/db')
  if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
  const { data: p } = await supabase.from('marketplace_products')
    .select('id').order('id', { ascending: false }).limit(1).single()
  const lastNum = p ? parseInt((p as any).id.replace('mp-', ''), 10) : 0
  const id   = `mp-${String(lastNum + 1).padStart(4, '0')}`
  const slug = makeSlug(data.name)
  const now  = new Date().toISOString()
  await marketplaceRepository.upsert({
    id, slug, name: data.name, description: data.description,
    category: data.category, tags: data.tags,
    creator_id: data.creatorId, creator_name: data.creatorName,
    price: data.price, currency: 'USD',
    file_size: data.fileSize, file_url: data.fileUrl,
    preview_url: data.previewUrl, cover_url: data.coverUrl,
    bpm: data.bpm ?? null, key: data.key ?? null, sample_count: data.sampleCount ?? null,
    status: data.status, downloads: 0, likes: 0, comment_count: 0,
    featured: data.featured ?? false, trending_score: 0,
    created_at: now, updated_at: now,
  })
  mediumCache.invalidatePrefix('market:list:')
  return {
    ...data, id, slug, downloads: 0, likes: 0, likedBy: new Set(),
    commentCount: 0, createdAt: Date.now(), updatedAt: Date.now(), trendingScore: 0,
  }
}

export async function moderateProduct(id: string, status: ProductStatus, _reason?: string): Promise<MarketProduct | null> {
  if (!isSupabaseConfigured) return null
  await marketplaceRepository.updateStatus(id, status)
  mediumCache.delete(`market:product:${id}`)
  mediumCache.invalidatePrefix('market:list:')
  return getProduct(id)
}

// ── Init ──────────────────────────────────────────────────────
void seedProducts()
