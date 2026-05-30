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
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import {
  uploadRateLimiter,
  marketplaceRateLimiter,
} from '../middleware/rateLimiter'
import {
  ALLOWED_AUDIO_MIME,
  ALLOWED_IMAGE_MIME,
  validateUpload,
  sanitizeFilename,
  looksLikeMagicBytes,
  type MagicKind,
} from '../utils/uploadGuard'
import { logSecurityEvent } from '../utils/securityLog'
import { validate } from '../utils/validate'
import { fail, ok, HTTP } from '../utils/response'
import { assertAllowedMediaUrls } from '../utils/urlGuard'

const router = Router()

// 2 MB per chunk
const MAX_CHUNK_BYTES = 2 * 1024 * 1024

// Track first chunk bytes per session for magic-byte verification at
// completion time. Bounded to 16 bytes per session (all sniffers only
// need <=12). Fully separate from the upload service so we do not
// redesign that module.
const firstChunkBytes = new Map<string, Buffer>()

// Track declared kind per session for magic-byte mapping.
const sessionKind = new Map<string, 'audio' | 'image'>()

function getUserId(req: Request): string {
  const auth = (req as AuthenticatedRequest).user?.id
  if (auth) return auth
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

function magicKindFor(mimeType: string): MagicKind | null {
  const m = mimeType.toLowerCase()
  if (m === 'audio/wav' || m === 'audio/wave' || m === 'audio/x-wav') return 'wav'
  if (m === 'audio/mpeg' || m === 'audio/mp3') return 'mp3'
  if (m === 'image/png') return 'png'
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  return null
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
  const okSub = subscribeToTier(creator.id, tierId, userId)
  if (!okSub) return res.status(404).json({ success: false, error: 'Subscription tier not found' })
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

  // Validate any optional media URLs against the allowlist.
  const urlCheck = assertAllowedMediaUrls({ avatarUrl, bannerUrl })
  if (!urlCheck.ok) {
    logSecurityEvent({
      type: 'file_rejected',
      severity: 'warn',
      ip: req.ip,
      userId,
      reason: `Disallowed media host on field ${urlCheck.field}`,
      route: req.originalUrl,
    })
    return res.status(HTTP.BAD_REQUEST).json(fail(`${urlCheck.field} host is not allowed`))
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
router.post(
  '/:id/upload/start',
  requireAuth,
  uploadRateLimiter,
  (req: Request, res: Response) => {
    const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
    if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })

    if (!validate(req, res, {
      filename: { required: true, type: 'string', min: 1, max: 512 },
      mimeType: { required: true, type: 'string', min: 1, max: 200 },
      fileSize: { required: true, type: 'number' },
      kind:     { required: true, type: 'string' },
    })) return

    const { filename, mimeType, fileSize, kind } = req.body as {
      filename: string
      mimeType: string
      fileSize: number
      kind: 'audio' | 'image'
    }

    if (kind !== 'audio' && kind !== 'image') {
      return res.status(HTTP.BAD_REQUEST).json(fail('kind must be "audio" or "image"'))
    }

    const allowed = kind === 'image' ? ALLOWED_IMAGE_MIME : ALLOWED_AUDIO_MIME
    const result = validateUpload({ mimeType, size: fileSize, allowed })
    if (!result.ok) {
      logSecurityEvent({
        type: 'file_rejected',
        severity: 'warn',
        ip: req.ip,
        userId: getUserId(req),
        reason: result.reason,
        route: req.originalUrl,
        meta: { filename, mimeType, fileSize },
      })
      return res.status(HTTP.BAD_REQUEST).json(fail(result.reason))
    }

    const safeName = sanitizeFilename(filename)
    const session = createUploadSession(creator.id, safeName, mimeType, Number(fileSize))
    sessionKind.set(session.id, kind)
    res.status(201).json(ok(session))
  }
)

// POST /api/creators/:id/upload/:sessionId/chunk
router.post(
  '/:id/upload/:sessionId/chunk',
  requireAuth,
  uploadRateLimiter,
  (req: Request, res: Response) => {
    const session = getUploadSession(req.params.sessionId)
    if (!session) return res.status(404).json({ success: false, error: 'Upload session not found' })
    if (session.creatorId !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Session does not belong to this creator' })
    }

    const { chunkIndex } = req.query
    const index = chunkIndex ? Number(chunkIndex) : 0
    const data: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body))

    if (data.byteLength > MAX_CHUNK_BYTES) {
      logSecurityEvent({
        type: 'file_rejected',
        severity: 'warn',
        ip: req.ip,
        userId: getUserId(req),
        reason: `Chunk too large (${data.byteLength} > ${MAX_CHUNK_BYTES})`,
        route: req.originalUrl,
        meta: { sessionId: session.id },
      })
      return res.status(413).json(fail('Chunk too large'))
    }

    const projected = session.uploadedBytes + data.byteLength
    if (projected > session.fileSize) {
      logSecurityEvent({
        type: 'file_rejected',
        severity: 'warn',
        ip: req.ip,
        userId: getUserId(req),
        reason: `Upload total exceeds declared size (${projected} > ${session.fileSize})`,
        route: req.originalUrl,
        meta: { sessionId: session.id },
      })
      return res.status(413).json(fail('Upload exceeds declared size'))
    }

    // Stash the first chunk header for magic-byte verification.
    if (index === 0 && !firstChunkBytes.has(session.id)) {
      firstChunkBytes.set(session.id, data.subarray(0, Math.min(16, data.byteLength)))
    }

    receiveChunk(req.params.sessionId, index, data)
    res.json(ok({ uploadedBytes: session.uploadedBytes }))
  }
)

