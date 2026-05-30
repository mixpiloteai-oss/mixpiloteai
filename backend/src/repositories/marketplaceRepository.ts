// ── Marketplace Repository ─────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

export const marketplaceRepository = {
  async list(filters: {
    category?: string
    search?: string
    status?: string
    sortBy?: string
    limit?: number
    offset?: number
    featuredOnly?: boolean
    freeOnly?: boolean
  } = {}): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    let q = supabase.from('marketplace_products').select('*')
    if (filters.category)    q = q.eq('category', filters.category)
    if (filters.status)      q = q.eq('status', filters.status)
    if (filters.featuredOnly) q = q.eq('featured', true)
    if (filters.freeOnly)    q = q.eq('price', 0)
    if (filters.search)      q = q.ilike('name', `%${filters.search}%`)
    const col =
      filters.sortBy === 'trending'  ? 'trending_score' :
      filters.sortBy === 'downloads' ? 'downloads' :
      filters.sortBy === 'likes'     ? 'likes' :
                                       'created_at'
    q = q.order(col, { ascending: false })
         .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async findById(id: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!.from('marketplace_products').select('*').eq('id', id).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: any | null; error: { message: string; code?: string } | null }
    }, 'marketRepo.findById')
  },

  async findBySlug(slug: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!.from('marketplace_products').select('*').eq('slug', slug).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: any | null; error: { message: string; code?: string } | null }
    }, 'marketRepo.findBySlug')
  },

  async upsert(product: Record<string, unknown>): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('marketplace_products').upsert([product]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'marketRepo.upsert'
    )
  },

  async updateStatus(id: string, status: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('marketplace_products').update({ status, updated_at: new Date().toISOString() })
        .eq('id', id) as unknown as { data: null; error: { message: string; code?: string } | null },
      'marketRepo.updateStatus'
    )
  },

  async incrementDownloads(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    // Read-modify-write (acceptable for non-critical counters)
    const { data } = await supabase.from('marketplace_products').select('downloads').eq('id', id).single()
    if (data) {
      await supabase.from('marketplace_products')
        .update({ downloads: ((data as any).downloads ?? 0) + 1 })
        .eq('id', id)
    }
  },

  async hasLiked(productId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false
    const { data } = await supabase.from('marketplace_likes')
      .select('user_id').eq('product_id', productId).eq('user_id', userId).single()
    return !!data
  },

  async toggleLike(productId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const already = await this.hasLiked(productId, userId)
    if (already) {
      await supabase.from('marketplace_likes').delete().eq('product_id', productId).eq('user_id', userId)
    } else {
      await supabase.from('marketplace_likes').insert([{ product_id: productId, user_id: userId }])
    }
    const { count } = await supabase.from('marketplace_likes')
      .select('*', { count: 'exact', head: true }).eq('product_id', productId)
    const totalLikes = count ?? 0
    await supabase.from('marketplace_products').update({ likes: totalLikes }).eq('id', productId)
    return { liked: !already, totalLikes }
  },

  async addComment(comment: {
    product_id: string; user_id: string; user_name: string; text: string; rating: number
  }): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { data, error } = await supabase.from('marketplace_comments')
      .insert([{ id: uuidv4(), ...comment }]).select().single()
    if (error) throw new Error(error.message)
    // Increment comment count
    const { data: p } = await supabase.from('marketplace_products')
      .select('comment_count').eq('id', comment.product_id).single()
    if (p) {
      await supabase.from('marketplace_products')
        .update({ comment_count: ((p as any).comment_count ?? 0) + 1 })
        .eq('id', comment.product_id)
    }
    return data
  },

  async getComments(productId: string, limit = 20): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { data, error } = await supabase.from('marketplace_comments').select('*')
      .eq('product_id', productId).order('created_at', { ascending: false }).limit(limit)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async count(): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const { count } = await supabase.from('marketplace_products')
      .select('*', { count: 'exact', head: true }).eq('status', 'approved')
    return count ?? 0
  },
}
