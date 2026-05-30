// ── Pack Repository ────────────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

export const packRepository = {
  async list(filters: {
    type?: string; genre?: string; search?: string
    freeOnly?: boolean; sort?: string
  } = {}): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    let q = supabase.from('packs').select('*')
    if (filters.type)    q = q.eq('type', filters.type)
    if (filters.genre)   q = q.eq('genre', filters.genre)
    if (filters.freeOnly) q = q.eq('is_free', true)
    if (filters.search)  q = q.ilike('name', `%${filters.search}%`)
    const col =
      filters.sort === 'newest'    ? 'created_at' :
      filters.sort === 'top-rated' ? 'rating' :
                                     'downloads'
    const { data, error } = await q.order(col, { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async findById(id: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!.from('packs').select('*').eq('id', id).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: any | null; error: { message: string; code?: string } | null }
    }, 'packRepo.findById')
  },

  async upsert(pack: Record<string, unknown>): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('packs').upsert([pack]) as unknown as
        { data: null; error: { message: string; code?: string } | null },
      'packRepo.upsert'
    )
  },

  async incrementDownloads(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { data } = await supabase.from('packs').select('downloads').eq('id', id).single()
    if (data) {
      await supabase.from('packs').update({ downloads: ((data as any).downloads ?? 0) + 1 }).eq('id', id)
    }
  },

  async updateRating(id: string, rating: number, ratingCount: number): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    await supabase.from('packs').update({ rating, rating_count: ratingCount }).eq('id', id)
  },

  async addComment(packId: string, comment: {
    user_id: string; user_name: string; content: string
  }): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { data, error } = await supabase.from('pack_comments')
      .insert([{ id: uuidv4(), pack_id: packId, ...comment }]).select().single()
    if (error) throw new Error(error.message)
    return data
  },

  async getComments(packId: string): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data } = await supabase.from('pack_comments').select('*')
      .eq('pack_id', packId).order('created_at', { ascending: false })
    return data ?? []
  },

  async count(): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const { count } = await supabase.from('packs').select('*', { count: 'exact', head: true })
    return count ?? 0
  },
}
