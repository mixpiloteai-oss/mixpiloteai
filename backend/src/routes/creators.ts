// ============================================================
// NEUROTEK AI — Creator Routes
// ============================================================
import { Router, Request, Response } from 'express'
import {
  getCreator,
  getCreatorBySlug,
  listCreators,
  followCreator,
  getAnalytics,
  subscribeToTier,
  getTopCreators,
  createCreator,
  requestPayout,
  type CreatorProfile,
} from '../services/creatorService'
import {
  getByCreator,
  createProduct,
  type ProductCategory,
  type ProductStatus,
} from '../services/marketplaceService'
import {
  createUploadSession,
  receiveChunk,
  completeUpload,
  getUploadSession,
  listUploadSessionsByCreator,
} from '../services/uploadService'

const router = Router()

function getUserId(req: Request): string {
  const header = req.headers['x-user-id']
  if (typeof header === 'string' && header.trim()) return header.trim()
  return 'anonymous'
}

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// GET /api/creators
router.get('/', (req: Request, res: Response) => {
  const sort = (req.query.sort as 'popular' | 'newest' | 'trending') ?? 'popular'
  res.json({ success: true, data: listCreators(sort) })
})

// GET /api/creators/top
router.get('/top', (req: Request, res: Response) => {
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 20) : 6
  res.json({ success: true, data: getTopCreators(limit) })
})

// GET /api/creators/:slug  (slug-based lookup)
router.get('/:slug', (req: Request, res: Response) => {
  // Try slug first, then id
  const creator = getCreatorBySlug(req.params.slug) ?? getCreator(req.params.slug)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  res.json({ success: true, data: creator })
})

// GET /api/creators/:id/products
router.get('/:id/products', (req: Request, res: Response) => {
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  res.json({ success: true, data: getByCreator(creator.id) })
})

// GET /api/creators/:id/analytics
router.get('/:id/analytics', (req: Request, res: Response) => {
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  const period = (req.query.period as '7d' | '30d' | '90d') ?? '30d'
  res.json({ success: true, data: getAnalytics(creator.id, period) })
})

// POST /api/creators/:id/follow
router.post('/:id/follow', (req: Request, res: Response) => {
  const userId = getUserId(req)
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  const result = followCreator(creator.id, userId)
  res.json({ success: true, data: result })
})

// POST /api/creators/:id/subscribe
router.post('/:id/subscribe', (req: Request, res: Response) => {
  const userId = getUserId(req)
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  const { tierId } = req.body as { tierId?: string }
  if (!tierId) return res.status(400).json({ success: false, error: 'tierId is required' })
  const ok = subscribeToTier(creator.id, tierId, userId)
  if (!ok) return res.status(404).json({ success: false, error: 'Subscription tier not found' })
  res.json({ success: true, message: 'Subscribed successfully' })
})

// POST /api/creators  — register creator profile
router.post('/', (req: Request, res: Response) => {
  const {
    userId,
    displayName,
    bio,
    genres,
    socialLinks,
    avatarUrl,
    bannerUrl,
  } = req.body as {
    userId?: string
    displayName?: string
    bio?: string
    genres?: string[]
    socialLinks?: { platform: string; url: string }[]
    avatarUrl?: string
    bannerUrl?: string
  }

  if (!displayName || !userId) {
    return res.status(400).json({ success: false, error: 'displayName and userId are required' })
  }

  const id = `cr-${Date.now()}`
  const slug = makeSlug(displayName)

  const creator = createCreator({
    id,
    userId,
    slug,
    displayName,
    bio: bio ?? '',
    avatarUrl: avatarUrl ?? '/avatars/default.jpg',
    bannerUrl: bannerUrl ?? '/banners/default.jpg',
    genres: genres ?? [],
    verified: false,
    socialLinks: socialLinks ?? [],
    subscriptionTiers: [],
  })

  res.status(201).json({ success: true, data: creator })
})

// POST /api/creators/:id/upload/start
router.post('/:id/upload/start', (req: Request, res: Response) => {
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  const { filename, mimeType, fileSize } = req.body as {
    filename?: string
    mimeType?: string
    fileSize?: number
  }
  if (!filename || !mimeType || !fileSize) {
    return res.status(400).json({ success: false, error: 'filename, mimeType, and fileSize are required' })
  }
  const session = createUploadSession(creator.id, filename, mimeType, Number(fileSize))
  res.status(201).json({ success: true, data: session })
})

// POST /api/creators/:id/upload/:sessionId/chunk
router.post('/:id/upload/:sessionId/chunk', (req: Request, res: Response) => {
  const session = getUploadSession(req.params.sessionId)
  if (!session) return res.status(404).json({ success: false, error: 'Upload session not found' })
  if (session.creatorId !== req.params.id) {
    return res.status(403).json({ success: false, error: 'Session does not belong to this creator' })
  }
  const { chunkIndex } = req.query
  const index = chunkIndex ? Number(chunkIndex) : 0
  // req.body will be a Buffer if content-type is application/octet-stream
  const data: Buffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body))
  receiveChunk(req.params.sessionId, index, data)
  res.json({ success: true, data: { uploadedBytes: session.uploadedBytes } })
})

// POST /api/creators/:id/upload/:sessionId/complete
router.post('/:id/upload/:sessionId/complete', (req: Request, res: Response) => {
  const session = getUploadSession(req.params.sessionId)
  if (!session) return res.status(404).json({ success: false, error: 'Upload session not found' })
  if (session.creatorId !== req.params.id) {
    return res.status(403).json({ success: false, error: 'Session does not belong to this creator' })
  }
  try {
    const updated = completeUpload(req.params.sessionId)
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

// GET /api/creators/:id/uploads
router.get('/:id/uploads', (req: Request, res: Response) => {
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  res.json({ success: true, data: listUploadSessionsByCreator(creator.id) })
})

// POST /api/creators/:id/products — publish product after upload
router.post('/:id/products', (req: Request, res: Response) => {
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })

  const {
    name, description, category, tags, price,
    fileSize, fileUrl, previewUrl, coverUrl,
    bpm, key, sampleCount, featured,
  } = req.body as {
    name?: string
    description?: string
    category?: ProductCategory
    tags?: string[]
    price?: number
    fileSize?: number
    fileUrl?: string
    previewUrl?: string
    coverUrl?: string
    bpm?: number
    key?: string
    sampleCount?: number
    featured?: boolean
  }

  if (!name || !description || !category) {
    return res.status(400).json({ success: false, error: 'name, description, and category are required' })
  }

  const product = createProduct({
    name,
    description,
    category,
    tags: tags ?? [],
    creatorId: creator.id,
    creatorName: creator.displayName,
    price: price ?? 0,
    currency: 'USD',
    fileSize: fileSize ?? 0,
    fileUrl: fileUrl ?? '',
    previewUrl: previewUrl ?? '',
    coverUrl: coverUrl ?? '',
    bpm,
    key,
    sampleCount,
    status: 'pending' as ProductStatus,
    featured: featured ?? false,
  })

  res.status(201).json({ success: true, data: product })
})

// POST /api/creators/:id/payout
router.post('/:id/payout', (req: Request, res: Response) => {
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  const result = requestPayout(creator.id)
  if (!result) {
    return res.status(400).json({ success: false, error: 'No balance available for payout' })
  }
  res.json({ success: true, data: result })
})

export default router
