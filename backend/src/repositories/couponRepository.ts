// ── Coupon Repository ──────────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

export const couponRepository = {
  async findByCode(code: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!.from('coupons').select('*')
        .eq('code', code.toUpperCase()).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: any | null; error: { message: string; code?: string } | null }
    }, 'couponRepo.findByCode')
  },

  async create(coupon: Record<string, unknown>): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('coupons')
        .insert([{ id: uuidv4(), ...coupon }]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'couponRepo.create'
    )
  },

  async update(code: string, patch: Record<string, unknown>): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await supabase.from('coupons').update(patch).eq('code', code.toUpperCase())
  },

  async incrementUsed(code: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { data } = await supabase.from('coupons').select('used_count').eq('code', code.toUpperCase()).single()
    if (data) {
      await supabase.from('coupons')
        .update({ used_count: ((data as any).used_count ?? 0) + 1 })
        .eq('code', code.toUpperCase())
    }
  },

  async hasUserRedeemed(code: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false
    const { data } = await supabase.from('coupon_redemptions')
      .select('coupon_code').eq('coupon_code', code.toUpperCase()).eq('user_id', userId).single()
    return !!data
  },

  async recordRedemption(code: string, userId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { error } = await supabase.from('coupon_redemptions')
      .insert([{ coupon_code: code.toUpperCase(), user_id: userId }])
    if (error && error.code !== '23505') throw new Error(error.message) // ignore duplicate
  },

  async list(): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { data } = await supabase.from('coupons').select('*')
      .order('created_at', { ascending: false })
    return data ?? []
  },

  async count(): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const { count } = await supabase.from('coupons').select('*', { count: 'exact', head: true })
    return count ?? 0
  },
}
