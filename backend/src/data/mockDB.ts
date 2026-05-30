// ============================================================
// NEUROTEK AI — Database Adapter (formerly mockDB)
//
// When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, all
// data is persisted in PostgreSQL via repositories.
//
// When those env vars are NOT set (local dev / tests without
// a live DB), this module falls back to a minimal in-memory
// store so the server still boots and tests still pass.
//
// For new code, import repositories directly.
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { isSupabaseConfigured }  from '../lib/supabase'
import { userRepository }        from '../repositories/userRepository'
import { projectRepository }     from '../repositories/projectRepository'

export type Plan = 'free' | 'pro' | 'studio'

export interface User {
  id: string; email: string; name: string; passwordHash: string
  plan: Plan; createdAt: string; refreshToken?: string
}

export interface Subscription {
  id: string; userId: string; plan: Plan
  status: 'active' | 'cancelled' | 'expired'
  createdAt: string; expiresAt?: string
}

export interface Project {
  id: string; userId: string; name: string; genre: string
  bpm: number; key: string; mood: string; tracks: unknown[]
  duration: number; isStarred: boolean; coverColor: string
  tags: string[]; createdAt: string; updatedAt: string
}

export interface Template {
  id: string; name: string; genre: string; bpm: number
  mood: string; description: string; tracks: unknown[]
  aiConfidence: number; generatedAt: string
}

// ── In-memory fallback (used only when Supabase is NOT configured) ──
// Pre-seed demo accounts so login tests pass without a real DB.
const DEMO_PASSWORD_HASH = bcrypt.hashSync('demo1234', 10)
const _users: User[] = [
  { id: 'demo-free-001',   email: 'demo@neurotek.ai',   name: 'Demo User',   passwordHash: DEMO_PASSWORD_HASH, plan: 'free',   createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'demo-pro-001',    email: 'pro@neurotek.ai',    name: 'Pro User',    passwordHash: DEMO_PASSWORD_HASH, plan: 'pro',    createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'demo-studio-001', email: 'studio@neurotek.ai', name: 'Studio User', passwordHash: DEMO_PASSWORD_HASH, plan: 'studio', createdAt: '2024-01-01T00:00:00.000Z' },
]
const _projects: Project[]      = []
const _templates: Template[]    = []
const _usageToday = new Map<string, number>()

// ── Row ↔ Domain mappers ──────────────────────────────────────
function rowToUser(r: any): User {
  return {
    id: r.id, email: r.email, name: r.name,
    passwordHash: r.password_hash, plan: r.plan,
    createdAt: r.created_at, refreshToken: r.refresh_token ?? undefined,
  }
}

