// ============================================================
// NEUROTEK AI — Marketplace Routes
// ============================================================
import { Router, Request, Response } from 'express'
import {
  getProducts,
  getProduct,
  getFeatured,
  getTrending,
  toggleLike,
  recordDownload,
  addComment,
  getComments,
  type ProductCategory,
} from '../services/marketplaceService'
import { getRecommendations, getSimilar } from '../services/aiRecommendationService'
import { recordSale } from '../services/creatorService'

const router = Router()

function getUserId(req: Request): string {
  const header = req.headers['x-user-id']
  if (typeof header === 'string' && header.trim()) return header.trim()
  return 'anonymous'
}

// GET /api/marketplace/products
router.get('/products', (req: Request, res: Response) => {
  const { category, tags, search, sort, page, limit } = req.query
  const result = getProducts({
    category: category as ProductCategory | undefined,
    tags: tags as string | undefined,
    search: search as string | undefined,
    sort: sort as 'trending' | 'newest' | 'popular' | 'price-asc' | 'price-desc' | 'free' | undefined,
    page: page ? Number(page) : 1,
    limit: limit ? Math.min(Number(limit), 100) : 20,
  })
  res.json({ success: true, data: result })
})

// GET /api/marketplace/products/featured
router.get('/products/featured', (_req: Request, res: Response) => {
  res.json({ success: true, data: getFeatured() })
})

// GET /api/marketplace/products/trending
router.get('/products/trending', (req: Request, res: Response) => {
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 10
  res.json({ success: true, data: getTrending(limit) })
})

// GET /api/marketplace/products/:id
router.get('/products/:id', (req: Request, res: Response) => {
  const product = getProduct(req.params.id)
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' })
  res.json({ success: true, data: product })
})

// GET /api/marketplace/products/:id/comments
router.get('/products/:id/comments', (req: Request, res: Response) => {
  const product = getProduct(req.params.id)
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' })
  res.json({ success: true, data: getComments(req.params.id) })
})

// POST /api/marketplace/products/:id/like
router.post('/products/:id/like', (req: Request, res: Response) => {
  const userId = getUserId(req)
  const product = getProduct(req.params.id)
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' })
  const result = toggleLike(req.params.id, userId)
  res.json({ success: true, data: result })
})

// POST /api/marketplace/products/:id/download
router.post('/products/:id/download', (req: Request, res: Response) => {
  const userId = getUserId(req)
  const product = getProduct(req.params.id)
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' })
  recordDownload(req.params.id, userId)
  res.json({ success: true, message: 'Download recorded', data: { fileUrl: product.fileUrl } })
})

// POST /api/marketplace/products/:id/comment
router.post('/products/:id/comment', (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { text, rating, userName } = req.body as { text?: string; rating?: number; userName?: string }
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ success: false, error: 'text is required' })
  }
  const ratingNum = Number(rating)
  if (!rating || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ success: false, error: 'rating must be between 1 and 5' })
  }
  const product = getProduct(req.params.id)
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' })
  const comment = addComment(
    req.params.id,
    userId,
    typeof userName === 'string' ? userName : userId,
    text,
    ratingNum
  )
  res.status(201).json({ success: true, data: comment })
})

// POST /api/marketplace/products/:id/purchase
router.post('/products/:id/purchase', (req: Request, res: Response) => {
  const product = getProduct(req.params.id)
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' })
  const { buyerId } = req.body as { buyerId?: string }
  if (!buyerId) return res.status(400).json({ success: false, error: 'buyerId is required' })
  if (product.price === 0) {
    recordDownload(product.id, buyerId)
    return res.json({ success: true, message: 'Free product — download recorded', data: { fileUrl: product.fileUrl } })
  }
  const sale = recordSale(product.id, product.name, product.creatorId, buyerId, product.price)
  recordDownload(product.id, buyerId)
  res.json({ success: true, data: sale })
})

// GET /api/marketplace/recommendations
router.get('/recommendations', (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { downloadHistory, likedCategories, limit } = req.query
  const history = typeof downloadHistory === 'string'
    ? downloadHistory.split(',').filter(Boolean)
    : []
  const categories = typeof likedCategories === 'string'
    ? (likedCategories.split(',').filter(Boolean) as ProductCategory[])
    : []
  const count = limit ? Math.min(Number(limit), 50) : 10

  const results = getRecommendations({
    userId,
    downloadHistory: history,
    likedCategories: categories,
    limit: count,
  })
  res.json({ success: true, data: results })
})

// GET /api/marketplace/similar/:id
router.get('/similar/:id', (req: Request, res: Response) => {
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 20) : 6
  const results = getSimilar(req.params.id, limit)
  res.json({ success: true, data: results })
})

// GET /api/marketplace/search
router.get('/search', (req: Request, res: Response) => {
  const { q, page, limit } = req.query
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ success: false, error: 'q query parameter is required' })
  }
  const result = getProducts({
    search: q,
    sort: 'popular',
    page: page ? Number(page) : 1,
    limit: limit ? Math.min(Number(limit), 100) : 20,
  })
  res.json({ success: true, data: result })
})

export default router
