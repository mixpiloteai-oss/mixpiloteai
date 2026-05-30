// ── Team Repository ────────────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

export const teamRepository = {
  // ── Teams ──────────────────────────────────────────────────────────
  async create(data: { name: string; owner_id: string }): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('teams').insert([{ id: uuidv4(), ...data }]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'teamRepo.create'
    )
  },

  async findById(id: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!.from('teams').select('*').eq('id', id).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: any | null; error: { message: string; code?: string } | null }
    }, 'teamRepo.findById')
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await supabase!.from('teams').delete().eq('id', id)
  },

  async listByUser(userId: string): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { data } = await supabase.from('team_members').select('team_id').eq('user_id', userId)
    if (!data?.length) return []
    const teamIds = (data as any[]).map(r => r.team_id)
    const { data: teams } = await supabase.from('teams').select('*').in('id', teamIds)
    return teams ?? []
  },

  // ── Members ──────────────────────────────────────────────────────
  async addMember(member: {
    team_id: string; user_id: string; user_name: string; email: string; role: string
  }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('team_members').upsert([member]) as unknown as
        { data: null; error: { message: string; code?: string } | null },
      'teamRepo.addMember'
    )
  },

  async removeMember(teamId: string, userId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId)
  },

  async updateMemberRole(teamId: string, userId: string, role: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await supabase.from('team_members').update({ role }).eq('team_id', teamId).eq('user_id', userId)
  },

  async getMembers(teamId: string): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { data } = await supabase.from('team_members').select('*').eq('team_id', teamId)
    return data ?? []
  },

  async getMember(teamId: string, userId: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) return null
    const { data } = await supabase.from('team_members').select('*')
      .eq('team_id', teamId).eq('user_id', userId).single()
    return data ?? null
  },

  // ── Invitations ──────────────────────────────────────────────────
  async createInvitation(inv: {
    team_id: string; email: string; role: string
    invited_by: string; token: string; expires_at: string
  }): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('team_invitations').insert([{ id: uuidv4(), ...inv }]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'teamRepo.createInvitation'
    )
  },

  async findInvitationByToken(token: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!.from('team_invitations').select('*').eq('token', token).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: any | null; error: { message: string; code?: string } | null }
    }, 'teamRepo.findInvitationByToken')
  },

  async acceptInvitation(token: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await supabase.from('team_invitations').update({ accepted: true }).eq('token', token)
  },

  async deleteExpiredInvitations(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    await supabase.from('team_invitations')
      .delete().lt('expires_at', new Date().toISOString()).eq('accepted', false)
  },

  // ── Project Permissions ──────────────────────────────────────────
  async setProjectPermissions(data: {
    project_id: string; team_id: string; member_permissions: Record<string, string>
  }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    await withRetry(async () =>
      supabase!.from('project_permissions').upsert([data]) as unknown as
        { data: null; error: { message: string; code?: string } | null },
      'teamRepo.setProjectPermissions'
    )
  },

  async getProjectPermissions(projectId: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) return null
    const { data } = await supabase.from('project_permissions').select('*')
      .eq('project_id', projectId).single()
    return data ?? null
  },

  async deleteProjectPermissions(projectId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    await supabase.from('project_permissions').delete().eq('project_id', projectId)
  },
}
