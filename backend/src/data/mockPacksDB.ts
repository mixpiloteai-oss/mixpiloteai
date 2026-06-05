// ============================================================
// NEUROTEK AI — Packs Database (formerly in-memory mockPacksDB)
// All data persisted in PostgreSQL via packRepository.
// ============================================================

import { isSupabaseConfigured } from '../lib/supabase'
import { packRepository }       from '../repositories/packRepository'
import { logger }               from '../utils/logger'

export type PackType = 'template' | 'fx-rack' | 'drum-kit' | 'live-scene' | 'preset' | 'chain' | 'ai-workflow'

export interface Pack {
  id: string; name: string; description: string
  type: PackType; genre: string; author: string; authorPlan: 'free' | 'pro' | 'studio'
  downloads: number; rating: number; ratingCount: number
  tags: string[]; isBuiltin: boolean; isFree: boolean; size: string
  createdAt: string; comments: PackComment[]
}

export interface PackComment {
  id: string; userId: string; userName: string; content: string; createdAt: string
}

export interface PackFilters {
  type?: PackType; genre?: string; search?: string
  sort?: 'trending' | 'newest' | 'top-rated'; freeOnly?: boolean
}

// ── Row → Domain mapper ───────────────────────────────────────
function rowToPack(r: any, comments: PackComment[] = []): Pack {
  return {
    id:          r.id,
    name:        r.name,
    description: r.description,
    type:        r.type as PackType,
    genre:       r.genre,
    author:      r.author,
    authorPlan:  (r.author_plan ?? 'free') as 'free' | 'pro' | 'studio',
    downloads:   r.downloads ?? 0,
    rating:      Number(r.rating ?? 0),
    ratingCount: r.rating_count ?? 0,
    tags:        r.tags ?? [],
    isBuiltin:   r.is_builtin ?? false,
    isFree:      r.is_free ?? true,
    size:        r.size ?? '0 MB',
    createdAt:   typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
    comments,
  }
}

function rowToComment(r: any): PackComment {
  return {
    id:        r.id,
    userId:    r.user_id,
    userName:  r.user_name,
    content:   r.content,
    createdAt: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
  }
}

// ── Seed data ─────────────────────────────────────────────────
let _seeded = false

async function ensureSeeded(): Promise<void> {
  if (_seeded) return
  _seeded = true
  try {
    if (!isSupabaseConfigured) return   // no DB — data served from DB-less paths
    const count = await packRepository.count()
    if (count > 0) return

    const builtin = [
      { id: 'bp-1', name: 'Mentalcore Starter', description: 'Complete mentalcore production template at 200 BPM', type: 'template', genre: 'mentalcore', author: 'NEUROTEK AI', author_plan: 'studio', downloads: 1842, rating: 4.8, rating_count: 234, tags: ['mentalcore','template','starter'], is_builtin: true, is_free: true, size: '2.4 MB', created_at: '2024-01-15T00:00:00Z' },
      { id: 'bp-2', name: 'Hardtek Kick Pack', description: 'Professional hardtek kick drum processing chains', type: 'fx-rack', genre: 'hardtek', author: 'NEUROTEK AI', author_plan: 'studio', downloads: 2156, rating: 4.9, rating_count: 312, tags: ['hardtek','kick','fx'], is_builtin: true, is_free: true, size: '1.8 MB', created_at: '2024-01-20T00:00:00Z' },
      { id: 'bp-3', name: 'Tribe Percussion Kit', description: 'Organic tribal percussion patterns and samples', type: 'drum-kit', genre: 'tribe', author: 'NEUROTEK AI', author_plan: 'studio', downloads: 987, rating: 4.6, rating_count: 145, tags: ['tribe','percussion','organic'], is_builtin: true, is_free: true, size: '15.2 MB', created_at: '2024-02-01T00:00:00Z' },
      { id: 'bp-4', name: 'Acid 303 Presets', description: '16 classic 303 acid presets for mentalcore and hardtek', type: 'preset', genre: 'acidcore', author: 'NEUROTEK AI', author_plan: 'studio', downloads: 3421, rating: 4.95, rating_count: 521, tags: ['acid','303','preset'], is_builtin: true, is_free: true, size: '0.5 MB', created_at: '2024-02-10T00:00:00Z' },
      { id: 'bp-5', name: 'Hard Techno Scene Pack', description: 'Complete live scene launcher setup for hard techno', type: 'live-scene', genre: 'hard-techno', author: 'NEUROTEK AI', author_plan: 'studio', downloads: 756, rating: 4.7, rating_count: 98, tags: ['hard-techno','live','scenes'], is_builtin: true, is_free: true, size: '3.1 MB', created_at: '2024-02-15T00:00:00Z' },
      { id: 'bp-6', name: 'Master Chain Pro', description: 'Professional mastering chain for tekno genres', type: 'chain', genre: 'mentalcore', author: 'NEUROTEK AI', author_plan: 'studio', downloads: 4102, rating: 4.85, rating_count: 678, tags: ['mastering','chain','pro'], is_builtin: true, is_free: true, size: '0.3 MB', created_at: '2024-03-01T00:00:00Z' },
      { id: 'bp-7', name: 'AI Mix Workflow', description: 'Automated AI-assisted mixing workflow templates', type: 'ai-workflow', genre: 'mentalcore', author: 'NEUROTEK AI', author_plan: 'studio', downloads: 1234, rating: 4.75, rating_count: 189, tags: ['ai','workflow','mix'], is_builtin: true, is_free: true, size: '0.8 MB', created_at: '2024-03-10T00:00:00Z' },
      { id: 'bp-8', name: 'Tekno Bass Templates', description: 'Minimalist tekno bass templates and processing chains', type: 'template', genre: 'tekno', author: 'NEUROTEK AI', author_plan: 'studio', downloads: 654, rating: 4.5, rating_count: 87, tags: ['tekno','bass','minimal'], is_builtin: true, is_free: true, size: '1.2 MB', created_at: '2024-03-20T00:00:00Z' },
    ]
    const community = [
      { id: 'cp-1', name: 'Mental Acid Toolkit', description: 'My personal acid toolkit for mentalcore', type: 'template', genre: 'mentalcore', author: 'AcidFreak303', author_plan: 'pro', downloads: 432, rating: 4.6, rating_count: 67, tags: ['mental','acid','toolkit'], is_builtin: false, is_free: true, size: '4.2 MB', created_at: '2024-04-01T00:00:00Z' },
      { id: 'cp-2', name: 'Underground Tribe Vol.1', description: 'Raw tribal tek sounds from the underground', type: 'drum-kit', genre: 'tribe', author: 'TribeWarrior', author_plan: 'studio', downloads: 287, rating: 4.8, rating_count: 43, tags: ['tribe','underground','raw'], is_builtin: false, is_free: false, size: '22.1 MB', created_at: '2024-04-15T00:00:00Z' },
      { id: 'cp-3', name: 'Industrial FX Racks', description: 'Dark industrial FX chains for hard techno', type: 'fx-rack', genre: 'hard-techno', author: 'IndustrialMind', author_plan: 'pro', downloads: 589, rating: 4.7, rating_count: 92, tags: ['industrial','fx','dark'], is_builtin: false, is_free: true, size: '2.8 MB', created_at: '2024-05-01T00:00:00Z' },
      { id: 'cp-4', name: 'Psychedelic Acid Patterns', description: 'Twisted 303 patterns for psychedelic acidcore', type: 'preset', genre: 'acidcore', author: 'PsychAcid', author_plan: 'studio', downloads: 1023, rating: 4.9, rating_count: 156, tags: ['psychedelic','acid','patterns'], is_builtin: false, is_free: true, size: '0.7 MB', created_at: '2024-05-10T00:00:00Z' },
      { id: 'cp-5', name: 'Live Set Architect', description: 'Advanced live scene structures for 2+ hour sets', type: 'live-scene', genre: 'mentalcore', author: 'LiveMaster', author_plan: 'studio', downloads: 234, rating: 4.5, rating_count: 38, tags: ['live','set','advanced'], is_builtin: false, is_free: false, size: '5.4 MB', created_at: '2024-05-20T00:00:00Z' },
    ]
    for (const p of [...builtin, ...community]) {
      await packRepository.upsert(p)
    }
    logger.info('mockPacksDB: seeded packs to PostgreSQL')
  } catch (e) {
    _seeded = false
    logger.warn('mockPacksDB: seed failed', { error: e })
  }
}

