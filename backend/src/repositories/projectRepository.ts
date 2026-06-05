import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

export interface ProjectRow {
  id: string
  user_id: string
  name: string
  genre: string
  bpm: number
  key: string
  mood: string
  tracks: unknown[]
  duration: number
  is_starred: boolean
  cover_color: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface TemplateRow {
  id: string
  name: string
  genre: string
  bpm: number
  mood: string
  description: string
  tracks: unknown[]
  ai_confidence: number
  generated_at: string
}

export const projectRepository = {
  async findById(id: string): Promise<ProjectRow | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () => {
      const result = await supabase!.from('projects').select('*').eq('id', id).single()
      if (result.error?.code === 'PGRST116') return { data: null, error: null }
      return result as { data: ProjectRow | null; error: { message: string; code?: string } | null }
    }, 'projectRepo.findById')
  },

  async listByUser(userId: string): Promise<ProjectRow[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('projects').select('*').eq('user_id', userId)
        .order('updated_at', { ascending: false }) as unknown as { data: ProjectRow[] | null; error: { message: string; code?: string } | null },
      'projectRepo.listByUser'
    ) as Promise<ProjectRow[]>
  },

  async create(data: Omit<ProjectRow, 'id' | 'created_at' | 'updated_at'>): Promise<ProjectRow> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('projects').insert([{ ...data, id: uuidv4() }]).select().single() as unknown as { data: ProjectRow | null; error: { message: string; code?: string } | null },
      'projectRepo.create'
    )
  },

  async update(id: string, updates: Partial<ProjectRow>): Promise<ProjectRow | null> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('projects').update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single() as unknown as { data: ProjectRow | null; error: { message: string; code?: string } | null },
      'projectRepo.update'
    )
  },

  async delete(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { error } = await supabase!.from('projects').delete().eq('id', id)
    return !error
  },

  async listTemplates(): Promise<TemplateRow[]> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('templates').select('*').order('generated_at', { ascending: false }) as unknown as { data: TemplateRow[] | null; error: { message: string; code?: string } | null },
      'projectRepo.listTemplates'
    ) as Promise<TemplateRow[]>
  },

  async saveTemplate(data: Omit<TemplateRow, 'id'>): Promise<TemplateRow> {
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    return withRetry(async () =>
      supabase!.from('templates').insert([{ ...data, id: uuidv4() }]).select().single() as unknown as { data: TemplateRow | null; error: { message: string; code?: string } | null },
      'projectRepo.saveTemplate'
    )
  },
}
