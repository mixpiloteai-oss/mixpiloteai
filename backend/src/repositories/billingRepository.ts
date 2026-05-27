// ── Billing Repository ─────────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

export interface BillingHistoryRow {
  id?: string
  user_id: string
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'refunded' | 'pending'
  provider: 'stripe' | 'paypal' | 'manual'
  provider_payment_id?: string | null
  description: string
  plan?: string | null
  metadata?: Record<string, unknown>
}

export const billingRepository = {
  async insert(row: BillingHistoryRow): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('billing_history')
        .insert([{ id: uuidv4(), ...row }]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'billingRepo.insert'
    )
  },

  async listByUser(userId: string, limit = 50): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { data } = await supabase.from('billing_history').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
    return data ?? []
  },

  async listAll(opts: { limit?: number; offset?: number; status?: string } = {}): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    let q = supabase.from('billing_history').select('*')
    if (opts.status) q = q.eq('status', opts.status)
    const { data } = await q.order('created_at', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1)
    return data ?? []
  },

  async updateStatus(id: string, status: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('billing_history').update({ status }).eq('id', id) as unknown as
        { data: null; error: { message: string; code?: string } | null },
      'billingRepo.updateStatus'
    )
  },

  async totalRevenue(opts: { currency?: string; provider?: string } = {}): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    let q = supabase.from('billing_history').select('amount').eq('status', 'succeeded')
    if (opts.currency) q = q.eq('currency', opts.currency)
    if (opts.provider) q = q.eq('provider', opts.provider)
    const { data } = await q
    return (data as any[] ?? []).reduce((sum: number, r: any) => sum + (r.amount ?? 0), 0)
  },
}