// ── Public API ────────────────────────────────────────────────
export async function getBuiltinPacks(): Promise<Pack[]> {
  await ensureSeeded()
  const rows = await packRepository.list({ sort: 'trending' })
  return rows.filter((r: any) => r.is_builtin).map(r => rowToPack(r))
}

export async function getPacks(filters: PackFilters = {}): Promise<Pack[]> {
  await ensureSeeded()
  const rows = await packRepository.list({
    type:     filters.type,
    genre:    filters.genre,
    search:   filters.search,
    freeOnly: filters.freeOnly,
    sort:     filters.sort ?? 'trending',
  })
  return rows.map(r => rowToPack(r))
}

export async function getPackById(id: string): Promise<Pack | undefined> {
  await ensureSeeded()
  const row = await packRepository.findById(id)
  if (!row) return undefined
  const comments = await packRepository.getComments(id)
  return rowToPack(row, comments.map(rowToComment))
}

export async function downloadPack(id: string): Promise<Pack | null> {
  const row = await packRepository.findById(id)
  if (!row) return null
  await packRepository.incrementDownloads(id)
  return rowToPack({ ...row, downloads: (row.downloads ?? 0) + 1 })
}

export async function ratePack(id: string, rating: number): Promise<Pack | null> {
  const row = await packRepository.findById(id)
  if (!row) return null
  const total = (Number(row.rating) * row.rating_count) + rating
  const newCount  = (row.rating_count ?? 0) + 1
  const newRating = Math.round((total / newCount) * 10) / 10
  await packRepository.updateRating(id, newRating, newCount)
  return rowToPack({ ...row, rating: newRating, rating_count: newCount })
}

export async function addComment(
  id: string, userId: string, userName: string, content: string
): Promise<PackComment | null> {
  const row = await packRepository.findById(id)
  if (!row) return null
  const comment = await packRepository.addComment(id, { user_id: userId, user_name: userName, content })
  return rowToComment(comment)
}

export async function getRecommendedPacks(genre?: string): Promise<Pack[]> {
  await ensureSeeded()
  const rows = await packRepository.list({ genre, sort: 'top-rated' })
  const pool = genre
    ? rows.filter((r: any) => r.genre === genre || r.is_builtin)
    : rows
  return pool.slice(0, 6).map((r: any) => rowToPack(r))
}

// ── Init ──────────────────────────────────────────────────────
void ensureSeeded()