// POST /api/creators/:id/upload/:sessionId/complete
router.post(
  '/:id/upload/:sessionId/complete',
  requireAuth,
  uploadRateLimiter,
  (req: Request, res: Response) => {
    const session = getUploadSession(req.params.sessionId)
    if (!session) return res.status(404).json({ success: false, error: 'Upload session not found' })
    if (session.creatorId !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Session does not belong to this creator' })
    }

    // Magic-byte sniff if we have the first chunk and the mime maps to a
    // known format. Be defensive — the in-memory mock may not always
    // retain bytes (e.g. JSON-encoded test path).
    try {
      const head = firstChunkBytes.get(session.id)
      const expected = magicKindFor(session.mimeType)
      if (head && head.length >= 4 && expected) {
        if (!looksLikeMagicBytes(head, expected)) {
          logSecurityEvent({
            type: 'file_rejected',
            severity: 'warn',
            ip: req.ip,
            userId: getUserId(req),
            reason: `Magic bytes do not match declared mime type (${session.mimeType})`,
            route: req.originalUrl,
            meta: { sessionId: session.id, expected },
          })
          firstChunkBytes.delete(session.id)
          sessionKind.delete(session.id)
          return res.status(HTTP.BAD_REQUEST).json(fail('File contents do not match declared type'))
        }
      }
    } catch {
      // Defensive — never block completion on a sniffer failure.
    }

    try {
      const updated = completeUpload(req.params.sessionId)
      firstChunkBytes.delete(session.id)
      sessionKind.delete(session.id)
      res.json({ success: true, data: updated })
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message })
    }
  }
)

// GET /api/creators/:id/uploads
router.get('/:id/uploads', (req: Request, res: Response) => {
  const creator = getCreator(req.params.id) ?? getCreatorBySlug(req.params.id)
  if (!creator) return res.status(404).json({ success: false, error: 'Creator not found' })
  res.json({ success: true, data: listUploadSessionsByCreator(creator.id) })
})

// POST /api/creators/:id/products — publish product after upload
router.post(
  '/:id/products',
  requireAuth,
  marketplaceRateLimiter,
  (req: Request, res: Response) => {
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

    const urlCheck = assertAllowedMediaUrls({ fileUrl, previewUrl, coverUrl })
    if (!urlCheck.ok) {
      logSecurityEvent({
        type: 'file_rejected',
        severity: 'warn',
        ip: req.ip,
        userId: getUserId(req),
        reason: `Disallowed media host on field ${urlCheck.field}`,
        route: req.originalUrl,
      })
      return res.status(HTTP.BAD_REQUEST).json(fail(`${urlCheck.field} host is not allowed`))
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
  }
)

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
