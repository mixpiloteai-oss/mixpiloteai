// ============================================================
// NEUROTEK AI — AI Recommendation Service (rule-based)
// ============================================================
import {
  type MarketProduct,
  type ProductCategory,
  getProducts,
  getProduct,
} from './marketplaceService'

interface RecommendationOpts {
  userId: string
  downloadHistory: string[]     // product IDs already downloaded
  likedCategories: ProductCategory[]
  limit: number
}

export function getRecommendations(opts: RecommendationOpts): MarketProduct[] {
  const { downloadHistory, likedCategories, limit } = opts
  const downloadedSet = new Set(downloadHistory)

  const { products: allProducts } = getProducts({ sort: 'trending', page: 1, limit: 200 })

  // Collect all tags from liked categories to infer creator preferences
  const likedCategorySet = new Set(likedCategories)

  const scored = allProducts
    .filter((p) => !downloadedSet.has(p.id))
    .map((p) => {
      let score = 0

      // Category match: 2 pts per matched liked category
      if (likedCategorySet.has(p.category)) score += 2

      // Tag overlap: 1 pt per matching tag against tags from liked products
      // We proxy this by scoring against all downloaded products' categories
      // (in a real system we'd have the actual liked-product objects)
      score += p.tags.length > 5 ? 1 : 0

      // Trending bonus
      score += p.trendingScore / 1000

      // Featured bonus
      if (p.featured) score += 1

      // Free bonus (slight preference for free content)
      if (p.price === 0) score += 0.5

      return { product: p, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => product)

  return scored
}

export function getSimilar(productId: string, limit = 6): MarketProduct[] {
  const source = getProduct(productId)
  if (!source) return []

  const { products: allProducts } = getProducts({ sort: 'popular', page: 1, limit: 200 })
  const sourceTagSet = new Set(source.tags)

  const scored = allProducts
    .filter((p) => p.id !== productId)
    .map((p) => {
      let score = 0

      // Same category: strong match
      if (p.category === source.category) score += 4

      // Tag overlap: 1 pt per shared tag
      for (const tag of p.tags) {
        if (sourceTagSet.has(tag)) score += 1
      }

      // Same creator bonus
      if (p.creatorId === source.creatorId) score += 1

      // Similar BPM
      if (source.bpm && p.bpm && Math.abs(source.bpm - p.bpm) <= 10) score += 1

      // Trending bonus
      score += p.trendingScore / 2000

      return { product: p, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => product)

  return scored
}
