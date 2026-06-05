// ── Admin Repository ───────────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

export const adminRepository = {
  // ── Support Tickets ───────────────────────────────────────────────
  async createTicket(ticket: {
    user_id: string; user_email: string; user_name: string
    subject: string; body: string
    category?: string; priority?: string
  }): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('support_tickets').insert([{ id: uuidv4(), ...ticket }]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'adminRepo.createTicket'
    )
  },

  async getTicket(id: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!.from('support_tickets').select('*').eq('id', id).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: any | null; error: { message: string; code?: string } | null }
    }, 'adminRepo.getTicket')
  },

  async listTickets(filters: {
    status?: string; priority?: string; category?: string; limit?: number; offset?: number
  } = {}): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    let q = supabase.from('support_tickets').select('*')
    if (filters.status)   q = q.eq('status', filters.status)
    if (filters.priority) q = q.eq('priority', filters.priority)
    if (filters.category) q = q.eq('category', filters.category)
    const { data } = await q.order('created_at', { ascending: false })
      .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 100) - 1)
    return data ?? []
  },

  async updateTicket(id: string, patch: Record<string, unknown>): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('support_tickets')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'adminRepo.updateTicket'
    )
  },

  async addTicketMessage(ticketId: string, msg: {
    author: string; text: string; is_admin: boolean
  }): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('ticket_messages')
        .insert([{ id: uuidv4(), ticket_id: ticketId, ...msg }]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'adminRepo.addTicketMessage'
    )
  },

  async getTicketMessages(ticketId: string): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data } = await supabase.from('ticket_messages').select('*')
      .eq('ticket_id', ticketId).order('created_at', { ascending: true })
    return data ?? []
  },

  // ── Admin Logs ────────────────────────────────────────────────────
  async insertLog(log: {
    admin_id: string; admin_email: string; action: string
    target?: string; details?: Record<string, unknown>; ip_address?: string
  }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    try { await supabase.from('admin_logs').insert([log]) } catch { /* fire-and-forget */ }
  },

  async listLogs(opts: { limit?: number; adminId?: string } = {}): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return []
    let q = supabase.from('admin_logs').select('*')
    if (opts.adminId) q = q.eq('admin_id', opts.adminId)
    const { data } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 100)
    return data ?? []
  },

  // ── User Bans ─────────────────────────────────────────────────────
  async banUser(userId: string, reason: string, bannedBy: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('users').update({
        banned:     true,
        ban_reason: reason,
        banned_at:  new Date().toISOString(),
        banned_by:  bannedBy,
      }).eq('id', userId) as unknown as
        { data: null; error: { message: string; code?: string } | null },
      'adminRepo.banUser'
    )
  },

  async unbanUser(userId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('users').update({
        banned:     false,
        ban_reason: null,
        banned_at:  null,
        banned_by:  null,
      }).eq('id', userId) as unknown as
        { data: null; error: { message: string; code?: string } | null },
      'adminRepo.unbanUser'
    )
  },

  async listBannedUsers(): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data } = await supabase.from('users').select('*').eq('banned', true)
    return data ?? []
  },

  // ── Stats ─────────────────────────────────────────────────────────
  async countUsers(): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true })
    return count ?? 0
  },

  async countActiveSubscriptions(): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const { count } = await supabase.from('subscriptions')
      .select('*', { count: 'exact', head: true }).eq('status', 'active')
    return count ?? 0
  },
}
