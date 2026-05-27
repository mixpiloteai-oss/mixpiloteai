import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export interface UserRow {
  id: string
  email: string
  name: string
  password_hash: string
  plan: 'free' | 'pro' | 'studio'
  refresh_token: string | null
  created_at: string
  banned?: boolean
  ban_reason?: string | null
}

export interface SubscriptionRow {
  id: string
  user_id: string
  plan: string
  status: 'active' | 'cancelled' | 'expired'
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: UserRow | null; error: { message: string; code?: string } | null }
    }, 'userRepo.findByEmail')
  },

  async findById(id: string): Promise<UserRow | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: UserRow | null; error: { message: string; code?: string } | null }
    }, 'userRepo.findById')
  },

  async create(data: { email: string; name: string; password: string; plan?: string }): Promise<UserRow> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const id = uuidv4()
    const passwordHash = await bcrypt.hash(data.password, 10)
    const row = await withRetry(async () =>
      supabase!.from('users').insert([{
        id,
        email: data.email.toLowerCase().trim(),
        name:  data.name,
        password_hash: passwordHash,
        plan:  data.plan ?? 'free',
      }]).select().single() as unknown as { data: UserRow | null; error: { message: string; code?: string } | null },
      'userRepo.create'
    )
    // Create matching subscription
    await supabase!.from('subscriptions').insert([{
      id:      uuidv4(),
      user_id: id,
      plan:    data.plan ?? 'free',
      status:  'active',
    }])
    return row
  },

  async updateRefreshToken(userId: string, token: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('users').update({ refresh_token: token }).eq('id', userId) as unknown as { data: null; error: { message: string; code?: string } | null },
      'userRepo.updateRefreshToken'
    )
  },

  async updatePlan(userId: string, plan: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('users').update({ plan }).eq('id', userId) as unknown as { data: null; error: { message: string; code?: string } | null },
      'userRepo.updatePlan'
    )
  },

  async getTodayUsage(userId: string): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const today = new Date().toISOString().slice(0, 10)
    const result = await supabase!
      .from('usage_log')
      .select('count')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    if (result.error || !result.data) return 0
    return (result.data as { count: number }).count
  },

  async incrementUsage(userId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const today = new Date().toISOString().slice(0, 10)
    await withRetry(async () =>
      supabase!.rpc('increment_usage', { p_user_id: userId, p_date: today }) as unknown as { data: null; error: { message: string; code?: string } | null },
      'userRepo.incrementUsage'
    )
  },

  async getSubscription(userId: string): Promise<SubscriptionRow | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: SubscriptionRow | null; error: { message: string; code?: string } | null }
    }, 'userRepo.getSubscription')
  },

  async upsertSubscription(data: Partial<SubscriptionRow> & { user_id: string; plan: string }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('subscriptions').upsert([{
        id: data.id ?? uuidv4(),
        ...data,
        updated_at: new Date().toISOString(),
      }]) as unknown as { data: null; error: { message: string; code?: string } | null },
      'userRepo.upsertSubscription'
    )
  },

  async list(opts: { limit?: number; offset?: number } = {}): Promise<UserRow[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('users').select('*')
        .order('created_at', { ascending: false })
        .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1) as unknown as { data: UserRow[] | null; error: { message: string; code?: string } | null },
      'userRepo.list'
    ) as Promise<UserRow[]>
  },
}
