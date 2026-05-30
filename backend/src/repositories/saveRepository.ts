import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'

export interface VersionRow {
  id: string
  project_id: string
  label: string
  type: 'manual' | 'auto' | 'pre-action'
  size_bytes: number
  checksum: string
  data: unknown
  created_at: string
}

export const saveRepository = {
  async insert(row: VersionRow): Promise<void> {
    // When Supabase is not configured, silently skip DB write.
    // saveService keeps the version in its in-memory cache.
    if (!isSupabaseConfigured || !supabase) return
    await withRetry(async () =>
      supabase!.from('project_versions').insert([row]) as unknown as { data: null; error: { message: string; code?: string } | null },
      'saveRepo.insert'
    )
  },

  async listMeta(projectId: string, limit = 50): Promise<Omit<VersionRow, 'data'>[]> {
    if (!isSupabaseConfigured || !supabase) return []
    return withRetry(async () =>
      supabase!.from('project_versions')
        .select('id,project_id,label,type,size_bytes,checksum,created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit) as unknown as { data: Omit<VersionRow, 'data'>[] | null; error: { message: string; code?: string } | null },
      'saveRepo.listMeta'
    ) as Promise<Omit<VersionRow, 'data'>[]>
  },

  async getWithData(id: string): Promise<VersionRow | null> {
    if (!isSupabaseConfigured || !supabase) return null
    return withRetry(async () => {
      const result = await supabase!.from('project_versions').select('*').eq('id', id).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: VersionRow | null; error: { message: string; code?: string } | null }
    }, 'saveRepo.getWithData')
  },

  async deleteOldest(projectId: string, keepCount: number): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    // Get IDs of entries to delete (beyond keepCount)
    const { data } = await supabase!.from('project_versions')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(keepCount, 9999)
    if (!data?.length) return
    const ids = (data as { id: string }[]).map(r => r.id)
    await supabase!.from('project_versions').delete().in('id', ids)
  },
}