function rowToProject(r: any): Project {
  return {
    id: r.id, userId: r.user_id, name: r.name, genre: r.genre,
    bpm: r.bpm, key: r.key, mood: r.mood, tracks: r.tracks ?? [],
    duration: r.duration, isStarred: r.is_starred,
    coverColor: r.cover_color, tags: r.tags ?? [],
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

function rowToTemplate(r: any): Template {
  return {
    id: r.id, name: r.name, genre: r.genre, bpm: r.bpm,
    mood: r.mood, description: r.description, tracks: r.tracks ?? [],
    aiConfidence: r.ai_confidence, generatedAt: r.generated_at,
  }
}

// ── User helpers ──────────────────────────────────────────────
export async function findUserByEmail(email: string): Promise<User | undefined> {
  if (isSupabaseConfigured) {
    const row = await userRepository.findByEmail(email)
    return row ? rowToUser(row) : undefined
  }
  return _users.find(u => u.email === email)
}

export async function findUserById(id: string): Promise<User | undefined> {
  if (isSupabaseConfigured) {
    const row = await userRepository.findById(id)
    return row ? rowToUser(row) : undefined
  }
  return _users.find(u => u.id === id)
}

export async function createUser(data: {
  email: string; name: string; password: string; plan?: Plan
}): Promise<User> {
  if (isSupabaseConfigured) {
    const row = await userRepository.create(data)
    return rowToUser(row)
  }
  // In-memory fallback
  if (_users.find(u => u.email === data.email)) throw new Error('Email already in use')
  const user: User = {
    id:           uuidv4(),
    email:        data.email,
    name:         data.name,
    passwordHash: bcrypt.hashSync(data.password, 10),
    plan:         (data.plan ?? 'free') as Plan,
    createdAt:    new Date().toISOString(),
  }
  _users.push(user)
  return user
}

export async function getTodayUsage(userId: string): Promise<number> {
  if (isSupabaseConfigured) return userRepository.getTodayUsage(userId)
  return _usageToday.get(userId) ?? 0
}

export async function incrementUsage(userId: string): Promise<void> {
  if (isSupabaseConfigured) return userRepository.incrementUsage(userId)
  _usageToday.set(userId, (_usageToday.get(userId) ?? 0) + 1)
}

export function getDailyLimit(plan: Plan): number {
  return {
    free:   Number(process.env.QUOTA_FREE_DAILY   ?? 20),
    pro:    Number(process.env.QUOTA_PRO_DAILY    ?? 200),
    studio: Number(process.env.QUOTA_STUDIO_DAILY ?? 9999),
  }[plan]
}

// ── Project CRUD ──────────────────────────────────────────────
export const db = {
  async getAllProjects(): Promise<Project[]> {
    if (isSupabaseConfigured) {
      const { supabase } = await import('../lib/db')
      if (!supabase) return []
      const { data } = await supabase.from('projects').select('*').order('updated_at', { ascending: false })
      return (data ?? []).map(rowToProject)
    }
    return _projects
  },

  async getUserProjects(userId: string): Promise<Project[]> {
    if (isSupabaseConfigured) {
      const rows = await projectRepository.listByUser(userId)
      return rows.map(rowToProject)
    }
    return _projects.filter(p => p.userId === userId)
  },

  async getProject(id: string): Promise<Project | undefined> {
    if (isSupabaseConfigured) {
      const row = await projectRepository.findById(id)
      return row ? rowToProject(row) : undefined
    }
    return _projects.find(p => p.id === id)
  },

  async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    if (isSupabaseConfigured) {
      const row = await projectRepository.create({
        user_id:     data.userId,
        name:        data.name,
        genre:       data.genre,
        bpm:         data.bpm,
        key:         data.key,
        mood:        data.mood,
        tracks:      data.tracks,
        duration:    data.duration,
        is_starred:  data.isStarred,
        cover_color: data.coverColor,
        tags:        data.tags,
      })
      return rowToProject(row)
    }
    // In-memory fallback
    const now = new Date().toISOString()
    const project: Project = { ...data, id: uuidv4(), createdAt: now, updatedAt: now }
    _projects.push(project)
    return project
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    if (isSupabaseConfigured) {
      const patch: Record<string, unknown> = {}
      if (updates.name       !== undefined) patch.name        = updates.name
      if (updates.genre      !== undefined) patch.genre       = updates.genre
      if (updates.bpm        !== undefined) patch.bpm         = updates.bpm
      if (updates.key        !== undefined) patch.key         = updates.key
      if (updates.mood       !== undefined) patch.mood        = updates.mood
      if (updates.tracks     !== undefined) patch.tracks      = updates.tracks
      if (updates.duration   !== undefined) patch.duration    = updates.duration
      if (updates.isStarred  !== undefined) patch.is_starred  = updates.isStarred
      if (updates.coverColor !== undefined) patch.cover_color = updates.coverColor
      if (updates.tags       !== undefined) patch.tags        = updates.tags
      const row = await projectRepository.update(id, patch)
      return row ? rowToProject(row) : null
    }
    const idx = _projects.findIndex(p => p.id === id)
    if (idx < 0) return null
    _projects[idx] = { ..._projects[idx]!, ...updates, updatedAt: new Date().toISOString() }
    return _projects[idx]!
  },

  async deleteProject(id: string): Promise<boolean> {
    if (isSupabaseConfigured) return projectRepository.delete(id)
    const idx = _projects.findIndex(p => p.id === id)
    if (idx < 0) return false
    _projects.splice(idx, 1)
    return true
  },

  async getAllTemplates(): Promise<Template[]> {
    if (isSupabaseConfigured) {
      const rows = await projectRepository.listTemplates()
      return rows.map(rowToTemplate)
    }
    return _templates
  },

  async getTemplate(id: string): Promise<Template | undefined> {
    if (isSupabaseConfigured) {
      const rows = await projectRepository.listTemplates()
      return rows.map(rowToTemplate).find(t => t.id === id)
    }
    return _templates.find(t => t.id === id)
  },

  async saveTemplate(data: Omit<Template, 'id'>): Promise<Template> {
    if (isSupabaseConfigured) {
      const row = await projectRepository.saveTemplate({
        name:          data.name,
        genre:         data.genre,
        bpm:           data.bpm,
        mood:          data.mood,
        description:   data.description,
        tracks:        data.tracks,
        ai_confidence: data.aiConfidence,
        generated_at:  data.generatedAt,
      })
      return rowToTemplate(row)
    }
    const template: Template = { ...data, id: uuidv4() }
    _templates.push(template)
    return template
  },
}
